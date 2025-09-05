// src/commands/shop-panel.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('shop-panel')
  .setDescription('Publie le panneau Boutique (bouton)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🛒 Boutique du Collegium')
    .setDescription('Clique pour voir la boutique du jour (offres liées à ta guilde).');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('panel:shop:open').setLabel('Voir la boutique').setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}
