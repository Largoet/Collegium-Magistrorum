import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { houses } from '../lib/houses';

export const data = new SlashCommandBuilder()
  .setName('houses-panel')
  .setDescription('Publie le panneau de choix de guilde dans ce salon')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles); // évite le spam

export async function execute(i: ChatInputCommandInteraction) {
  if (!i.inGuild()) return i.reply({ content: 'À utiliser dans un serveur.', ephemeral: true });
  if (!houses.length) return i.reply({ content: 'HOUSE_ROLES non configuré.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle('Bienvenue ! Choisis ta guilde')
    .setDescription('Sélectionne une **guilde** ci-dessous pour recevoir le rôle correspondant.')
    .setColor(0x8bc34a);

const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId(`house:select:${i.guildId}`)
    .setPlaceholder('Sélectionne ta guilde…')
    .addOptions(
      ...houses.map(h => {
        const opt = new StringSelectMenuOptionBuilder()
          .setLabel(h.name)
          .setValue(h.roleId);
        if (h.emoji) {
          opt.setEmoji(h.emoji as any);
        }
        return opt;
      })
    )
);


  await i.reply({ embeds: [embed], components: [row] }); // visible à tous dans le salon
}
