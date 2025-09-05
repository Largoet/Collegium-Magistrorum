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
  AttachmentBuilder,
} from 'discord.js';
import { houses } from '../lib/houses';
import { commitSession, sql, buyShopOffer } from '../lib/db';
import { houseNameFromRoleId, introLine, victoryLine, failLine } from '../lib/rp';
import { rollLootForUser } from '../lib/loot';
import { renderProfileCard } from '../lib/renderProfileCard';
import { themeByRoleId } from '../lib/theme';

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
    new ButtonBuilder().setCustomId('panel:focus:validate').setLabel('Valider').setStyle(ButtonStyle.Success).setDisabled(disabledValidate),
    new ButtonBuilder().setCustomId('panel:focus:interrupt').setLabel('Interrompre').setStyle(ButtonStyle.Danger),
  );
  return [row];
}

// -------- Focus (boutons + modal) --------

export async function handleFocusButton(i: ButtonInteraction) {
  const [, , kind] = i.customId.split(':'); // panel:focus:{15|25|45|60|custom}

  if (kind === 'custom') {
    const modal = new ModalBuilder().setCustomId('modal:focus:custom').setTitle('Nouvelle session Focus');

    const minutes = new TextInputBuilder().setCustomId('focus:minutes').setLabel('Durée (minutes, ex. 25)').setRequired(true).setStyle(TextInputStyle.Short);
    const skill = new TextInputBuilder().setCustomId('focus:skill').setLabel('Compétence (ex. Docker, Lecture)').setRequired(true).setStyle(TextInputStyle.Short);
    const subject = new TextInputBuilder().setCustomId('focus:subject').setLabel('Sujet / note (optionnel)').setRequired(false).setStyle(TextInputStyle.Short);

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
  const theme = themeByRoleId(houseRoleId ?? undefined);

  const enableAtSec = startedAtSec + minutes * 60;
  timers.set(userId, { startedAtSec, minutes, skill, subject, houseRoleId, enableAtSec });

  const endTag = `<t:${enableAtSec}:t>`;
  const embed = new EmbedBuilder()
    .setTitle(`${theme.icon} Focus — ${houseName}`)
    .setDescription(`${introLine(houseName, minutes, skill)}\n\n**Fin prévue :** ${endTag}`)
    .setColor(theme.color)
    .setTimestamp(new Date(enableAtSec * 1000));

  await i.reply({ embeds: [embed], components: componentsForSession(false), flags: MessageFlags.Ephemeral });

  const editColor = async (hex: number, note: string) => {
    const e2 = EmbedBuilder.from(embed).setColor(hex).setDescription(`${introLine(houseName, minutes, skill)}\n\n${note}\n**Fin prévue :** ${endTag}`);
    try { await i.editReply({ embeds: [e2] }); } catch {}
  };

  const msTo = (sec: number) => Math.max(0, sec * 1000 - Date.now());
  if (minutes * 60 > 5 * 60) setTimeout(() => editColor(0xff9800, '⏳ **5 minutes restantes…**'), msTo(enableAtSec - 5 * 60));
  if (minutes * 60 > 60)   setTimeout(() => editColor(0xe53935, '⏳ **1 minute restante…**'),   msTo(enableAtSec - 60));
}

export async function handleFocusValidate(i: ButtonInteraction) {
  const userId = i.user.id;
  const r = timers.get(userId);
  if (!r) return i.reply({ content: 'Aucune session en cours.', flags: MessageFlags.Ephemeral });

  const now = Math.floor(Date.now() / 1000);
  if (now < r.enableAtSec) {
    const remaining = Math.max(0, r.enableAtSec - now);
    return i.reply({ content: `⏳ Pas encore ! Il reste **${Math.ceil(remaining / 60)} min**.`, flags: MessageFlags.Ephemeral });
  }

  const elapsedMin = Math.max(1, Math.round((now - r.startedAtSec) / 60));
  const xp = elapsedMin;
  const gold = Math.floor(elapsedMin / 15);

  commitSession(i.user.id, r.startedAtSec, elapsedMin, 'done', r.skill || null, r.subject || null, r.houseRoleId || null);
  const at = now;
  if (r.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, r.houseRoleId); else sql.insertXP.run(userId, xp, at);
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
  if (!r) return i.reply({ content: 'Aucune session en cours.', flags: MessageFlags.Ephemeral });

  const now = Math.floor(Date.now() / 1000);
  const elapsedMin = Math.max(1, Math.round((now - r.startedAtSec) / 60));
  const xp = Math.max(1, Math.floor(elapsedMin * 0.3));

  commitSession(i.user.id, r.startedAtSec, elapsedMin, 'aborted', r.skill || null, r.subject || null, r.houseRoleId || null);
  const at = now;
  if (r.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, r.houseRoleId); else sql.insertXP.run(userId, xp, at);

  const houseName = houseNameFromRoleId(r.houseRoleId ?? undefined);
  const embed = new EmbedBuilder().setTitle('Session interrompue').setDescription(failLine(houseName, xp)).setColor(0xc62828);

  timers.delete(userId);
  await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

/* -------- Daily (depuis panneau) -------- */
import * as dailyCmd from '../commands/daily';
export async function handleDailyButton(i: ButtonInteraction) {
  return (dailyCmd as any).execute(i as any);
}

/* -------- Panneaux additionnels -------- */
import * as profileCmd from '../commands/profile';
export async function handleProfileOpen(i: ButtonInteraction) { return (profileCmd as any).execute(i as any); }

// Carte PNG du profil
export async function handleProfileCard(i: ButtonInteraction) {
  const { buffer, filename } = await renderProfileCard(i);
  const file = new AttachmentBuilder(Buffer.from(buffer), { name: filename });
  await i.reply({ files: [file], flags: MessageFlags.Ephemeral });
}

import * as leaderboardCmd from '../commands/leaderboard';
export async function handleLeaderboardRefresh(i: ButtonInteraction) { return (leaderboardCmd as any).execute(i as any); }

import * as shopCmd from '../commands/shop';
export async function handleShopOpen(i: ButtonInteraction) { return (shopCmd as any).execute(i as any); }

/* Achat depuis la boutique */
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
      res.reason === 'déjà achetée' ? 'déjà achetée' : 'conflit';
    return i.reply({ content: `❌ Achat impossible (${reason}).`, flags: MessageFlags.Ephemeral });
  }

  const goldRow = sql.getGold.get(i.user.id) as { gold?: number } | undefined;
  const left = goldRow?.gold ?? 0;
  await i.reply({ content: `✅ Achat effectué ! Or restant : **${left}** 🪙`, flags: MessageFlags.Ephemeral });
}
