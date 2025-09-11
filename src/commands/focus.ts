// src/commands/focus.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { startFocusSession, endFocusSession } from '../services/focus';
import { houses } from '../lib/houses';

// ===== Mémoire locale des sessions en cours (par user) =====
const activeStarts = new Map<string, number>();

// ===== Définition de la commande /focus =====
export const data = new SlashCommandBuilder()
  .setName('focus')
  .setDescription('Démarrer / terminer une séance de focus.')
  .addSubcommand((sub) =>
    sub
      .setName('start')
      .setDescription('Démarrer une séance de focus.')
      .addIntegerOption((o) =>
        o
          .setName('minutes')
          .setDescription('Durée cible (optionnelle)')
          .setMinValue(5),
      ),
  )
  .addSubcommand((sub) => sub.setName('stop').setDescription('Terminer la séance en cours.'));

// ===== Routeur d’exécution =====
export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  if (sub === 'start') return handleStart(interaction);
  if (sub === 'stop') return handleStop(interaction);
}

// ===== Sous-commande: start =====
async function handleStart(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const targetMin = interaction.options.getInteger('minutes') ?? undefined;

  if (activeStarts.has(userId)) {
    await interaction.reply({
      content: 'Tu as déjà une séance en cours.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const startedAt = Math.floor(Date.now() / 1000);
  activeStarts.set(userId, startedAt);
  startFocusSession(userId, startedAt, targetMin);

  await interaction.reply({
    content: `🔔 Séance démarrée${targetMin ? ` pour ${targetMin} min` : ''}. Bon focus !`,
    flags: MessageFlags.Ephemeral,
  });
}

// ===== Sous-commande: stop =====
async function handleStop(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const startedAt = activeStarts.get(userId);

  if (!startedAt) {
    await interaction.reply({
      content: 'Tu n’as pas de séance en cours.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = interaction.guild;
  const member = guild ? await guild.members.fetch(userId) : null;
  const houseRole = member?.roles.cache.find((r) => houses.some((h) => h.roleId === r.id));
  const houseRoleId = houseRole?.id ?? null;

  const { gold, xp, durationMin, drop } = endFocusSession(userId, houseRoleId, startedAt);
  activeStarts.delete(userId);

  const embed = new EmbedBuilder()
    .setTitle('Séance de focus terminée')
    .setDescription(`Bien joué${houseRole ? ` — ${houseRole.name}` : ''} !`)
    .addFields(
      { name: '⏱️ Durée', value: `${durationMin} min`, inline: true },
      { name: '💰 Or', value: `+${gold}`, inline: true },
      { name: '⭐ EXP', value: `+${xp}`, inline: true },
      ...(drop
        ? [
            {
              name: '🎁 Butin',
              value: `${drop.emoji ?? '🎁'} **${drop.name}** (${drop.rarity})`,
              inline: false,
            },
          ]
        : []),
    )
    .setColor(0x4caf50);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
