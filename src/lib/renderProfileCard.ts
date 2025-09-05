// src/lib/renderProfileCard.ts
import { Canvas, loadImage } from 'skia-canvas';
import type { Guild } from './theme';
import { themeByRoleId } from './theme';
import { sql } from './db';
import { houses } from './houses';
import { titleForGuildXP } from './titles';
import { levelFromXP } from './game';
import { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';

export async function renderProfileCard(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  const user = interaction.user;
  const userId = user.id;
  const username = user.username;
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });

  // guilde actuelle
  const member = interaction.inGuild() ? interaction.guild!.members.cache.get(userId) : null;
  const house = member ? houses.find(h => member.roles.cache.has(h.roleId)) ?? null : null;
  const roleId = house?.roleId ?? null;
  const guildName = house?.name ?? 'Mage';
  const theme = themeByRoleId(roleId);

  // données
  const goldRow = sql.getGold.get(userId) as { gold?: number } | undefined;
  const gold = goldRow?.gold ?? 0;

  const total = (sql.totalXPAll.get(userId) as { xp?: number } | undefined)?.xp ?? 0;
  const lvl = levelFromXP(total) as any;
  const level: number = typeof lvl === 'number' ? lvl : (lvl.level ?? 0);
  const into: number = typeof lvl === 'number' ? total % (100 + 50 * level) : (lvl.into ?? 0);
  const toNext: number = typeof lvl === 'number' ? (100 + 50 * level) : (lvl.toNext ?? (100 + 50 * level));

  const rows = (sql.xpByHouseAll.all(userId) as Array<{ house_role_id: string | null; xp: number }>) ?? [];
  const guildXP = rows.find(r => r.house_role_id === roleId)?.xp ?? 0;
  const { current, next } = titleForGuildXP(guildName as Guild, guildXP);

  // canvas
  const W = 1000, H = 420;
  const card = new Canvas(W, H);
  const ctx = card.getContext('2d');

  // fond
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#11161d');
  grad.addColorStop(1, '#1c232b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // bandeau
  try {
    const banner = await loadImage(theme.bannerUrl);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(banner, 0, 0, W, 180);
    ctx.globalAlpha = 1;
  } catch {}

  // avatar cercle
  try {
    const img = await loadImage(avatarUrl);
    const r = 70, x = 110, y = 160;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.restore();
    // anneau
    ctx.lineWidth = 6;
    ctx.strokeStyle = `#${theme.color.toString(16).padStart(6, '0')}`;
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
  } catch {}

  // titres
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(`${theme.icon} Profil de ${username}`, 210, 70);
  ctx.font = '20px Arial';
  ctx.fillStyle = '#cfd8dc';
  ctx.fillText(`Guilde : ${guildName} — ${current?.name ?? '—'}`, 210, 105);

  // XP globale bar
  const barX = 210, barY = 140, barW = 740, barH = 18;
  ctx.fillStyle = '#27313b';
  roundRect(ctx, barX, barY, barW, barH, 9); ctx.fill();

  const ratio = Math.max(0, Math.min(1, into / Math.max(1, toNext)));
  const fillW = Math.max(8, Math.round(barW * ratio));
  ctx.fillStyle = `#${theme.color.toString(16).padStart(6, '0')}`;
  roundRect(ctx, barX, barY, fillW, barH, 9); ctx.fill();

  ctx.fillStyle = '#b0bec5';
  ctx.font = '16px Arial';
  ctx.fillText(`Niveau ${level} — ${into} / ${toNext} XP`, barX, barY + 40);

  // XP guilde bar
  const gBarY = barY + 80;
  const cur = current?.xp ?? 0;
  const span = (next ? next.xp : Math.max(cur + 1, guildXP + 1)) - cur;
  const done = guildXP - cur;
  const gr = Math.max(0, Math.min(1, done / Math.max(1, span)));

  ctx.fillStyle = '#27313b'; roundRect(ctx, barX, gBarY, barW, barH, 9); ctx.fill();
  ctx.fillStyle = '#90caf9'; roundRect(ctx, barX, gBarY, Math.max(8, Math.round(barW * gr)), barH, 9); ctx.fill();

  ctx.fillStyle = '#b0bec5';
  ctx.fillText(`Titre guilde : ${current?.name ?? '—'} ${next ? `→ ${next.name}` : '(max)'}`, barX, gBarY + 40);

  // or
  ctx.fillStyle = '#ffd54f';
  ctx.font = '22px Arial';
  ctx.fillText(`🪙 ${gold} or`, barX, gBarY + 80);

  return { buffer: await card.png, filename: `profil-${username}.png` };
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
