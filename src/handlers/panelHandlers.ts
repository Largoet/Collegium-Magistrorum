// src/handlers/panelHandlers.ts
import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { houses } from '../lib/houses';
import { commitSession, sql, buyShopOffer } from '../lib/db';
import { houseNameFromRoleId, introLine, victoryLine, failLine } from '../lib/rp';
import { rollLootForUser } from '../lib/loot';

/** Sessions en cours démarrées depuis un panneau */
type Running = {
  startedAtSec: number;
  minutes: number;
  skill: string;
  subject: string;
  houseRoleId: string | null;
  enableAtSec: number;
};
const timers = new Map<string, Running>(); // key = userId

function getUserHouseRoleId(i: ButtonInteraction | ModalSubmitInteraction): string | null {
  if (!i.inGuild()) return null;
  const member = i.guild!.members.cache.get(i.user.id);
  if (!member) return null;
  const h = houses.find(hh => member.roles.cache.has(hh.roleId));
  return h?.roleId ?? null;
}

function componentsForSession(disabledValidate: boolean) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:focus:validate')
      .setLabel('Valider')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabledValidate),
    new ButtonBuilder()
      .setCustomId('panel:focus:interrupt')
      .setLabel('Interrompre')
      .setStyle(ButtonStyle.Danger),
  );
  return [row];
}

// -------- Focus (boutons + modal) --------

export async function handleFocusButton(i: ButtonInteraction) {
  const [, , kind] = i.customId.split(':'); // panel:focus:{15|25|45|60|custom}

  if (kind === 'custom') {
    const modal = new ModalBuilder().setCustomId('modal:focus:custom').setTitle('Nouvelle session Focus');

    const minutes = new TextInputBuilder()
      .setCustomId('focus:minutes')
      .setLabel('Durée (minutes, ex. 25)')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const skill = new TextInputBuilder()
      .setCustomId('focus:skill')
      .setLabel('Compétence (ex. Docker, Lecture)')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const subject = new TextInputBuilder()
      .setCustomId('focus:subject')
      .setLabel('Sujet / note (optionnel)')
      .setRequired(false)
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(minutes),
      new ActionRowBuilder<TextInputBuilder>().addComponents(skill),
      new ActionRowBuilder<TextInputBuilder>().addComponents(subject),
    );
    return i.showModal(modal);
  }

  const mins = Number(kind);
  if (!Number.isFinite(mins) || mins <= 0) {
    return i.reply({ content: 'Durée invalide.', flags: MessageFlags.Ephemeral });
  }
  return startFocusFromPanel(i, mins, 'Général', '');
}

export async function handleFocusModal(i: ModalSubmitInteraction) {
  if (i.customId !== 'modal:focus:custom') return;
  const minutes = Number(i.fields.getTextInputValue('focus:minutes') || '0');
  const skill = (i.fields.getTextInputValue('focus:skill') || 'Général').trim();
  const subject = (i.fields.getTextInputValue('focus:subject') || '').trim();

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return i.reply({ content: 'Durée invalide.', flags: MessageFlags.Ephemeral });
  }
  return startFocusFromPanel(i, minutes, skill, subject);
}

async function startFocusFromPanel(
  i: ButtonInteraction | ModalSubmitInteraction,
  minutes: number,
  skill: string,
  subject: string,
) {
  const userId = i.user.id;
  const startedAtSec = Math.floor(Date.now() / 1000);
  const houseRoleId = getUserHouseRoleId(i);
  const houseName = houseNameFromRoleId(houseRoleId ?? undefined);

  const enableAtSec = startedAtSec + minutes * 60;
  timers.set(userId, { startedAtSec, minutes, skill, subject, houseRoleId, enableAtSec });

  const endTag = `<t:${enableAtSec}:t>`;
  const embed = new EmbedBuilder()
    .setTitle(`Focus — ${houseName}`)
    .setDescription(`${introLine(houseName, minutes, skill)}\n\n**Fin prévue :** ${endTag}`)
    .setColor(0x1976d2)
    .setTimestamp(new Date(enableAtSec * 1000));

  await i.reply({
    embeds: [embed],
    components: componentsForSession(false),
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleFocusValidate(i: ButtonInteraction) {
  const userId = i.user.id;
  const r = timers.get(userId);
  if (!r) {
    return i.reply({ content: 'Aucune session en cours.', flags: MessageFlags.Ephemeral });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < r.enableAtSec) {
    const remaining = Math.max(0, r.enableAtSec - now);
    return i.reply({
      content: `⏳ Pas encore ! Il reste **${Math.ceil(remaining / 60)} min**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const elapsedMin = Math.max(1, Math.round((now - r.startedAtSec) / 60));
  const xp = elapsedMin;
  const gold = Math.floor(elapsedMin / 15);

  commitSession(i.user.id, r.startedAtSec, elapsedMin, 'done', r.skill || null, r.subject || null, r.houseRoleId || null);
  const at = now;
  if (r.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, r.houseRoleId);
  else sql.insertXP.run(userId, xp, at);
  if (gold > 0) sql.addGold.run(gold, userId);

  const drop = rollLootForUser(userId, r.houseRoleId ?? undefined);
  if (drop) sql.insertLoot.run(userId, drop.key, r.houseRoleId, drop.rarity, at);

  const lootStr = drop ? `${drop.emoji ?? '🎁'} ${drop.name} (${drop.rarity})` : undefined;
  const houseName = houseNameFromRoleId(r.houseRoleId ?? undefined);
  const desc = victoryLine(houseName, elapsedMin, xp, gold, lootStr);

  const embed = new EmbedBuilder().setTitle('Session validée ✅').setDescription(desc).setColor(0x2e7d32);

  timers.delete(userId);
  await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export async function handleFocusInterrupt(i: ButtonInteraction) {
  const userId = i.user.id;
  const r = timers.get(userId);
  if (!r) {
    return i.reply({ content: 'Aucune session en cours.', flags: MessageFlags.Ephemeral });
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsedMin = Math.max(1, Math.round((now - r.startedAtSec) / 60));
  const xp = Math.max(1, Math.floor(elapsedMin * 0.3));

  commitSession(i.user.id, r.startedAtSec, elapsedMin, 'aborted', r.skill || null, r.subject || null, r.houseRoleId || null);
  const at = now;
  if (r.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, r.houseRoleId);
  else sql.insertXP.run(userId, xp, at);

  const houseName = houseNameFromRoleId(r.houseRoleId ?? undefined);
  const embed = new EmbedBuilder().setTitle('Session interrompue').setDescription(failLine(houseName, xp)).setColor(0xc62828);

  timers.delete(userId);
  await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// -------- Daily --------

const CLAIM_COOLDOWN_SEC = 20 * 60 * 60; // 20h

export async function handleDailyButton(i: ButtonInteraction) {
  const userId = i.user.id;
  const now = Math.floor(Date.now() / 1000);

  const row = sql.getDaily.get(userId) as { last_claim_ts?: number; streak?: number } | undefined;
  const last = row?.last_claim_ts ?? 0;
  let streak = row?.streak ?? 0;

  const delta = now - last;
  if (last && delta < CLAIM_COOLDOWN_SEC) {
    const remain = CLAIM_COOLDOWN_SEC - delta;
    const hrs = Math.floor(remain / 3600);
    const mins = Math.ceil((remain % 3600) / 60);
    return i.reply({
      content: `🕒 Trop tôt ! Reviens dans **${hrs}h ${mins}m**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!last || delta < 48 * 3600) streak = Math.min((streak || 0) + 1, 7);
  else streak = 1;

  const member = i.inGuild() ? i.guild!.members.cache.get(userId) : null;
  const houseRoleId = member ? houses.find(h => member.roles.cache.has(h.roleId))?.roleId ?? null : null;
  const houseName = houseNameFromRoleId(houseRoleId ?? undefined);

  const baseGold = 25;
  const baseXP = 15;
  const bonus = Math.round((streak - 1) * 0.2 * baseXP);
  const totalXP = baseXP + bonus;
  const totalGold = baseGold + Math.floor(streak / 2) * 5;

  sql.upsertUser.run(userId);
  sql.addGold.run(totalGold, userId);
  const at = now;
  if (houseRoleId) sql.insertXPWithHouse.run(userId, totalXP, at, houseRoleId);
  else sql.insertXP.run(userId, totalXP, at);

  const drop = rollLootForUser(userId, houseRoleId ?? undefined);
  if (drop) sql.insertLoot.run(userId, drop.key, houseRoleId, drop.rarity, at);

  sql.upsertDaily.run(userId, now, streak);

  const lootLine = drop ? `\n${drop.emoji ?? '🎁'} Butin: **${drop.name}** (${drop.rarity})` : '';
  const embed = new EmbedBuilder()
    .setTitle(`Récompense quotidienne — ${houseName}`)
    .setDescription(`Tu gagnes **${totalGold} 🪙** et **${totalXP} XP** (streak: ${streak}).${lootLine}`)
    .setColor(0xff9800);

  await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// -------- Panneaux additionnels : Profile / Leaderboard / Shop --------

import * as profileCmd from '../commands/profile';
export async function handleProfileOpen(i: ButtonInteraction) {
  return (profileCmd as any).execute(i as any);
}

import * as leaderboardCmd from '../commands/leaderboard';
export async function handleLeaderboardRefresh(i: ButtonInteraction) {
  return (leaderboardCmd as any).execute(i as any);
}

import * as shopCmd from '../commands/shop';
export async function handleShopOpen(i: ButtonInteraction) {
  return (shopCmd as any).execute(i as any);
}

/* -------- Achat depuis la boutique (bouton 'shop:buy:<id>') -------- */
export async function handleShopBuy(i: ButtonInteraction) {
  const m = /^shop:buy:(\d+)$/.exec(i.customId);
  if (!m) return;
  const offerId = Number(m[1]);

  const res = buyShopOffer(i.user.id, offerId);
  if (!res.ok) {
    const reason =
      res.reason === 'or insuffisant' ? 'or insuffisant' :
      res.reason === 'offre introuvable' ? 'offre introuvable' :
      res.reason === 'offre non liée à cet utilisateur' ? 'offre non liée' :
      res.reason === 'déjà achetée' ? 'déjà achetée' :
      'conflit';
    return i.reply({ content: `❌ Achat impossible (${reason}).`, flags: MessageFlags.Ephemeral });
  }

  const goldRow = sql.getGold.get(i.user.id) as { gold?: number } | undefined;
  const left = goldRow?.gold ?? 0;
  await i.reply({ content: `✅ Achat effectué ! Or restant : **${left}** 🪙`, flags: MessageFlags.Ephemeral });

}
