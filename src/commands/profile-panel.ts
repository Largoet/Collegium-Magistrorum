import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('profile-panel')
  .setDescription('Publie un bouton pour ouvrir mon profil (réponse éphémère).')
  .setDMPermission(false);

export async function execute(i: ChatInputCommandInteraction) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:profile:open')
      .setLabel('Voir mon profil')
      .setStyle(ButtonStyle.Primary),
  );

  await i.reply({
    content: '🧭 **Profil** — Clique pour voir ton profil en privé.',
    components: [row],
  });
}
