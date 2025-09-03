// src/commands/profile.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { sql } from '../lib/db';
import { houses } from '../lib/houses';
import { levelFromXP, progressBar } from '../lib/game';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche ta fiche (niveau, XP, or, stats 30j)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // XP total (pour le niveau)
  const xpAllRow = sql.totalXPAll.get(userId) as { xp: number } | undefined;
  const xpAll = Number(xpAllRow?.xp ?? 0);

  // XP sur 30 jours (métrique récente)
  const xp30Row = sql.totalXP30d.get(userId) as { xp: number } | undefined;
  const xp30 = Number(xp30Row?.xp ?? 0);

  // Courbe de niveau + barre
  const { level, into, toNext, pct } = levelFromXP(xpAll);
  const bar = progressBar(pct);

  // Sessions et top compétences (30j)
  const sessRow = sql.totalSessions30d.get(userId) as { n: number } | undefined;
  const sessions30 = Number(sessRow?.n ?? 0);

  const top = sql.topSkills30d.all(userId) as Array<{ skill: string; minutes: number }>;
  const topLines = top.length
    ? top.map((r, i) => `${i + 1}. **${r.skill}** — ${r.minutes} min`).join('\n')
    : '—';

  // Or
  const goldRow = sql.getGold.get(userId) as { gold: number } | undefined;
  const gold = Number(goldRow?.gold ?? 0);

  // XP par guilde (total)
  const byHouse = (sql.xpByHouseAll?.all(userId) ?? []) as Array<{ house: string | null; xp: number }>;
  const houseLines = byHouse.length
    ? byHouse.map(h => {
        const name = houses.find(x => x.roleId === h.house)?.name ?? '—';
        return `• ${name}: ${h.xp} XP`;
      }).join('\n')
    : '—';

  const embed = new EmbedBuilder()
    .setTitle(`Profil de ${interaction.user.username}`)
    .addFields(
      { name: 'Niveau', value: String(level), inline: true },
      { name: 'XP total', value: String(xpAll), inline: true },
      { name: 'Or', value: `${gold} 🪙`, inline: true },
    )
    .addFields(
      { name: 'Vers niveau suivant', value: `${into} / ${toNext} XP` },
      { name: 'Progression', value: bar },
      { name: 'XP (30 jours)', value: String(xp30), inline: true },
      { name: 'Sessions (30 jours)', value: String(sessions30), inline: true },
    )
    .addFields(
      { name: 'Top compétences (30 jours)', value: topLines },
      { name: 'XP par guilde (total)', value: houseLines },
    )
    .setColor(0x2196f3);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
