// Courbe de niveaux + barre de progression

// Coût du prochain niveau (augmenté progressivement)
export function xpForLevel(level: number): number {
  return 100 + 50 * level; // L0->1:100, L1->2:150, L2->3:200, ...
}

// À partir d'un total d'XP, calcule niveau, progression vers le suivant, etc.
export function levelFromXP(totalXP: number): {
  level: number; into: number; toNext: number; pct: number;
} {
  let level = 0;
  let rem = Math.max(0, Math.floor(totalXP));
  while (rem >= xpForLevel(level)) {
    rem -= xpForLevel(level);
    level++;
  }
  const toNext = xpForLevel(level);
  const pct = toNext === 0 ? 1 : rem / toNext;
  return { level, into: rem, toNext, pct };
}

// Barre de progression textuelle
export function progressBar(pct: number, size = 16): string {
  const clamped = Math.max(0, Math.min(1, pct));
  const filled = Math.round(size * clamped);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}