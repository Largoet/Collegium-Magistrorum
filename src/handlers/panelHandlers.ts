// src/handlers/panelHandlers.ts
import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  MessageFlags,
  AttachmentBuilder,
} from 'discord.js';

import { sql, buyShopOffer } from '../lib/db';
import { renderProfileCard } from '../lib/renderProfileCard';

// Réutilise la logique /focus (verrou + carte publique)
import { startFocusSession, hasRunning } from '../services/focus';

/* -----------------------------
 * Focus (boutons + modale)
 * ----------------------------- */

// Boutons 15/25/45/60 + Personnalisé
export async function handleFocusButton(i: ButtonInteraction) {
  if (!i.customId.startsWith('panel:focus:')) return;

  const [, , kind] = i.customId.split(':'); // panel:focus:{15|25|45|60|custom}

  if (kind === 'custom') {
    const modal = new ModalBuilder()
      .setCustomId('modal:focus:custom')
      .setTitle('Nouvelle session Focus');

    const minutes = new TextInputBuilder()
      .setCustomId('focus:minutes')
      .setLabel('Durée (ex. 25)')
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

  const minutes = Number(kind);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return i.reply({ content: 'Durée invalide.', flags: MessageFlags.Ephemeral });
  }

  if (hasRunning(i.user.id)) {
    return i.reply({
      content:
        '⏳ Tu as déjà une session /focus en cours. Valide ou interrompt-la d’abord.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // ACK du bouton, on ne modifie pas le panneau
  await i.deferUpdate().catch(() => {});
  await startFocusSession(i as any, minutes);
}

// Soumission de la modale
export async function handleFocusModal(i: ModalSubmitInteraction) {
  if (i.customId !== 'modal:focus:custom') return;

  const minutes = Number(i.fields.getTextInputValue('focus:minutes') || '0');
  const skill = (i.fields.getTextInputValue('focus:skill') || 'Général').trim();
  const subject = (i.fields.getTextInputValue('focus:subject') || '').trim();

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return i.reply({ content: 'Durée invalide.', flags: MessageFlags.Ephemeral });
  }

  if (hasRunning(i.user.id)) {
    return i.reply({
      content:
        '⏳ Tu as déjà une session /focus en cours. Valide ou interrompt-la d’abord.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // ✅ ACK de la modale, sans message visible
  await i.deferUpdate().catch(() => {});
  await startFocusSession(i as any, minutes, skill, subject);
}

/* -----------------------------
 * Daily (depuis panneau)
 * ----------------------------- */
import * as dailyCmd from '../commands/daily';
export async function handleDailyButton(i: ButtonInteraction) {
  return (dailyCmd as any).execute(i as any);
}

/* -----------------------------
 * Panneaux additionnels
 * ----------------------------- */
import * as profileCmd from '../commands/profile';
export async function handleProfileOpen(i: ButtonInteraction) {
  return (profileCmd as any).execute(i as any);
}

// Carte PNG du profil
export async function handleProfileCard(i: ButtonInteraction) {
  const { buffer, filename } = await renderProfileCard(i);
  const file = new AttachmentBuilder(Buffer.from(buffer), { name: filename });
  await i.reply({ files: [file], flags: MessageFlags.Ephemeral });
}

import * as leaderboardCmd from '../commands/leaderboard';
export async function handleLeaderboardRefresh(i: ButtonInteraction) {
  return (leaderboardCmd as any).execute(i as any);
}

import * as shopCmd from '../commands/shop';
export async function handleShopOpen(i: ButtonInteraction) {
  return (shopCmd as any).execute(i as any);
}

/* Achat depuis la boutique */
export async function handleShopBuy(i: ButtonInteraction) {
  const m = /^shop:buy:(\d+)$/.exec(i.customId);
  if (!m) return;
  const offerId = Number(m[1]);

  const res = buyShopOffer(i.user.id, offerId);
  if (!res.ok) {
    const reason =
      res.reason === 'or insuffisant'
        ? 'or insuffisant'
        : res.reason === 'offre introuvable'
        ? 'offre introuvable'
        : res.reason === 'offre non liée à cet utilisateur'
        ? 'offre non liée'
        : res.reason === 'déjà achetée'
        ? 'déjà achetée'
        : 'conflit';
    return i.reply({
      content: `❌ Achat impossible (${reason}).`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const goldRow = sql.getGold.get(i.user.id) as { gold?: number } | undefined;
  const left = goldRow?.gold ?? 0;
  await i.reply({
    content: `✅ Achat effectué ! Or restant : **${left}** 🪙`,
    flags: MessageFlags.Ephemeral,
  });
}
