import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('shop-panel')
  .setDescription('Publie un panneau Boutique avec un bouton pour ouvrir le catalogue.')
  .setDMPermission(false);

export async function execute(i: ChatInputCommandInteraction) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:shop:open')
      .setLabel('Ouvrir la boutique')
      .setStyle(ButtonStyle.Success),
  );

  await i.reply({
    content: '💰 **Boutique** — Ouvre le catalogue du jour en privé.',
    components: [row],
  });
}
