import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('daily-panel')
  .setDescription('Publie le panneau Daily (récompense quotidienne).')
  .setDMPermission(false);

export async function execute(i: ChatInputCommandInteraction) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:daily:claim')
      .setLabel('Réclamer ma récompense')
      .setStyle(ButtonStyle.Success),
  );

  await i.reply({
    content: '🗓️ **Daily** — Réclame ta récompense quotidienne.',
    components: [row],
  });
}
