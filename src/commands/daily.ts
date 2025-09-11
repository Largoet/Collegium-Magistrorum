// src/commands/daily.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { sql } from '../lib/db';
import { houses } from '../lib/houses';
import { houseNameFromRoleId } from '../lib/rp';
import { rollLootForUser } from '../lib/loot';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Réclame ta récompense quotidienne');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // --- Récup maison (affichage + XP par guilde) ---
  const member = interaction.guild ? await interaction.guild.members.fetch(userId) : null;
  const houseRole = member?.roles.cache.find((r) => houses.some((h) => h.roleId === r.id));
  const houseRoleId = houseRole?.id ?? null;
  const houseName = houseNameFromRoleId(houseRoleId ?? undefined) ?? 'Sans Guilde';

  // --- Fenêtre une fois par jour (via daily_claims) ---
  const now = Math.floor(Date.now() / 1000);
  const row = sql.getDaily.get(userId) as { last_claim_ts?: number; streak?: number } | undefined;
  const last = row?.last_claim_ts ?? 0;

  const dPrev = new Date(last * 1000);
  const dNow = new Date(now * 1000);
  const sameDay =
    dPrev.getUTCFullYear() === dNow.getUTCFullYear() &&
    dPrev.getUTCMonth() === dNow.getUTCMonth() &&
    dPrev.getUTCDate() === dNow.getUTCDate();

  if (sameDay) {
    await interaction.reply({
      content: 'Tu as déjà réclamé le daily aujourd’hui.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // --- Streak (simple : +1) ---
  const streak = (row?.streak ?? 0) + 1;

  // --- Gains or/xp (exemple simple, adapte si besoin) ---
  const baseGold = 25;
  const baseXP = 15;
  const bonusXP = Math.floor((streak - 1) * 0.2 * baseXP); // petit bonus de streak
  const totalGold = baseGold + Math.floor(streak / 2) * 5;
  const totalXP = baseXP + bonusXP;

  // --- Persistance gains ---
  sql.upsertUser.run(userId);
  if (houseRoleId) sql.insertXPWithHouse.run(userId, totalXP, now, houseRoleId);
  else sql.insertXP.run(userId, totalXP, now);
  sql.addGold.run(totalGold, userId);

  // ===== CORRECTION: tirage loot Daily (30%) =====
  const drop = rollLootForUser(userId, houseRoleId ?? undefined, { source: 'daily' });
  if (drop) {
    sql.insertLoot.run(userId, drop.key, houseRoleId, drop.rarity, now);
  }

  // --- Sauvegarde daily_claims ---
  sql.upsertDaily.run(userId, now, streak);

  // --- Réponse ---
  const lootLine = drop ? `\n${drop.emoji ?? '🎁'} Butin: **${drop.name}** (${drop.rarity})` : '';
  const embed = new EmbedBuilder()
    .setTitle(`Récompense quotidienne — ${houseName}`)
    .setDescription(
      `Tu gagnes **${totalGold} 🪙** et **${totalXP} XP** (streak: ${streak}).${lootLine}`,
    )
    .setColor(0xff9800);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
