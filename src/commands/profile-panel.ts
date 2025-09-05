import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { houses } from '../lib/houses';
import { themeByRoleId } from '../lib/theme';

export const data = new SlashCommandBuilder()
  .setName('profile-panel')
  .setDescription('Panneau: clique pour ouvrir ton profil ou générer une carte PNG');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const member = interaction.inGuild() ? interaction.guild!.members.cache.get(userId) : null;
  const houseRoleId = member ? houses.find(h => member.roles.cache.has(h.roleId))?.roleId ?? null : null;
  const theme = themeByRoleId(houseRoleId ?? undefined);

  const embed = new EmbedBuilder()
    .setTitle('🧭 Profil du Collegium')
    .setDescription('Clique sur un des boutons ci-dessous.')
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? (null as any));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:profile:open')
      .setLabel('Voir mon profil')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:profile:card')
      .setLabel('Carte PNG')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}
