// src/commands/profile.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { sql } from '../lib/db';
import { levelFromXP, progressBar } from '../lib/game';
import { houses } from '../lib/houses';
import { titleForHouse } from '../lib/titles';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche la fiche personnage (XP global + par guilde)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // --- Global (30j)
  const xpRow = sql.totalXP30d.get(userId) as { xp: number } | undefined;
  const xp = Number(xpRow?.xp ?? 0);
  const { level, into, toNext, pct } = levelFromXP(xp);
  const bar = progressBar(pct);

  // --- Sessions (30j)
  const sessRow = sql.totalSessions30d.get(userId) as { n: number } | undefined;
  const sessions = Number(sessRow?.n ?? 0);

  // --- Top compétences (30j)
  const top = sql.topSkills30d.all(userId) as Array<{ skill: string; minutes: number }>;
  const topLines =
    top.length > 0
      ? top.map((r, i) => `${i + 1}. **${r.skill}** — ${r.minutes} min`).join('\n')
      : '—';

  // --- XP par guilde (30j)
  // Requiert: focus.ts tague houseRoleId + db.ts a xpByHouse30d
  const perHouse = (sql.xpByHouse30d?.all(userId) ?? []) as Array<{ house: string; xp: number }>;
  const houseFields = perHouse.map(({ house, xp }) => {
    const meta = houses.find(h => h.roleId === house);
    const hName = meta?.name ?? 'Guilde';
    const lv = levelFromXP(xp);
    const title = titleForHouse(house, lv.level);
    const b = progressBar(lv.pct);
    return {
      name: `${hName} — ${title} (niv ${lv.level})`,
      value: `${b}\n${lv.into} / ${lv.toNext} XP   •   30j: ${xp}`,
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setTitle(`Profil de ${interaction.user.username}`)
    .addFields(
      { name: 'Niveau (global)', value: String(level), inline: true },
      { name: 'XP global (30j)', value: String(xp), inline: true },
      { name: 'Vers niveau suivant', value: `${into} / ${toNext} XP`, inline: true },
      { name: 'Progression', value: bar },
    )
    .addFields(
      houseFields.length
        ? houseFields
        : [{ name: 'Guildes', value: 'Aucune activité de guilde sur 30 jours.' }]
    )
    .addFields(
      { name: 'Sessions (30 jours)', value: String(sessions), inline: true },
      { name: 'Top compétences (30 jours)', value: topLines },
    )
    .setColor(0x2196f3);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
