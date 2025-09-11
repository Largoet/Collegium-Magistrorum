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

  // --- Récup guilde/maison pour l’affichage et bonus éventuels ---
  const member = interaction.guild ? await interaction.guild.members.fetch(userId) : null;
  const houseRole = member?.roles.cache.find((r) => houses.some((h) => h.roleId === r.id));
  const houseRoleId = houseRole?.id ?? null;
  const houseName = houseNameFromRoleId(houseRoleId) ?? 'Sans Guilde';

  // --- Streak + fenêtre “une fois par jour” ---
  const now = Math.floor(Date.now() / 1000);
  const dailyRow = sql.getDaily.get(userId) as { last_claim_ts?: number; streak?: number } | undefined;
  const last = dailyRow?.last_claim_ts ?? 0;
  const prev = new Date((last || 0) * 1000);
  const cur = new Date(now * 1000);
  const sameDay =
    prev.getUTCFullYear() === cur.getUTCFullYear() &&
    prev.getUTCMonth() === cur.getUTCMonth() &&
    prev.getUTCDate() === cur.getUTCDate();
  if (sameDay) {
    await interaction.reply({
      content: 'Tu as déjà réclamé le daily aujourd’hui.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  let streak = (dailyRow?.streak ?? 0) + (last > 0 && (now - last) <= 86400 * 2 ? 1 : 1);

  // --- Récompenses or/xp (garde ta logique si tu en as une) ---
  const baseGold = 25;
  const baseXP = 15;
  const bonus = Math.round((streak - 1) * 0.2 * baseXP);
  const totalXP = baseXP + bonus;
  const totalGold = baseGold + Math.floor(streak / 2) * 5;

  // --- Persistance gains ---
  sql.upsertUser.run(userId);
  sql.addGold.run(totalGold, userId);
  const at = now;
  if (houseRoleId) sql.insertXPWithHouse.run(userId, totalXP, at, houseRoleId);
  else sql.insertXP.run(userId, totalXP, at);

  // --- Tirage de loot Daily (30%) ---
  const drop = rollLootForUser(userId, houseRoleId ?? undefined, { source: 'daily' });
  if (drop) sql.insertLoot.run(userId, drop.key, houseRoleId, drop.rarity, at);

  // --- Sauvegarde streak ---
  sql.upsertDaily.run(userId, now, streak);

  // --- Réponse ---
  const lootLine = drop ? `\n${drop.emoji ?? '🎁'} Butin: **${drop.name}** (${drop.rarity})` : '';
  const embed = new EmbedBuilder()
    .setTitle(`Récompense quotidienne — ${houseName}`)
    .setDescription(`Tu gagnes **${totalGold} 🪙** et **${totalXP} XP** (streak: ${streak}).${lootLine}`)
    .setColor(0xff9800);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
