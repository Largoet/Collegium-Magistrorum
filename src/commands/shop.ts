// src/commands/shop.ts
import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import { sql, todayUTC } from '../lib/db';
import { houses } from '../lib/houses';
import { guildNameFromRoleId, RARITY_ORDER, RARITY_PRICE, listItems } from '../lib/loot';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Ta boutique du jour (objets de ta guilde)');

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

function userGuild(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) return { houseRoleId: null as string|null, guild: null as any };
  const member = interaction.guild!.members.cache.get(interaction.user.id);
  const h = houses.find(x => member?.roles.cache.has(x.roleId));
  return { houseRoleId: h?.roleId ?? null, guild: guildNameFromRoleId(h?.roleId) };
}

function has(userId: string, key: string) {
  const row = sql.hasLoot.get(userId, key) as any;
  return !!row;
}
function missingFor(userId: string, guild: any, rarity: any) {
  const all = listItems(guild, rarity);
  return all.filter(it => !has(userId, it.key));
}

function ensureOffers(userId: string, houseRoleId: string|null) {
  const day = todayUTC();
  let offers = sql.getOffersForUserToday.all(userId, day) as any[];
  if (offers.length) return offers;

  const guild = guildNameFromRoleId(houseRoleId);
  if (!guild) return [];

  // 3 offres : [common, rare, (common|epic)] en priorité sur ce qu'il manque
  const plan: Array<'common'|'rare'|'epic'|'legendary'|'unique'> = ['common','rare', Math.random()<0.5 ? 'common':'epic'];

  for (let i = 0; i < plan.length; i++) {
    let rar = plan[i];
    let pool = missingFor(userId, guild, rar);
    if (!pool.length) {
      // fallback: la plus proche rareté avec manque
      const idx = RARITY_ORDER.indexOf(rar);
      const around = [...RARITY_ORDER.slice(0, idx).reverse(), ...RARITY_ORDER.slice(idx+1)];
      for (const r2 of around) {
        pool = missingFor(userId, guild, r2);
        if (pool.length) { rar = r2; break; }
      }
    }
    plan[i] = rar;
  }

  const picked = new Set<string>();
  for (const rar of plan) {
    const pool = listItems(guild, rar).filter(it => !picked.has(it.key) && !has(userId, it.key));
    if (!pool.length) continue;
    const it = pick(pool);
    picked.add(it.key);
    const price = RARITY_PRICE[rar];
    sql.insertOffer.run(userId, day, houseRoleId, it.key, rar, price);
  }

  offers = sql.getOffersForUserToday.all(userId, day) as any[];
  return offers;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const { houseRoleId, guild } = userGuild(interaction);
  if (!guild) {
    return interaction.reply({ content: 'Tu dois appartenir à une guilde pour accéder à la boutique.', flags: MessageFlags.Ephemeral });
  }

  const offers = ensureOffers(interaction.user.id, houseRoleId);
  if (!offers.length) {
    return interaction.reply({ content: 'Aucune offre aujourd’hui (ta collection est peut-être complète).', flags: MessageFlags.Ephemeral });
  }

  const goldRow = sql.getGold.get(interaction.user.id) as { gold: number };
  const gold = goldRow?.gold ?? 0;

  const lines: string[] = [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (const off of offers) {
    const label = off.purchased ? 'Déjà acheté' : `Acheter — ${off.price} 🪙`;
    const b = new ButtonBuilder()
      .setCustomId(`shop:buy:${off.id}`)
      .setLabel(label)
      .setStyle(off.purchased ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(!!off.purchased);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(b));
    lines.push(`• **${off.item_key}** (${off.rarity}) — ${off.price} 🪙 ${off.purchased ? '— déjà acheté' : ''}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`Boutique — ${guild}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Or: ${gold} 🪙 • Offres du jour (personnelles)` })
    .setColor(0x6a1b9a);

  await interaction.reply({ embeds: [embed], components: rows.slice(0,5), flags: MessageFlags.Ephemeral });
}
