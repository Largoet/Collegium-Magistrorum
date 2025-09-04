// src/lib/game.ts

/** Courbe de niveaux : coût du prochain niveau = 100 + 50 * level */
export function levelFromXP(xpTotal: number): {
  level: number;
  into: number;
  toNext: number;
  pct: number;
} {
  let level = 0;
  let remaining = Math.max(0, Math.floor(xpTotal));
  let cost = 100;

  while (remaining >= cost) {
    remaining -= cost;
    level += 1;
    cost = 100 + 50 * level;
  }

  const into = remaining;
  const toNext = cost;
  const pct = Math.max(0, Math.min(100, Math.round((into / toNext) * 100)));
  return { level, into, toNext, pct };
}

export function progressBar(current: number, max: number, width = 18): string {
  const safeMax = Math.max(1, Math.floor(max));
  const ratio = Math.max(0, Math.min(1, current / safeMax));

  const w = Math.max(4, Math.min(18, Math.floor(width)));

  const filled = Math.round(ratio * w);
  const empty = w - filled;

  return '▰'.repeat(filled) + '▱'.repeat(empty);
}
