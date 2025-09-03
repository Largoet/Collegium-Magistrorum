import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { sql } from '../lib/db';

const SHOP = [
  { id: 'xp20', label: 'Boost +20 XP', price: 10, desc: 'Ajoute 20 XP instantanément.' },
  { id: 'xp50', label: 'Boost +50 XP', price: 25, desc: 'Ajoute 50 XP instantanément.' },
];

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Affiche la boutique (dépense ton or)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const g = sql.getGold.get(userId) as { gold: number } | undefined;
  const gold = Number(g?.gold ?? 0);

  const lines = SHOP.map(it => `• **${it.label}** — ${it.price} 🪙\n  _${it.desc}_`).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('🛒 Boutique')
    .setDescription(lines)
    .addFields({ name: 'Ton or', value: `${gold} 🪙`, inline: true })
    .setColor(0x9c27b0);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
