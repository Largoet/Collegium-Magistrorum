// src/commands/focus.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} from 'discord.js';
import { commitSession } from '../lib/db';

export const data = new SlashCommandBuilder()
  .setName('focus')
  .setDescription('Démarrer une session de focus (type Pomodoro)')
  .addIntegerOption(o =>
    o.setName('minutes')
      .setDescription('Durée de la session')
      .setChoices(
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
  timeout: NodeJS.Timeout;
  startTs: number;
  minutes: number;
  skill: string;
  sujet: string | null;
};

// Un seul timer par utilisateur (évite les doublons)
const timers = new Map<string, TimerInfo>();

export async function execute(interaction: ChatInputCommandInteraction) {
  const minutes = interaction.options.getInteger('minutes', true);
  const skill = interaction.options.getString('skill', true);
  const sujet = interaction.options.getString('sujet');
  const userId = interaction.user.id;

  // Si l’utilisateur a déjà une session en cours, on annule l’ancienne
  const existing = timers.get(userId);
  if (existing) {
    clearTimeout(existing.timeout);
    timers.delete(userId);
  }

  const startTs = Math.floor(Date.now() / 1000);
  const endTs = startTs + minutes * 60;

  const embed = new EmbedBuilder()
    .setTitle('🎯 Session de focus')
    .setDescription([
      `**${minutes} min** sur **${skill}**`,
      sujet ? `*${sujet}*` : null,
      '',
      `Fin prévue : <t:${endTs}:t>`,
    ].filter(Boolean).join('\n'))
    .setColor(0x4caf50);

  const validateBtn = new ButtonBuilder()
    .setCustomId('focus-validate')
    .setLabel('Valider')
    .setStyle(ButtonStyle.Success)
    .setDisabled(true); // désactivé jusqu’à la fin

  const abortBtn = new ButtonBuilder()
    .setCustomId('focus-abort')
    .setLabel('Interrompu')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(true); // désactivé jusqu’à la fin

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(validateBtn, abortBtn);

  // Message initial (éphémère = visible uniquement par toi)
  const msg = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  // À la fin de la session, activer les boutons
  const timeout = setTimeout(async () => {
    validateBtn.setDisabled(false);
    abortBtn.setDisabled(false);
    try {
      await interaction.editReply({ components: [row] });
    } catch (e) {
      // si le message n'est plus éditable, on ignore
      console.error('editReply failed after timer:', e);
    }
  }, minutes * 60 * 1000);

  timers.set(userId, { timeout, startTs, minutes, skill, sujet: sujet ?? null });

  // Collector pour capter le clic sur les boutons (on laisse 10 min après la fin)
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: (minutes + 10) * 60 * 1000,
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== userId) {
      return btn.reply({ content: 'Seul l’initiateur peut valider/interrompre cette session.', ephemeral: true });
    }

    // Récup info (si la Map a été vidée, on sécurise avec les options actuelles)
    const info = timers.get(userId) ?? { startTs, minutes, skill, sujet: sujet ?? null, timeout } as TimerInfo;

    // Valider = on enregistre la session "done" + XP = minutes
    if (btn.customId === 'focus-validate') {
      try {
        commitSession(userId, info.startTs, info.minutes, 'done', info.skill, info.sujet);
        await btn.update({
          content: `✅ ${info.minutes} min validées sur **${info.skill}**. +${info.minutes} XP`,
          embeds: [],
          components: [],
        });
      } catch (e) {
        console.error(e);
        await btn.update({ content: '❌ Erreur lors de la validation, réessaie.', components: [], embeds: [] });
      } finally {
        clearTimeout(info.timeout);
        timers.delete(userId);
        collector.stop();
      }
      return;
    }

    // Interrompu = on loggue la session "aborted" (0 minute, pas d’XP)
    if (btn.customId === 'focus-abort') {
      try {
        commitSession(userId, info.startTs, 0, 'aborted', info.skill, info.sujet);
        await btn.update({
          content: '❌ Session interrompue (aucune XP créditée)',
          embeds: [],
          components: [],
        });
      } catch (e) {
        console.error(e);
        await btn.update({ content: '❌ Erreur lors de l’enregistrement.', components: [], embeds: [] });
      } finally {
        clearTimeout(info.timeout);
        timers.delete(userId);
        collector.stop();
      }
      return;
    }
  });

  collector.on('end', () => {
    // sécurité : si rien n’a été cliqué, on nettoie le timer
    const info = timers.get(userId);
    if (info) {
      clearTimeout(info.timeout);
      timers.delete(userId);
    }
  });
}
