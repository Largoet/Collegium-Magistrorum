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

const CLAIM_COOLDOWN_SEC = 20 * 60 * 60; // 20h

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const now = Math.floor(Date.now() / 1000);

  const row = sql.getDaily.get(userId) as { last_claim_ts?: number; streak?: number } | undefined;
  const last = row?.last_claim_ts ?? 0;
  let streak = row?.streak ?? 0;

  const delta = now - last;
  if (last && delta < CLAIM_COOLDOWN_SEC) {
    const remain = CLAIM_COOLDOWN_SEC - delta;
    const hrs = Math.floor(remain / 3600);
    const mins = Math.ceil((remain % 3600) / 60);
    return interaction.reply({
      content: `🕒 Trop tôt ! Reviens dans **${hrs}h ${mins}m**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!last || delta < 48 * 3600) streak = Math.min((streak || 0) + 1, 7);
  else streak = 1;

  // guilde
  const member = interaction.inGuild() ? interaction.guild!.members.cache.get(userId) : null;
  const houseRoleId = member ? houses.find(h => member.roles.cache.has(h.roleId))?.roleId ?? null : null;
  const houseName = houseNameFromRoleId(houseRoleId ?? undefined);

  // récompenses
  const baseGold = 25;
  const baseXP = 15;
  const bonus = Math.round((streak - 1) * 0.2 * baseXP);
  const totalXP = baseXP + bonus;
  const totalGold = baseGold + Math.floor(streak / 2) * 5;

  // DB
  sql.upsertUser.run(userId);
  sql.addGold.run(totalGold, userId);
  const at = now;
  if (houseRoleId) sql.insertXPWithHouse.run(userId, totalXP, at, houseRoleId);
  else sql.insertXP.run(userId, totalXP, at);

  // loot (journalier)
  const drop = rollLootForUser(userId, houseRoleId ?? undefined);
  if (drop) sql.insertLoot.run(userId, drop.key, houseRoleId, drop.rarity, at);

  sql.upsertDaily.run(userId, now, streak);

  const lootLine = drop ? `\n${drop.emoji ?? '🎁'} Butin: **${drop.name}** (${drop.rarity})` : '';
  const embed = new EmbedBuilder()
    .setTitle(`Récompense quotidienne — ${houseName}`)
    .setDescription(`Tu gagnes **${totalGold} 🪙** et **${totalXP} XP** (streak: ${streak}).${lootLine}`)
    .setColor(0xff9800);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
