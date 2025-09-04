// src/lib/titles.ts
export type GuildName = 'Mage' | 'Archer' | 'Guerrier' | 'Voleur';

export type TitleDef = { name: string; xp: number };

// Courbe exponentielle: ~150k XP cumulé au rang 20
function buildThresholds(totalRanks = 20, startDelta = 300, growth = 1.28) {
  const deltas: number[] = [];
  for (let i = 0; i < totalRanks; i++) deltas.push(Math.round(startDelta * Math.pow(growth, i)));
  const cum: number[] = [];
  let acc = 0;
  for (const d of deltas) { acc += d; cum.push(acc); }
  return cum;
}
const CURVE = buildThresholds(20, 300, 1.28);

// Progressions cohérentes (du plus bas au plus haut)
const MAGE = [
  'Novice', 'Apprenti', 'Adepte', 'Érudit', 'Conjurateur',
  'Enchanteur', 'Thaumaturge', 'Arcaniste', 'Maître des Runes', 'Hiérophante',
  'Grand Arcaniste', 'Sage d’Azur', 'Archimage', 'Grand Archimage',
  'Magister', 'Magister Émérite', 'Magister Arcanum', 'Magister Primus',
  'Magister Suprême', 'Magister Absolu',
];

const ARCHER = [
  'Novice', 'Apprenti tireur', 'Éclaireur', 'Pisteur', 'Archer',
  'Traqueur', 'Marqueur', 'Maître-archer', 'Œil de Lynx', 'Faucon',
  'Pluie-de-Flèches', 'Guetteur du Zénith', 'Vent-rapide', 'Cœur-juste',
  'Flèche Chantante', 'Main Sûre', 'Œil Absolu', 'Héraut des Vents',
  'Seigneur des Carquois', 'Maître Sylvestre',
];

const GUERRIER = [
  'Recrue', 'Novice des armes', 'Soldat', 'Homme d’armes', 'Vétéran',
  'Champion', 'Brise-ligne', 'Garde d’élite', 'Porte-étendard', 'Maître d’armes',
  'Colosse', 'Marteau de guerre', 'Seigneur des Batailles', 'Parangon',
  'Légende d’acier', 'Haut-Maréchal', 'Titan', 'Grand Stratège',
  'Seigneur de Guerre', 'Seigneur de Guerre Suprême',
];

const VOLEUR = [
  'Pied-léger', 'Filou', 'Crocheteur', 'Escamoteur', 'Compagnon d’ombre',
  'Passe-muraille', 'Main Silencieuse', 'Couteau Noir', 'Aiguille', 'Ombre experte',
  'Prince des ruelles', 'Brume', 'Passe-voile', 'Fantôme', 'Spectre',
  'Maître des Voleurs', 'Voile-nocturne', 'Seigneur de l’Ombre',
  'Grand Maître des Voleurs', 'Renard Gris',
];

function attach(names: string[]): TitleDef[] {
  return names.map((name, i) => ({ name, xp: CURVE[i] }));
}

export const titlesByGuild: Record<GuildName, TitleDef[]> = {
  Mage: attach(MAGE),
  Archer: attach(ARCHER),
  Guerrier: attach(GUERRIER),
  Voleur: attach(VOLEUR),
};

export function titleForGuildXP(guild: GuildName, xp: number) {
  const list = titlesByGuild[guild];
  let i = 0;
  while (i < list.length && xp >= list[i].xp) i++;
  const currentIdx = Math.max(0, i - 1);
  const current = list[currentIdx];
  const next = list[i];
  const xpToNext = next ? Math.max(0, next.xp - xp) : 0;
  return { currentIdx, current, next, xpToNext };
}
