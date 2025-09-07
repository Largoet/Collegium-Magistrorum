// src/index.ts
import {
  Client, Collection, GatewayIntentBits, REST, Routes, Events,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  EmbedBuilder, MessageFlags, Interaction,
} from 'discord.js';
import { env } from './lib/config';

// ---- Commands
import * as ping from './commands/ping';
import * as focus from './commands/focus';
import * as profile from './commands/profile';
import * as housesPanel from './commands/houses-panel';
import * as inventory from './commands/inventory';
import * as shop from './commands/shop';
import * as buy from './commands/buy';
import * as daily from './commands/daily';
import * as leaderboard from './commands/leaderboard';

// ---- Panneaux
import * as focusPanel from './commands/focus-panel';
import * as dailyPanel from './commands/daily-panel';
import * as profilePanel from './commands/profile-panel';
import * as leaderboardPanel from './commands/leaderboard-panel';
import * as shopPanel from './commands/shop-panel';

// ---- Handlers panneaux
import {
  handleFocusButton,
  handleFocusModal,
  handleDailyButton,
  handleProfileOpen,
  handleProfileCard,
  handleLeaderboardRefresh,
  handleShopOpen,
  handleShopBuy,
} from './handlers/panelHandlers';

import { houses } from './lib/houses';
import './lib/db'; // init DB

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const commands = new Collection<string, any>([
  [ping.data.name, ping],
  [focus.data.name, focus],
  [profile.data.name, profile],
  [housesPanel.data.name, housesPanel],
  [inventory.data.name, inventory],
  [daily.data.name, daily],
  [leaderboard.data.name, leaderboard],
  [shop.data.name, shop],
  [buy.data.name, buy],
  [focusPanel.data.name, focusPanel],
  [dailyPanel.data.name, dailyPanel],
  [profilePanel.data.name, profilePanel],
  [leaderboardPanel.data.name, leaderboardPanel],
  [shopPanel.data.name, shopPanel],
]);

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = [...commands.values()].map(c => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(env.APPLICATION_ID, env.GUILD_ID), { body });
  console.log('✅ Slash commands registered for guild', env.GUILD_ID);
}

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
});

/* -------- Onboarding nouveau membre -------- */
function buildHousePanel(guildId: string) {
  const embed = new EmbedBuilder()
    .setTitle('Bienvenue !')
    .setDescription(
      houses.length
        ? 'Choisis ta **guilde** pour recevoir le rôle correspondant.'
        : 'Aucune guilde configurée. (Admin: renseigner HOUSE_ROLES dans .env)'
    )
    .setColor(0x8bc34a);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`house:select:${guildId}`)
      .setPlaceholder('Sélectionne ta guilde…')
      .setDisabled(houses.length === 0)
      .addOptions(
        ...houses.map((h: any) => {
          const opt = new StringSelectMenuOptionBuilder().setLabel(h.name).setValue(h.roleId);
          if (h.emoji) opt.setEmoji(h.emoji as any);
          return opt;
        })
      )
  );

  return { embed, row };
}

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (!houses.length) return;
    const { embed, row } = buildHousePanel(member.guild.id);

    try {
      await member.send({ embeds: [embed], components: [row] });
      return;
    } catch {}

    if (env.WELCOME_CHANNEL_ID) {
      const ch = await member.guild.channels.fetch(env.WELCOME_CHANNEL_ID).catch(() => null);
      if (ch && ch.isTextBased()) {
        await ch.send({ content: `Bienvenue <@${member.id}> !`, embeds: [embed], components: [row] });
      }
    }
  } catch (e) {
    console.error('Onboarding error:', e);
  }
});

/* -------- Routage des interactions -------- */
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // 👉 Les boutons de la carte Focus publique sont gérés par le collector du service
    if (interaction.isButton() && interaction.customId.startsWith('slash:focus:')) {
      return; // le collector de services/focus.ts répondra
    }

    // 1) Sélection de guilde
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('house:select:')) {
      await interaction.deferUpdate();

      const roleId = interaction.values[0];
      const guildId = interaction.customId.split(':')[2];

      try {
        const guild = interaction.guild ?? await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(interaction.user.id);

        const houseRoleIds = houses.map((h: any) => h.roleId);
        const toRemove = member.roles.cache.filter(r => houseRoleIds.includes(r.id) && r.id !== roleId);
        if (toRemove.size) await member.roles.remove([...toRemove.keys()]);
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);

        const roleName = houses.find((h: any) => h.roleId === roleId)?.name ?? 'guilde';
        const done = new EmbedBuilder()
          .setTitle('🎉 Guilde mise à jour')
          .setDescription(`Tu as rejoint **${roleName}**.\nTes anciennes sessions/XP restent attribuées à tes anciens choix.`)
          .setColor(0x4caf50);

        await interaction.message.edit({ components: [] }).catch(() => {});
        await interaction.followUp({ embeds: [done], flags: MessageFlags.Ephemeral }).catch(() => {});
      } catch (e: any) {
        console.error('House select error:', e);
        const tip = e?.code === 50013
          ? 'Permissions insuffisantes : donne **Gérer les rôles** au bot et place son rôle **au-dessus** des rôles de guilde.'
          : 'Erreur lors de l’attribution du rôle.';
        await interaction.followUp({ content: `❌ ${tip}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

    // 2) Boutons des panneaux
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Focus (panneau)
      if (id.startsWith('panel:focus:'))   return handleFocusButton(interaction as any);

      // Daily
      if (id === 'panel:daily:claim')      return handleDailyButton(interaction as any);

      // Profile
      if (id === 'panel:profile:open')     return handleProfileOpen(interaction as any);
      if (id === 'panel:profile:card')     return handleProfileCard(interaction as any);

      // Leaderboard
      if (id === 'panel:leaderboard:refresh') return handleLeaderboardRefresh(interaction as any);

      // Shop
      if (id === 'panel:shop:open')        return handleShopOpen(interaction as any);
      if (id.startsWith('shop:buy:'))      return handleShopBuy(interaction as any);

      return;
    }

    // 3) Modals des panneaux
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal:focus:custom') {
        return handleFocusModal(interaction as any);
      }
      return;
    }

    // 4) Slash-commands
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
      return;
    }

  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      const msg = 'Une erreur est survenue.';
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  }
});

(async () => {
  await registerSlashCommands();
  await client.login(env.DISCORD_TOKEN);
})();
