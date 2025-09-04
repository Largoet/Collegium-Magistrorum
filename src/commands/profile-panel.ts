// src/commands/profile-panel.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('profile-panel')
  .setDescription('Publie un panneau Profil dans ce salon')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('📜 Profil du Collegium')
    .setDescription('Clique pour afficher ta carte de personnage (XP globale, guildes, compétences, collections).')
    .setColor(0x37474f);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('panel:profile:open').setLabel('Voir mon profil').setStyle(ButtonStyle.Primary),
  );

  // Éphémère pour l’admin qui poste
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

  // Message public dans le salon (garde de type)
  const ch = interaction.channel;
  if (ch && 'send' in ch) {
    await (ch as any).send({ embeds: [embed], components: [row] });
  }
}
