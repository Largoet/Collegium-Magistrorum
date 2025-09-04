// src/commands/daily.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { houses } from '../lib/houses';
import { sql } from '../lib/db';
import { rollLoot } from '../lib/loot';
import { houseNameFromRoleId } from '../lib/rp';

const CLAIM_COOLDOWN_SEC = 20 * 60 * 60; // 20h — plus souple que 24h

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Réclame ta récompense quotidienne (or, XP, chance de loot)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const now = Math.floor(Date.now() / 1000);

  // Détecter guilde active (pour loot et tag)
  let houseRoleId: string | null = null;
  if (interaction.inGuild()) {
    try {
      const member = await interaction.guild!.members.fetch(userId);
      const current = houses.find(h => member.roles.cache.has(h.roleId));
      houseRoleId = current?.roleId ?? null;
    } catch { /* ignore */ }
  }
  const houseName = houseNameFromRoleId(houseRoleId);

  const d = sql.getDaily.get(userId) as { last_claim_ts: number; streak: number } | undefined;
  const last = d?.last_claim_ts ?? 0;
  const diff = now - last;

  if (diff < CLAIM_COOLDOWN_SEC) {
    const wait = CLAIM_COOLDOWN_SEC - diff;
    const h = Math.floor(wait / 3600);
    const m = Math.floor((wait % 3600) / 60);
    return interaction.reply({
      content: `⏳ Tu pourras reclamer dans **${h}h ${m}m**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Streak: reset si > 48h, sinon +1
  let streak = (d?.streak ?? 0);
  if (last === 0 || diff > 48 * 3600) streak = 1; else streak += 1;

  // Récompenses (simple et lisible)
  const baseGold = 2;
  const bonusGold = Math.min(streak, 7); // cap à +7
  const totalGold = baseGold + bonusGold;

  const baseXP = 5;
  const bonusXP = Math.floor(streak / 3) * 2; // +2 XP tous les 3 jours
  const totalXP = baseXP + bonusXP;

  // Applique or + xp
  sql.upsertUser.run(userId);
  sql.addGold.run(totalGold, userId);
  const ts = now;
  if (houseRoleId) {
    sql.insertXPWithHouse.run(userId, totalXP, ts, houseRoleId);
  } else {
    sql.insertXP.run(userId, totalXP, ts);
  }

  // Loot aléatoire (faible chance)
  const drop = Math.random() < 0.25 ? rollLoot(houseRoleId) : null;
  if (drop) {
    sql.insertLoot.run(userId, drop.key, houseRoleId ?? null, drop.rarity, ts);
  }

  // Enregistre claim
  sql.upsertDaily.run(userId, now, streak);

  const emoji = drop?.emoji ?? '🎁';
  const lootLine = drop ? `\n${emoji} Butin: **${drop.name}** (${drop.rarity})` : '';
  const embed = new EmbedBuilder()
    .setTitle(`Récompense quotidienne — ${houseName}`)
    .setDescription(
      `Tu gagnes **${totalGold} 🪙** et **${totalXP} XP** (streak: ${streak}).${lootLine}`
    )
    .setColor(0xff9800);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
