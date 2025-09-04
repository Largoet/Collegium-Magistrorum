// src/commands/inventory.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { sql } from '../lib/db';
import { houses } from '../lib/houses';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Affiche ton or et tes derniers objets trouvés');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const g = sql.getGold.get(userId) as { gold: number } | undefined;
  const gold = Number(g?.gold ?? 0);

  const rows = (sql.recentLoot?.all(userId) ?? []) as Array<{ item_key: string; rarity: string; house_role_id: string | null; obtained_at: number }>;

  const lines = rows.length
    ? rows.map(r => {
        const hName = houses.find(h => h.roleId === r.house_role_id)?.name ?? '—';
        const when = `<t:${r.obtained_at}:R>`;
        return `• **${r.item_key}** (${r.rarity}) — ${hName} • ${when}`;
      }).join('\n')
    : '—';

  const embed = new EmbedBuilder()
    .setTitle(`🎒 Inventaire de ${interaction.user.username}`)
    .addFields(
      { name: 'Or', value: `${gold} 🪙`, inline: true },
      { name: 'Derniers objets', value: lines }
    )
    .setColor(0xffc107);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
