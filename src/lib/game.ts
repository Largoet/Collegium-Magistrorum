// src/lib/game.ts

// Courbe simple : coût du niveau N = BASE + STEP * N
export const XP_BASE = 100;
export const XP_STEP = 50;

function needForLevel(level: number): number {
  return XP_BASE + XP_STEP * level;
}

/**
 * Calcule le niveau à partir de l'XP total.
 * Renvoie :
 *  - level  : niveau courant (0,1,2,…)
 *  - into   : XP déjà investie dans le niveau courant
 *  - toNext : XP nécessaire pour passer au niveau suivant
 *  - pct    : into / toNext (0..1)
 */
export function levelFromXP(totalXP: number): {
  level: number;
  into: number;
  toNext: number;
  pct: number;
} {
  let level = 0;
  let rem = Math.max(0, Math.floor(totalXP || 0));

  // on “consomme” l'XP palier par palier
  while (rem >= needForLevel(level)) {
    rem -= needForLevel(level);
    level++;
  }

  const into = rem;
  const toNext = needForLevel(level);
  const pct = toNext > 0 ? into / toNext : 1;

  return { level, into, toNext, pct };
}

/**
 * Barre de progression textuelle.
 * ratio ∈ [0..1], slots = nombre de cases.
 * Important : on fait floor APRÈS multiplication.
 */
export function progressBar(
  ratio: number,
  slots = 18,
  fill = '■',
  empty = '□'
): string {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const filled = Math.floor(r * slots); // ✅ multiplier AVANT de floor
  return fill.repeat(filled) + empty.repeat(slots - filled);
}
