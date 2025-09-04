// src/commands/buy.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { buyShopOffer, sql } from '../lib/db';

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Acheter une offre de la boutique (ID depuis /shop)')
  .addIntegerOption(o => o.setName('offre').setDescription('ID de l’offre').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getInteger('offre', true);
  const res = buyShopOffer(interaction.user.id, id);
  if (!res.ok) {
    return interaction.reply({ content: `❌ Achat impossible (${res.reason}).`, flags: MessageFlags.Ephemeral });
  }
  const goldRow = sql.getGold.get(interaction.user.id) as { gold: number };
  return interaction.reply({ content: `✅ Achat effectué. Or restant : **${goldRow?.gold ?? 0}** 🪙`, flags: MessageFlags.Ephemeral });
}
