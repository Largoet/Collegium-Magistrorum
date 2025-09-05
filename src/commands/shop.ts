// src/commands/shop.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags, // 👈 utiliser flags pour l'éphémère
  type ComponentEmojiResolvable,
  type InteractionReplyOptions,
  type RepliableInteraction,
} from 'discord.js';
import { sql } from '../lib/db';
import { houses } from '../lib/houses';
import { themeByRoleId } from '../lib/theme';
import {
  RARITY_ORDER,
  RARITY_PRICE,
  RARITY_BADGE,
  listItems,
  GuildName,
  describeItem,
} from '../lib/loot';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Affiche la boutique du jour')
  .addBooleanOption((opt) =>
    opt
      .setName('menu')
      .setDescription('Afficher sous forme de menu déroulant (au lieu de boutons)')
  )
  .addBooleanOption((opt) =>
    opt
      .setName('public')
      .setDescription('Publier publiquement dans le canal (par défaut : éphémère)')
  );

type Offer = {
  id: number;
  item_key: string;
  rarity: string;
  price: number;
  purchased_ts: number | null;
};

function epochDay(now = Date.now()): number {
  return Math.floor(now / 86400000); // 24h en ms
}

function guildNameFromRoleId(roleId?: string | null): GuildName | null {
  if (!roleId) return null;
  const h = houses.find((x) => x.roleId === roleId);
  return (h?.name ?? null) as GuildName | null;
}

/** Génère 3 offres (common/rare/epic) si aucune n’existe encore,
 *  puis injecte "xp_potion_daily" (50🪙) si absente.
 */
function ensureOffers(userId: string, day: number, houseRoleId: string | null, guild: GuildName) {
  let offers = (sql.getOffersForUserToday.all(userId, day) as Offer[]) ?? [];

  if (!offers.length) {
    const targetRarities: Array<'common' | 'rare' | 'epic'> = ['common', 'rare', 'epic'];
    for (const rar of targetRarities) {
      const pool = listItems(guild, rar);
      if (!pool.length) continue;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const price = RARITY_PRICE[rar];
      sql.insertOffer.run(userId, day, houseRoleId, pick.key, rar, price);
    }
    offers = (sql.getOffersForUserToday.all(userId, day) as Offer[]) ?? [];
  }

  // Potion XP quotidienne
  const hasPotion = offers.some((o) => o.item_key === 'xp_potion_daily');
  if (!hasPotion) {
    sql.insertOffer.run(userId, day, houseRoleId, 'xp_potion_daily', 'common', 50);
    offers = (sql.getOffersForUserToday.all(userId, day) as Offer[]) ?? [];
  }

  return offers;
}

// Helper: merge flags éphémère si besoin
const withEphemeral = (isEphemeral: boolean, opts: InteractionReplyOptions = {}): InteractionReplyOptions =>
  isEphemeral ? { ...opts, flags: MessageFlags.Ephemeral } : opts;

// Helper sûr pour répondre même si l’interaction est déjà replied/deferred
async function send(interaction: RepliableInteraction, opts: InteractionReplyOptions) {
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(opts);
  }
  return interaction.reply(opts);
}

// NOTE: on accepte ici *toute* interaction répliable (slash, bouton, etc.)
export async function execute(interaction: ChatInputCommandInteraction | RepliableInteraction) {
  const isSlash = 'isChatInputCommand' in interaction && interaction.isChatInputCommand();
  const userId = interaction.user.id;

  // Options seulement si slash; sinon valeurs par défaut
  const useMenu = isSlash ? (interaction as ChatInputCommandInteraction).options.getBoolean('menu') ?? false : false;
  const isPublic = isSlash ? (interaction as ChatInputCommandInteraction).options.getBoolean('public') ?? false : false;

  // guilde actuelle
  const inGuild = 'inGuild' in interaction ? interaction.inGuild() : false;
  const member = inGuild && interaction.guild ? interaction.guild.members.cache.get(userId) : null;
  const houseRoleId = member ? houses.find((h) => member.roles.cache.has(h.roleId))?.roleId ?? null : null;
  const guild = guildNameFromRoleId(houseRoleId) ?? 'Mage';
  const theme = themeByRoleId(houseRoleId ?? undefined);

  const day = epochDay();

  // génère si besoin + lit
  const offers = ensureOffers(userId, day, houseRoleId, guild) as Offer[];
  if (!offers || !offers.length) {
    return send(interaction, withEphemeral(!isPublic, { content: 'Boutique vide pour aujourd’hui.' }));
  }

  // couleur (visuel)
  const rarityIndex = (r: string) => Math.max(0, RARITY_ORDER.indexOf(r as any));
  const best = offers.reduce((a, b) => (rarityIndex(a.rarity) >= rarityIndex(b.rarity) ? a : b));
  const color = theme.color;

  // lignes lisibles (nom FR + emoji + prix)
  const lines = offers.map((o) => {
    const badge = (RARITY_BADGE as any)?.[o.rarity] ?? '◆';
    const { name, emoji } = describeItem(o.item_key);
    const bought = o.purchased_ts ? ' — **(acheté)**' : '';
    return `${badge} ${emoji ?? ''} **${name}** — **${o.price}** 🪙${bought}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏪 Boutique — ${guild}`)
    .setDescription(lines.join('\n'))
    .setColor(color)
    .setImage((theme.bannerUrl ?? '') as any);

  // purge des vieilles offres
  sql.cleanupOldOffers.run(day - 14);

  // --- Composants (boutons OU menu) ---
  const components: Array<
    ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>
  > = [];

  if (!useMenu) {
    // Version BOUTONS
    const trim = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...offers.map((o) => {
        const { name, emoji } = describeItem(o.item_key);
        const label = `${emoji ?? ''} ${trim(name)} — ${o.price}🪙`;
        return new ButtonBuilder()
          .setCustomId(`shop:buy:${o.id}`)
          .setLabel(o.purchased_ts ? 'Acheté' : label)
          .setStyle(o.purchased_ts ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(!!o.purchased_ts);
      })
    );
    components.push(row);
  } else {
    // Version MENU (achat immédiat à la sélection)
    const select = new StringSelectMenuBuilder()
      .setCustomId('shop:buy-select')
      .setPlaceholder('Choisis un objet à acheter')
      .addOptions(
        ...offers.map((o) => {
          const { name, emoji } = describeItem(o.item_key);
          const opt = new StringSelectMenuOptionBuilder()
            .setLabel(name.slice(0, 100))
            .setDescription(`${o.rarity} — ${o.price}🪙`)
            .setValue(String(o.id));
          if (emoji) opt.setEmoji(emoji as ComponentEmojiResolvable);
          return opt;
        })
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  // réponse (public si isPublic = true, sinon éphémère via flags)
  return send(interaction, withEphemeral(!isPublic, { embeds: [embed], components }));
}
