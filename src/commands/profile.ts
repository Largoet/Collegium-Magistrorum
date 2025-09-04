// src/commands/profile.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  APIEmbedField,
} from 'discord.js';
import { sql } from '../lib/db';
import { levelFromXP, progressBar } from '../lib/game';
import { houses } from '../lib/houses';
import { titleForGuildXP, GuildName } from '../lib/titles';
import { collectionProgress, collectionBonuses } from '../lib/loot';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche ta fiche personnage (progression, guildes, compétences, collections)');

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // ------- Or -------
  const goldRow = sql.getGold?.get?.(userId) as { gold?: number } | undefined;
  const gold = goldRow?.gold ?? 0;

  // ------- XP global + niveau -------
  const totalXPRow = (sql.totalXPAll?.get?.(userId) as { xp?: number } | undefined);
  const xpGlobal = totalXPRow?.xp ?? 0;

  // levelFromXP peut renvoyer un nombre OU un objet { level, into, toNext, pct }
  const lvlAny = levelFromXP(xpGlobal) as any;
  const levelNumber: number = typeof lvlAny === 'number' ? lvlAny : (lvlAny.level ?? 0);
  const into: number =
    typeof lvlAny === 'number'
      ? (xpGlobal % (100 + 50 * levelNumber))
      : (lvlAny.into ?? 0);
  const toNext: number =
    typeof lvlAny === 'number'
      ? Math.max(1, 100 + 50 * levelNumber)
      : Math.max(1, lvlAny.toNext ?? (100 + 50 * levelNumber));

  // progressBar(current, max)
  const barGlobal = progressBar(into, toNext);

  // ------- Guilde actuelle + XP par guilde -------
  const member = interaction.inGuild() ? interaction.guild!.members.cache.get(userId) : null;
  const currentHouse = member ? houses.find(h => member.roles.cache.has(h.roleId)) ?? null : null;
  const guildName = (currentHouse?.name as GuildName | undefined) ?? undefined;

  const xpByGuildRows =
    (sql.xpByGuildAllTime?.all?.(userId) as Array<{ house_role_id: string | null; xp: number }>) ?? [];
  const xpByGuildMap = new Map<GuildName, number>();
  xpByGuildRows.forEach(r => {
    const gname = houses.find(h => h.roleId === r.house_role_id)?.name as GuildName | undefined;
    if (gname) xpByGuildMap.set(gname, r.xp);
  });

  // Bloc guilde actuelle
  let guildField: APIEmbedField = { name: 'Guilde', value: 'Aucune', inline: false };
  if (guildName) {
    const gXP = xpByGuildMap.get(guildName) ?? 0;
    const { current, next, xpToNext } = titleForGuildXP(guildName, gXP);
    const span = next ? next.xp - (current?.xp ?? 0) : Math.max(1, gXP - (current?.xp ?? 0));
    const done = gXP - (current?.xp ?? 0);
    const barGuild = progressBar(done, span);

    guildField = {
      name: `Guilde actuelle — ${guildName} (${current?.name ?? '—'})`,
      value: [
        `XP: **${fmt(gXP)}**` +
          (next
            ? ` • Prochain titre: **${next.name}** dans **${fmt(xpToNext)}** XP`
            : ' • (Titre maximal atteint)'),
        `Progression: ${barGuild}`,
      ].join('\n'),
      inline: false,
    };
  }

  // Autres guildes
  const otherGuilds: string[] = [];
  (Array.from(xpByGuildMap.entries()) as Array<[GuildName, number]>)
    .filter(([g]) => !guildName || g !== guildName)
    .sort((a, b) => b[1] - a[1])
    .forEach(([g, xp]) => {
      const { current } = titleForGuildXP(g, xp);
      otherGuilds.push(`• **${g}** — ${fmt(xp)} XP (${current?.name ?? '—'})`);
    });
  const otherGuildsField =
    otherGuilds.length ? { name: 'Autres guildes', value: otherGuilds.join('\n'), inline: false } : null;

  // ------- Activité 30 jours -------
  const xp30 = (sql.totalXP30d?.get?.(userId) as { xp?: number } | undefined)?.xp ?? 0;
  const s30row = (sql.totalSessions30d?.get?.(userId) as { n?: number; c?: number } | undefined);
  const sess30 = s30row?.n ?? s30row?.c ?? 0;

  const topSkills30 =
    (sql.topSkills30d?.all?.(userId) as Array<{ skill: string; minutes: number }> | undefined) ?? [];
  const top30Str = topSkills30.length
    ? topSkills30.map((s, i) => `${i + 1}. ${s.skill} — ${fmt(s.minutes)} min`).join('\n')
    : '—';

  // ------- Compétences all-time -------
  const topSkillsAll =
    (sql.topSkillsAllTime?.all?.(userId) as Array<{ skill: string; minutes: number }> | undefined) ?? [];
  const topAllStr = topSkillsAll.length
    ? topSkillsAll
        .slice(0, 5)
        .map((s, i) => `${i + 1}. ${s.skill} — ${fmt(s.minutes)} min`)
        .join('\n') + (topSkillsAll.length > 5 ? `\n(+${topSkillsAll.length - 5} autres)` : '')
    : '—';

  // ------- Collections + bonus -------
  const coll = collectionProgress(userId);
  const byGuild = new Map<string, string[]>();
  coll.forEach(c => {
    const tag = `${c.rarity}: ${c.owned}/${c.total}${c.completed ? ' ✅' : ''}`;
    const arr = byGuild.get(c.guild) ?? [];
    arr.push(tag);
    byGuild.set(c.guild, arr);
  });
  const collLines =
    Array.from(byGuild.entries())
      .map(([g, parts]) => `• **${g}** — ${parts.join(' • ')}`)
      .join('\n') || '—';

  const { xpMult, goldMult } = collectionBonuses(userId);
  const bonusLine =
    xpMult > 1 || goldMult > 1
      ? `**Bonus actifs :** ${xpMult > 1 ? `XP x${xpMult.toFixed(2)}` : ''}${
          xpMult > 1 && goldMult > 1 ? ' • ' : ''
        }${goldMult > 1 ? `Or x${goldMult.toFixed(2)}` : ''}`
      : 'Aucun bonus de collection actif';

  // ------- Embed -------
  const fields: APIEmbedField[] = [
    { name: 'Niveau global', value: `**${levelNumber}**`, inline: true },
    { name: 'XP total', value: `**${fmt(xpGlobal)}**`, inline: true },
    { name: 'Or', value: `**${fmt(gold)}** 🪙`, inline: true },
    { name: 'Vers niveau suivant', value: `${fmt(into)} / ${fmt(toNext)} XP`, inline: false },
    { name: 'Progression', value: `${barGlobal}`, inline: false },
    guildField,
    { name: 'Activité (30 jours)', value: `XP: **${fmt(xp30)}** • Sessions: **${fmt(sess30)}**`, inline: false },
    { name: 'Top compétences (30 jours)', value: top30Str, inline: false },
    { name: 'Compétences (tout le temps)', value: topAllStr, inline: false },
    { name: 'Collections', value: collLines, inline: false },
    { name: 'Bonus de collections', value: bonusLine, inline: false },
  ];
  if (otherGuildsField) fields.splice(6, 0, otherGuildsField);

  const embed = new EmbedBuilder()
    .setTitle(`Profil de ${interaction.user.username}`)
    .addFields(fields)
    .setColor(0x263238);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
