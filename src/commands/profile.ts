// src/commands/profile.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { sql } from '../lib/db';
import { levelFromXP, progressBar } from '../lib/game';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche la fiche personnage (XP 30 jours + niveau)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // XP total sur 30j
  const xpRow = sql.totalXP30d.get(userId) as { xp: number } | undefined;
  const xp = Number(xpRow?.xp ?? 0);

  // Courbe de niveaux + barre de progression
  const { level, into, toNext, pct } = levelFromXP(xp);
  const bar = progressBar(pct);

  // Sessions et top compétences sur 30j
  const sessRow = sql.totalSessions30d.get(userId) as { n: number } | undefined;
  const sessions = Number(sessRow?.n ?? 0);

  const top = sql.topSkills30d.all(userId) as Array<{ skill: string; minutes: number }>;
  const topLines =
    top.length > 0
      ? top.map((r, i) => `${i + 1}. **${r.skill}** — ${r.minutes} min`).join('\n')
      : '—';

  const embed = new EmbedBuilder()
    .setTitle(`Profil de ${interaction.user.username}`)
    .addFields(
      { name: 'Niveau', value: String(level), inline: true },
      { name: 'XP (30 jours)', value: String(xp), inline: true },
      { name: 'Vers niveau suivant', value: `${into} / ${toNext} XP`, inline: true },
    )
    .addFields(
      { name: 'Progression', value: bar },
      { name: 'Top compétences (30 jours)', value: topLines },
    )
    .setColor(0x2196f3);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
