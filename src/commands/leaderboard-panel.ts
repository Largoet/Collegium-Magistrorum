import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard-panel')
  .setDescription('Publie un panneau Classement avec un bouton de rafraîchissement.')
  .setDMPermission(false);

export async function execute(i: ChatInputCommandInteraction) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:leaderboard:refresh')
      .setLabel('Rafraîchir')
      .setStyle(ButtonStyle.Secondary),
  );

  await i.reply({
    content: '🏆 **Panthéon** — Classement des 30 derniers jours. Rafraîchis pour voir les dernières positions.',
    components: [row],
  });
}
