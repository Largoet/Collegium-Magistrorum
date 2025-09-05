// src/commands/profile.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  APIEmbedField,
} from 'discord.js';
import { sql } from '../lib/db';
import { levelFromXP } from '../lib/game';
import { houses } from '../lib/houses';
import { titlesByGuild, GuildName } from '../lib/titles';
import { collectionProgress, collectionBonuses } from '../lib/loot';
import { themeByRoleId } from '../lib/theme';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche ta fiche personnage (progression, guildes, compétences, collections)');

function fmt(n: number) { return n.toLocaleString('fr-FR'); }

/* ---------- Barres esthétiques ---------- */

type BarStyle = 'slider' | 'solid' | 'emoji';
const PROFILE_BAR_STYLE: BarStyle = 'slider'; // 'slider' | 'solid' | 'emoji'

function makeBar(current: number, max: number, slots = 22, style: BarStyle = PROFILE_BAR_STYLE) {
  const ratio = max > 0 ? current / max : 0;
  const r = Math.max(0, Math.min(1, ratio));

  if (style === 'solid') {
    const filled = Math.floor(r * slots);
    return '█'.repeat(filled) + '░'.repeat(slots - filled);
  }
  if (style === 'emoji') {
    const filled = Math.floor(r * slots);
    return '🟩'.repeat(filled) + '⬛'.repeat(slots - filled);
  }
  // slider (piste + curseur)
  const width = slots;
  const pos = Math.min(width - 1, Math.round(r * (width - 1)));
  let track = '';
  for (let i = 0; i < width; i++) track += (i === pos ? '●' : '─');
  return `【${track}】`;
}

function pct(current: number, max: number) {
  const r = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return Math.round(r * 100);
}

/* ---------- Progression de guilde robuste ---------- */

function computeGuildProgress(guild: GuildName, gXP: number) {
  const ladder = titlesByGuild[guild] ?? []; // [{ name, xp }, ...] ordonné par xp croissante
  if (ladder.length === 0) {
    return { current: null as { name: string; xp: number } | null, next: undefined as { name: string; xp: number } | undefined, done: 0, span: 1, xpToNext: 0 };
  }

  // index du premier palier STRICTEMENT supérieur à gXP
  const nextIndex = ladder.findIndex(t => t.xp > gXP);

  // Cas 1 : en-dessous du 1er palier
  if (nextIndex === 0) {
    const current = null;
    const next = ladder[0];
    const currentMin = 0;
    const target = next.xp;
    const done = Math.max(0, gXP - currentMin);      // = gXP
    const span = Math.max(1, target - currentMin);   // = next.xp
    const xpToNext = Math.max(0, target - gXP);      // combien reste pour atteindre le 1er palier
    return { current, next, done, span, xpToNext };
  }

  // Cas 2 : au-dessus du dernier palier (ou égal)
  if (nextIndex === -1) {
    const current = ladder[ladder.length - 1];
    const next = undefined;
    const currentMin = current.xp;
    const target = Math.max(currentMin + 1, gXP + 1); // évite division par 0
    const done = Math.max(0, gXP - currentMin);
    const span = Math.max(1, target - currentMin);
    const xpToNext = 0;
    return { current, next, done, span, xpToNext };
  }

  // Cas 3 : entre deux paliers
  const current = ladder[nextIndex - 1];
  const next = ladder[nextIndex];
  const currentMin = current.xp;
  const target = next.xp;
  const done = Math.max(0, gXP - currentMin);
  const span = Math.max(1, target - currentMin);
  const xpToNext = Math.max(0, target - gXP);
  return { current, next, done, span, xpToNext };
}

/* --------------------------------------- */

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // base
  const user = sql.getUser.get(userId) as { gold?: number } | undefined;
  const gold = user?.gold ?? 0;

  const totalXPRow = sql.totalXPAll.get(userId) as { xp?: number } | undefined;
  const xpGlobal = totalXPRow?.xp ?? 0;

  // niveau global + barre
  const gl = levelFromXP(xpGlobal); // { level, into, toNext, pct }
  const barGlobal = makeBar(gl.into, Math.max(1, gl.toNext), 22);
  const pctGlobal = pct(gl.into, Math.max(1, gl.toNext));

  // guilde actuelle
  const member = interaction.inGuild() ? interaction.guild!.members.cache.get(userId) : null;
  const currentHouse = member ? houses.find(h => member.roles.cache.has(h.roleId)) ?? null : null;
  const guildName = (currentHouse?.name as GuildName | undefined) ?? undefined;
  const theme = themeByRoleId(currentHouse?.roleId ?? undefined);

  // XP par guilde (all-time)
  const rows = (sql.xpByHouseAll.all(userId) as Array<{ house: string | null; xp: number }>) ?? [];
  const xpByGuildMap = new Map<GuildName, number>();
  rows.forEach(r => {
    const gname = houses.find(h => h.roleId === r.house)?.name as GuildName | undefined;
    if (gname) xpByGuildMap.set(gname, r.xp);
  });

  // bloc guilde
  let guildField: APIEmbedField = { name: 'Guilde', value: 'Aucune', inline: false };
  if (guildName) {
    const gXP = xpByGuildMap.get(guildName) ?? 0;

    // 🔧 calcule proprement le palier courant / suivant
    const { current, next, done, span, xpToNext } = computeGuildProgress(guildName, gXP);

    const barGuild = makeBar(done, span, 22);
    const pctGuild = pct(done, span);

    guildField = {
      name: `Guilde actuelle — ${guildName} (${current?.name ?? '—'})`,
      value: [
        `XP: **${fmt(gXP)}**` +
          (next ? ` • Prochain titre: **${next.name}** dans **${fmt(xpToNext)}** XP` : ' • (Titre maximal atteint)'),
        `\`${barGuild}\` **${pctGuild}%**`,
      ].join('\n'),
      inline: false,
    };
  }

  // activité 30 jours
  const xp30 = (sql.totalXP30d.get(userId) as { xp?: number } | undefined)?.xp ?? 0;
  const sess30 = (sql.totalSessions30d.get(userId) as { n?: number } | undefined)?.n ?? 0;

  const top30 = (sql.topSkills30d.all(userId) as Array<{ skill: string; minutes: number }> | undefined) ?? [];
  const top30Str = top30.length
    ? top30.map((s, i) => `${i + 1}. ${s.skill} — ${fmt(s.minutes)} min`).join('\n')
    : '—';

  // compétences all-time
  const topAll = (sql.topSkillsAllTime.all(userId) as Array<{ skill: string; minutes: number }> | undefined) ?? [];
  const topAllStr = topAll.length
    ? topAll.slice(0, 5).map((s, i) => `${i + 1}. ${s.skill} — ${fmt(s.minutes)} min`).join('\n') +
      (topAll.length > 5 ? `\n(+${topAll.length - 5} autres)` : '')
    : '—';

  // collections + bonus
  const coll = collectionProgress(userId);
  const byGuild = new Map<string, string[]>();
  coll.forEach(c => {
    const tag = `${c.rarity}: ${c.owned}/${c.total}${c.completed ? ' ✅' : ''}`;
    const arr = byGuild.get(c.guild) ?? [];
    arr.push(tag);
    byGuild.set(c.guild, arr);
  });
  const collLines = Array.from(byGuild.entries()).map(([g, parts]) => `• **${g}** — ${parts.join(' • ')}`).join('\n') || '—';

  const { xpMult, goldMult } = collectionBonuses(userId);
  const bonusLine = (xpMult > 1 || goldMult > 1)
    ? `**Bonus actifs :** ${xpMult > 1 ? `XP x${(xpMult).toFixed(2)}` : ''}${(xpMult > 1 && goldMult > 1) ? ' • ' : ''}${goldMult > 1 ? `Or x${(goldMult).toFixed(2)}` : ''}`
    : 'Aucun bonus de collection actif';

  // embed
  const embed = new EmbedBuilder()
    .setTitle(`Profil de ${interaction.user.username}`)
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? (null as any))
    .addFields(
      { name: 'Niveau global', value: `**${gl.level}**`, inline: true },
      { name: 'XP total', value: `**${fmt(xpGlobal)}**`, inline: true },
      { name: 'Or', value: `**${fmt(gold)}** 🪙`, inline: true },
      {
        name: 'Progression niveau',
        value: `\`${makeBar(gl.into, Math.max(1, gl.toNext), 22)}\` **${pctGlobal}%** — ${fmt(gl.into)} / ${fmt(gl.toNext)} XP`,
        inline: false,
      },
      guildField,
      { name: 'Activité (30 jours)', value: `XP: **${fmt(xp30)}** • Sessions: **${fmt(sess30)}**`, inline: false },
      { name: 'Top compétences (30 jours)', value: top30Str, inline: false },
      { name: 'Compétences (tout le temps)', value: topAllStr, inline: false },
      { name: 'Collections', value: collLines, inline: false },
      { name: 'Bonus de collections', value: bonusLine, inline: false },
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
