// src/commands/leaderboard.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { sql } from '../lib/db';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Classement XP des 30 derniers jours (Top 10)')
  .addBooleanOption(o =>
    o.setName('public')
      .setDescription('Publier dans le salon (par défaut: privé)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const makePublic = interaction.options.getBoolean('public') ?? false;

  const rows = sql.topXP30d.all() as Array<{ user_id: string; xp: number }>;
  if (!rows.length) {
    return interaction.reply({
      content: 'Pas encore de données pour le classement.',
      flags: makePublic ? undefined : MessageFlags.Ephemeral,
    });
  }

  // Résolutions des pseudos (limité au Top 10 → raisonnable)
  const entries = await Promise.all(rows.map(async (r, i) => {
    try {
      const u = await interaction.client.users.fetch(r.user_id);
      const name = u.username ?? r.user_id;
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      return `${medal} **${name}** — ${r.xp} XP`;
    } catch {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      return `${medal} <@${r.user_id}> — ${r.xp} XP`;
    }
  }));

  const embed = new EmbedBuilder()
    .setTitle('🏆 Leaderboard — XP (30 jours)')
    .setDescription(entries.join('\n'))
    .setColor(0xfbc02d);

  await interaction.reply({
    embeds: [embed],
    flags: makePublic ? undefined : MessageFlags.Ephemeral,
  });
}
