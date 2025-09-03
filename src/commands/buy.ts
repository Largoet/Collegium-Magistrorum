import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { houses } from '../lib/houses';
import { purchaseXPBoost, sql } from '../lib/db';

const CATALOG = {
  xp20: { xp: 20, price: 10, label: 'Boost +20 XP' },
  xp50: { xp: 50, price: 25, label: 'Boost +50 XP' },
} as const;

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Achète un objet de la boutique')
  .addStringOption(o =>
    o.setName('item')
      .setDescription('Objet à acheter')
      .setRequired(true)
      .addChoices(
        { name: 'Boost +20 XP (10 🪙)', value: 'xp20' },
        { name: 'Boost +50 XP (25 🪙)', value: 'xp50' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const itemKey = interaction.options.getString('item', true) as keyof typeof CATALOG;
  const item = CATALOG[itemKey];

  // tag de guilde (optionnel pour l’XP achetée)
  let houseRoleId: string | null = null;
  if (interaction.inGuild()) {
    try {
      const member = await interaction.guild!.members.fetch(userId);
      const current = houses.find(h => member.roles.cache.has(h.roleId));
      houseRoleId = current?.roleId ?? null;
    } catch { /* ignore */ }
  }

  const ok = purchaseXPBoost(userId, item.xp, item.price, houseRoleId);

  if (!ok) {
    // afficher l’or actuel pour aider
    const g = sql.getGold.get(userId) as { gold: number } | undefined;
    const gold = Number(g?.gold ?? 0);
    return interaction.reply({
      content: `❌ Pas assez d’or. Il te faut **${item.price} 🪙**, tu as **${gold} 🪙**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('Achat confirmé')
    .setDescription(`Tu as acheté **${item.label}**.\n✅ +${item.xp} XP appliqués ${houseRoleId ? 'à ta guilde actuelle' : ''}.`)
    .setColor(0x4caf50);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
