// src/services/focus.ts
import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { commitSession, sql } from '../lib/db';
import { houses } from '../lib/houses';
import { houseNameFromRoleId, introLine, victoryLine, failLine } from '../lib/rp';
import { rollLootForUser } from '../lib/loot';
import { themeByRoleId } from '../lib/theme';

export type FocusInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;

type FocusState = {
  startedAtSec: number;
  enableAtSec: number;
  minutes: number;
  skill: string;
  subject: string;
  houseRoleId: string | null;
  messageId?: string;
  pingMessageId?: string; // ping de fin à supprimer lors de la clôture
};

const running = new Map<string, FocusState>(); // verrou utilisateur (cross-device)

function replyEphemeral(i: any, content: string) {
  const payload = { content, flags: MessageFlags.Ephemeral as number };
  if (i.replied || i.deferred) return i.followUp?.(payload).catch(() => {});
  return i.reply?.(payload).catch(() => {});
}

function getUserHouseRoleId(i: FocusInteraction): string | null {
  if (!('inGuild' in i) || !i.inGuild()) return null;
  const member = i.guild!.members.cache.get(i.user.id);
  const h = houses.find(hh => member?.roles.cache.has(hh.roleId));
  return h?.roleId ?? null;
}

export function hasRunning(userId: string) {
  return running.has(userId);
}

export async function startFocusSession(
  interaction: FocusInteraction,
  minutes: number,
  skill = 'Général',
  subject = ''
) {
  const userId = interaction.user.id;

  // 🔒 verrou global
  if (running.has(userId)) {
    return replyEphemeral(interaction, '⏳ Tu as déjà une session /focus en cours. Valide ou interrompt-la d’abord.');
  }

  const startedAtSec = Math.floor(Date.now() / 1000);
  const enableAtSec = startedAtSec + minutes * 60;

  const houseRoleId = getUserHouseRoleId(interaction);
  const houseName = houseNameFromRoleId(houseRoleId ?? undefined);
  const theme = themeByRoleId(houseRoleId ?? undefined);

  const state: FocusState = {
    startedAtSec,
    enableAtSec,
    minutes,
    skill: skill.trim(),
    subject: subject.trim(),
    houseRoleId,
  };
  running.set(userId, state);

  // Petit OK éphémère
  await replyEphemeral(interaction, `✅ Ta séance de ${minutes} min est lancée.`);

  const endInlineTs = `<t:${enableAtSec}:t>`;
  const baseEmbed = new EmbedBuilder()
    .setTitle(`${theme.icon} Focus — ${houseName}`)
    .setDescription(`${introLine(houseName, minutes, skill)}\n\n**Fin prévue :** ${endInlineTs}`)
    .setColor(theme.color)
    .setTimestamp(new Date(enableAtSec * 1000));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('slash:focus:validate').setLabel('Valider').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('slash:focus:interrupt').setLabel('Interrompre').setStyle(ButtonStyle.Danger),
  );

  // 🧱 carte PUBLIQUE
  const chan: any = (interaction as any).channel;
  if (!chan || typeof chan.send !== 'function') return;
  const sessionMsg = await chan.send({ embeds: [baseEmbed], components: [row] });
  state.messageId = sessionMsg.id;

  // ⏳ signaux T-5 et T-1 (si pertinents)
  const msTo = (sec: number) => Math.max(0, sec * 1000 - Date.now());
  const tint = async (hex: number, note: string) => {
    const e2 = EmbedBuilder.from(baseEmbed)
      .setColor(hex)
      .setDescription(`${introLine(houseName, minutes, skill)}\n\n${note}\n**Fin prévue :** ${endInlineTs}`);
    try { await sessionMsg.edit({ embeds: [e2] }); } catch {}
  };
  if (minutes >= 10) setTimeout(() => tint(0xff9800, '⏳ **5 minutes restantes…**'), msTo(enableAtSec - 5 * 60));
  if (minutes >= 2)  setTimeout(() => tint(0xe53935, '⏳ **1 minute restante…**'),   msTo(enableAtSec - 60));

  // 🎛️ collector SANS limite de temps (reste actif jusqu’à suppression de la carte)
  const collector = sessionMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (btn: any) =>
      btn.user.id === userId &&
      (btn.customId === 'slash:focus:validate' || btn.customId === 'slash:focus:interrupt'),
  });

  async function cleanupAfterClose(kind: 'validated' | 'aborted') {
    // supprime la carte
    try { await sessionMsg.delete(); } catch {}
    // supprime le ping de fin, s'il existe
    try {
      if (state.pingMessageId) {
        const pingMsg = await chan.messages.fetch(state.pingMessageId).catch(() => null);
        if (pingMsg) await pingMsg.delete().catch(() => {});
      }
    } catch {}
    // DM + petit toast
    try {
      await (interaction as any).user.send(kind === 'validated' ? '✅ Séance validée. Bien joué !' : '⏹️ Séance interrompue.');
    } catch {}
    try {
      const toast = await chan.send(`${(interaction as any).user} ${kind === 'validated' ? '✅ séance validée.' : '⏹️ séance interrompue.'}`);
      setTimeout(() => toast.delete().catch(() => {}), 15000);
    } catch {}
  }

  collector.on('collect', async (btn: any) => {
    const now = Math.floor(Date.now() / 1000);

    // === Valider ===
    if (btn.customId === 'slash:focus:validate') {
      if (now < state.enableAtSec) {
        const mins = Math.ceil((state.enableAtSec - now) / 60);
        return btn.reply({ content: `🕒 Trop tôt. Il reste **${mins} min**.`, flags: MessageFlags.Ephemeral });
      }

      const elapsedMin = Math.max(1, Math.round((now - state.startedAtSec) / 60));
      const xp = elapsedMin;
      const gold = Math.floor(elapsedMin / 15);

      commitSession(userId, state.startedAtSec, elapsedMin, 'done', state.skill || null, state.subject || null, state.houseRoleId || null);
      const at = now;
      if (state.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, state.houseRoleId);
      else sql.insertXP.run(userId, xp, at);
      if (gold > 0) sql.addGold.run(gold, userId);

      const drop = rollLootForUser(userId, state.houseRoleId ?? undefined);
      if (drop) sql.insertLoot.run(userId, drop.key, state.houseRoleId, drop.rarity, at);

      const lootStr = drop ? `${drop.emoji ?? '🎁'} ${drop.name} (${drop.rarity})` : undefined;
      const doneEmbed = new EmbedBuilder()
        .setTitle('Session validée ✅')
        .setDescription(victoryLine(houseName, elapsedMin, xp, gold, lootStr))
        .setColor(0x2e7d32);

      running.delete(userId);
      try { await btn.deferUpdate(); } catch {}
      await cleanupAfterClose('validated');
      return;
    }

    // === Interrompre ===
    if (btn.customId === 'slash:focus:interrupt') {
      const elapsedMin = Math.max(1, Math.round((now - state.startedAtSec) / 60));
      const xp = Math.max(1, Math.floor(elapsedMin * 0.3));

      commitSession(userId, state.startedAtSec, elapsedMin, 'aborted', state.skill || null, state.subject || null, state.houseRoleId || null);
      const at = now;
      if (state.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, state.houseRoleId);
      else sql.insertXP.run(userId, xp, at);

      const failEmbed = new EmbedBuilder()
        .setTitle('Session interrompue')
        .setDescription(failLine(houseName, xp))
        .setColor(0xc62828);

      running.delete(userId);
      try { await btn.deferUpdate(); } catch {}
      await cleanupAfterClose('aborted');
      return;
    }
  });

  // ⏰ Fin de séance : on notifie mais on ne libère pas (jusqu’à clic)
  setTimeout(async () => {
    if (running.get(userId) !== state) return; // déjà close

    try {
      const finished = EmbedBuilder.from(baseEmbed)
        .setTitle('⏰ Séance terminée — clique **Valider** ou **Interrompre**');
      await sessionMsg.edit({ embeds: [finished], components: [row] });
    } catch {}

    try { await (interaction as any).user.send(`⏰ Ta séance de ${minutes} min est terminée. Clique **Valider** dans le salon.`); } catch {}

    try {
      const ping = await chan.send(`${(interaction as any).user} ⏰ fin de séance — clique **Valider** ou **Interrompre**.`);
      state.pingMessageId = ping.id; // on le supprimera quand la séance sera clôturée
    } catch {}
  }, minutes * 60 * 1000);
}
