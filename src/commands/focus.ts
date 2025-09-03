// src/commands/focus.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
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
import { rollLoot } from '../lib/loot';

export const data = new SlashCommandBuilder()
  .setName('focus')
  .setDescription('Démarrer une session de focus (type Pomodoro)')
  .addIntegerOption(o =>
    o.setName('minutes')
      .setDescription('Durée de la session')
      .setChoices(
        { name: '1',  value: 1  },   // test rapide
        { name: '15', value: 15 },
        { name: '25', value: 25 },
        { name: '30', value: 30 },
        { name: '45', value: 45 },
        { name: '60', value: 60 },
      )
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName('skill')
      .setDescription('Compétence/discipline travaillée (ex: Linux, Maths, Docker)')
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName('sujet')
      .setDescription('Sujet ou objectif (optionnel)')
      .setRequired(false)
  );

type TimerInfo = {
  startTs: number;
  minutes: number;
  skill: string;
  sujet: string | null;
  houseRoleId?: string | null;
  notifyTimeout?: NodeJS.Timeout;
};

const timers = new Map<string, TimerInfo>();

export async function execute(interaction: ChatInputCommandInteraction) {
  const minutes = interaction.options.getInteger('minutes', true);
  const skill = interaction.options.getString('skill', true);
  const sujet = interaction.options.getString('sujet');
  const userId = interaction.user.id;

  // Annule une éventuelle session précédente
  timers.delete(userId);

  // Guilde active
  let houseRoleId: string | null = null;
  if (interaction.inGuild()) {
    try {
      const member = await interaction.guild!.members.fetch(userId);
      const current = houses.find(h => member.roles.cache.has(h.roleId));
      houseRoleId = current?.roleId ?? null;
    } catch { /* ignore */ }
  }
  const houseName = houseNameFromRoleId(houseRoleId);

  const startTs = Math.floor(Date.now() / 1000);
  const endTs = startTs + minutes * 60;

  const embed = new EmbedBuilder()
    .setTitle('🎯 Session de focus')
    .setDescription(
      [
        introLine(houseName, minutes, skill), // RP intro ✨
        sujet ? `*${sujet}*` : null,
        '',
        `Fin prévue : <t:${endTs}:t>`,
      ].filter(Boolean).join('\n')
    )
    .setColor(0x4caf50);

  const validateBtn = new ButtonBuilder()
    .setCustomId('focus-validate')
    .setLabel('Valider')
    .setStyle(ButtonStyle.Success);

  const abortBtn = new ButtonBuilder()
    .setCustomId('focus-abort')
    .setLabel('Interrompu')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(validateBtn, abortBtn);

  const msg = await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  // ⏰ Notification de fin (DM, sinon fallback salon)
  const notifyTimeout = setTimeout(async () => {
    const pretty = `⏰ Focus terminé (${minutes} min) sur **${skill}**.`;

    // 1) DM
    try {
      await interaction.user.send(
        `${pretty}\nClique **Valider** ou **Interrompre** sur le message du bot.\n` +
        `Fin : <t:${endTs}:R> (il y a peu).`
      );
      return;
    } catch {
      // 2) Fallback salon
      if (interaction.inGuild() && interaction.channel) {
        try {
          await interaction.channel.send({
            content: `⏰ <@${userId}> ${pretty} Clique **Valider** sur le message du bot.`,
            allowedMentions: { users: [userId] },
          });
        } catch { /* ignore */ }
      }
    }
  }, minutes * 60 * 1000);

  // Mémorise la session
  timers.set(userId, {
    startTs,
    minutes,
    skill,
    sujet: sujet ?? null,
    houseRoleId,
    notifyTimeout,
  });

  // Collector pour clics (durée: session + 10 min)
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: (minutes + 10) * 60 * 1000,
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== userId) {
      return btn.reply({
        content: 'Seul l’initiateur peut valider/interrompre cette session.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const info = timers.get(userId);
    if (!info) {
      return btn.reply({ content: 'Session expirée ou introuvable.', flags: MessageFlags.Ephemeral });
    }

    const now = Math.floor(Date.now() / 1000);
    const finished = now >= info.startTs + info.minutes * 60;

    if (btn.customId === 'focus-validate') {
      if (!finished) {
        const remaining = (info.startTs + info.minutes * 60) - now;
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        return btn.reply({ content: `⏳ Pas encore fini. Il reste **${min}m ${sec}s**.`, flags: MessageFlags.Ephemeral });
      }

      if (info.notifyTimeout) clearTimeout(info.notifyTimeout);

      // 1) XP = minutes
      commitSession(userId, info.startTs, info.minutes, 'done', info.skill, info.sujet, info.houseRoleId);

      // 2) Or : ~1 pièce / 25 min + petit bonus si ≥15 min
      let gold = Math.floor(info.minutes / 25);
      if (info.minutes >= 15 && Math.random() < 0.15) gold += 1;
      if (gold > 0) sql.addGold.run(gold, userId);

      // 3) Loot aléatoire (tag guilde)
      const drop = rollLoot(info.houseRoleId);
      if (drop) {
        const ts = Math.floor(Date.now() / 1000);
        sql.insertLoot.run(userId, drop.key, info.houseRoleId ?? null, drop.rarity, ts);
      }
      const lootStr = drop ? `${drop.emoji ?? ''} ${drop.name} (${drop.rarity})` : undefined;

      await btn.update({
        content: victoryLine(houseName, info.minutes, info.minutes, gold, lootStr),
        embeds: [],
        components: [],
      });

      timers.delete(userId);
      collector.stop();
      return;
    }

    if (btn.customId === 'focus-abort') {
      if (info.notifyTimeout) clearTimeout(info.notifyTimeout);

      // Ici: 0 XP en cas d’abandon (MVP)
      commitSession(userId, info.startTs, 0, 'aborted', info.skill, info.sujet, info.houseRoleId);

      await btn.update({
        content: failLine(houseName, 0),
        embeds: [],
        components: [],
      });

      timers.delete(userId);
      collector.stop();
      return;
    }
  });

  collector.on('end', () => {
    const infoEnd = timers.get(userId);
    if (infoEnd?.notifyTimeout) clearTimeout(infoEnd.notifyTimeout);
    timers.delete(userId);
  });
}
