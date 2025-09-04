import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('focus-panel')
  .setDescription('Publie le panneau Focus (boutons rapides + personnalisé).')
  .setDMPermission(false);

export async function execute(i: ChatInputCommandInteraction) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('panel:focus:15').setLabel('15 min').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('panel:focus:25').setLabel('25 min').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('panel:focus:45').setLabel('45 min').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('panel:focus:60').setLabel('60 min').setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:focus:custom')
      .setLabel('Personnalisé…')
      .setStyle(ButtonStyle.Secondary),
  );

  await i.reply({
    content: '🎯 **Focus** — Choisis une durée ou configure ta session.',
    components: [row1, row2],
  });
}
