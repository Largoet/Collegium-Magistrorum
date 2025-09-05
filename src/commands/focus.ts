// src/commands/focus.ts
import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, ComponentType, MessageFlags,
} from 'discord.js';
import { commitSession, sql } from '../lib/db';
import { houses } from '../lib/houses';
import { houseNameFromRoleId, introLine, victoryLine, failLine } from '../lib/rp';
import { rollLootForUser } from '../lib/loot';
import { themeByRoleId } from '../lib/theme';

const running = new Map<string, { startedAtSec: number; enableAtSec: number; minutes: number; skill: string; subject: string; houseRoleId: string | null }>();

export const data = new SlashCommandBuilder()
  .setName('focus')
  .setDescription('Lancer une session de focus (avec validation ou interruption)')
  .addIntegerOption(o =>
    o.setName('minutes').setDescription('Durée (ex. 25)').setRequired(true)
      .addChoices({ name: '15', value: 15 }, { name: '25', value: 25 }, { name: '45', value: 45 }, { name: '60', value: 60 })
  )
  .addStringOption(o => o.setName('competence').setDescription('Compétence (ex. Lecture, Docker)').setRequired(false))
  .addStringOption(o => o.setName('sujet').setDescription('Sujet / note (optionnel)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  if (running.has(userId)) {
    return interaction.reply({ content: '⏳ Tu as déjà une session /focus en cours. Valide ou interrompt-la d’abord.', flags: MessageFlags.Ephemeral });
  }

  const minutes = interaction.options.getInteger('minutes', true);
  const skill = (interaction.options.getString('competence') || 'Général').trim();
  const subject = (interaction.options.getString('sujet') || '').trim();

  const startedAtSec = Math.floor(Date.now() / 1000);
  const enableAtSec = startedAtSec + minutes * 60;

  let houseRoleId: string | null = null;
  if (interaction.inGuild()) {
    const member = interaction.guild!.members.cache.get(userId);
    const h = houses.find(hh => member?.roles.cache.has(hh.roleId));
    houseRoleId = h?.roleId ?? null;
  }
  const houseName = houseNameFromRoleId(houseRoleId ?? undefined);
  const theme = themeByRoleId(houseRoleId ?? undefined);

  running.set(userId, { startedAtSec, enableAtSec, minutes, skill, subject, houseRoleId });

  const endInlineTs = `<t:${enableAtSec}:t>`;
  const embed = new EmbedBuilder()
    .setTitle(`${theme.icon} Focus — ${houseName}`)
    .setDescription(`${introLine(houseName, minutes, skill)}\n\n**Fin prévue :** ${endInlineTs}`)
    .setColor(theme.color)
    .setTimestamp(new Date(enableAtSec * 1000));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('slash:focus:validate').setLabel('Valider').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('slash:focus:interrupt').setLabel('Interrompre').setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });

  // animations T-5 min / T-1 min
  const editColor = async (hex: number, note: string) => {
    const e2 = EmbedBuilder.from(embed).setColor(hex).setDescription(`${introLine(houseName, minutes, skill)}\n\n${note}\n**Fin prévue :** ${endInlineTs}`);
    try { await interaction.editReply({ embeds: [e2] }); } catch {}
  };
  const msTo = (sec: number) => Math.max(0, sec * 1000 - Date.now());
  if (minutes * 60 > 5 * 60) setTimeout(() => editColor(0xff9800, '⏳ **5 minutes restantes…**'), msTo(enableAtSec - 5 * 60));
  if (minutes * 60 > 60) setTimeout(() => editColor(0xe53935, '⏳ **1 minute restante…**'), msTo(enableAtSec - 60));

  const msg: any = await interaction.fetchReply();
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: minutes * 60 * 1000 + 10 * 60 * 1000,
    filter: (btn: any) => btn.user.id === userId && (btn.customId === 'slash:focus:validate' || btn.customId === 'slash:focus:interrupt'),
  });

  collector.on('collect', async (btn: any) => {
    const r = running.get(userId);
    if (!r) return btn.reply({ content: 'Aucune session en cours.', flags: MessageFlags.Ephemeral });

    const now = Math.floor(Date.now() / 1000);

    if (btn.customId === 'slash:focus:validate') {
      if (now < r.enableAtSec) {
        const remaining = Math.max(0, r.enableAtSec - now);
        const mins = Math.ceil(remaining / 60);
        return btn.reply({ content: `⏳ Pas encore ! Il reste **${mins} min**.`, flags: MessageFlags.Ephemeral });
      }
      const elapsedMin = Math.max(1, Math.round((now - r.startedAtSec) / 60));
      const xp = elapsedMin;
      const gold = Math.floor(elapsedMin / 15);

      commitSession(userId, r.startedAtSec, elapsedMin, 'done', r.skill || null, r.subject || null, r.houseRoleId || null);
      const at = now;
      if (r.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, r.houseRoleId); else sql.insertXP.run(userId, xp, at);
      if (gold > 0) sql.addGold.run(gold, userId);

      const drop = rollLootForUser(userId, r.houseRoleId ?? undefined);
      if (drop) sql.insertLoot.run(userId, drop.key, r.houseRoleId, drop.rarity, at);

      const lootStr = drop ? `${drop.emoji ?? '🎁'} ${drop.name} (${drop.rarity})` : undefined;
      const doneEmbed = new EmbedBuilder().setTitle('Session validée ✅').setDescription(victoryLine(houseName, elapsedMin, xp, gold, lootStr)).setColor(0x2e7d32);

      running.delete(userId);
      collector.stop('validated');

      try {
        const disabled = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('slash:focus:validate').setLabel('Valider').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('slash:focus:interrupt').setLabel('Interrompre').setStyle(ButtonStyle.Danger).setDisabled(true),
        );
        await btn.update({ embeds: [doneEmbed], components: [disabled] });
      } catch { await btn.reply({ embeds: [doneEmbed], flags: MessageFlags.Ephemeral }).catch(() => {}); }
      return;
    }

    if (btn.customId === 'slash:focus:interrupt') {
      const elapsedMin = Math.max(1, Math.round((now - r.startedAtSec) / 60));
      const xp = Math.max(1, Math.floor(elapsedMin * 0.3));

      commitSession(userId, r.startedAtSec, elapsedMin, 'aborted', r.skill || null, r.subject || null, r.houseRoleId || null);
      const at = now;
      if (r.houseRoleId) sql.insertXPWithHouse.run(userId, xp, at, r.houseRoleId); else sql.insertXP.run(userId, xp, at);

      const failEmbed = new EmbedBuilder().setTitle('Session interrompue').setDescription(failLine(houseName, xp)).setColor(0xc62828);

      running.delete(userId);
      collector.stop('aborted');

      try {
        const disabled = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('slash:focus:validate').setLabel('Valider').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('slash:focus:interrupt').setLabel('Interrompre').setStyle(ButtonStyle.Danger).setDisabled(true),
        );
        await btn.update({ embeds: [failEmbed], components: [disabled] });
      } catch { await btn.reply({ embeds: [failEmbed], flags: MessageFlags.Ephemeral }).catch(() => {}); }
      return;
    }
  });

  collector.on('end', async (_c: any, reason: string) => {
    if (reason === 'time' && running.has(userId)) return;
  });

  setTimeout(async () => {
    const r = running.get(userId);
    if (!r) return;
    try {
      await interaction.followUp({ content: `⏰ Session terminée pour <@${userId}> — clique **Valider** ou **Interrompre**.`, flags: MessageFlags.Ephemeral });
    } catch {}
  }, minutes * 60 * 1000);
}
