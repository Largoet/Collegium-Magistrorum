import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { sql } from '../lib/db';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche la fiche personnage (XP 30 jours + niveau)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const xpRow = sql.totalXP30d.get(userId) as { xp: number } | undefined;
  const xp = Number(xpRow?.xp ?? 0);
  const level = Math.floor(xp / 200); // palier simple MVP

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
      { name: 'XP (30 jours)', value: String(xp), inline: true },
      { name: 'Niveau', value: String(level), inline: true },
      { name: 'Sessions (30 jours)', value: String(sessions), inline: true },
    )
    .addFields({ name: 'Top compétences (30 jours)', value: topLines })
    .setColor(0x2196f3);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
