// src/commands/shop-panel.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('shop-panel')
  .setDescription('Publie un panneau Boutique dans ce salon')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🛒 Boutique du Collegium')
    .setDescription('Objets liés à ta guilde, renouvelés chaque jour. Complète tes collections pour débloquer des bonus !')
    .setColor(0x6a1b9a);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:shop:open')
      .setLabel('Ouvrir ma boutique')
      .setStyle(ButtonStyle.Primary),
  );

  // Réponse éphémère à l’admin qui déclenche (flags au lieu de ephemeral)
  await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });

  // Publication publique dans le salon si on peut envoyer un message ici
  if (interaction.channel?.isSendable()) {
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
}
