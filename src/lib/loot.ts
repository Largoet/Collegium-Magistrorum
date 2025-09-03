// src/lib/loot.ts
import { houses } from './houses';

export type LootItem = {
  key: string;      // identifiant interne
  name: string;     // intitulé
  emoji?: string;   // visuel
  rarity: 'common' | 'rare' | 'epic';
  weight: number;   // poids relatif (tirage pondéré)
};

const POOLS: Record<string, LootItem[]> = {
  Mage: [
    { key: 'grimoire_frag', name: 'Fragment de Grimoire', emoji: '📜', rarity: 'common', weight: 6 },
    { key: 'cristal_mana',  name: 'Cristal de mana',     emoji: '🔮', rarity: 'rare',   weight: 3 },
    { key: 'baguette_anc',  name: 'Baguette ancienne',   emoji: '🪄', rarity: 'epic',   weight: 1 },
  ],
  Guerrier: [
    { key: 'bouclier_ecl',  name: 'Éclat de bouclier',   emoji: '🛡️', rarity: 'common', weight: 6 },
    { key: 'épée_vieille',  name: 'Vieille épée',        emoji: '🗡️', rarity: 'rare',   weight: 3 },
    { key: 'armure_run',    name: 'Armure runique',      emoji: '🧱', rarity: 'epic',   weight: 1 },
  ],
  Archer: [
    { key: 'fleche_fin',    name: 'Flèche fine',         emoji: '🏹', rarity: 'common', weight: 6 },
    { key: 'carquois_bois', name: 'Carquois ouvragé',    emoji: '🧺', rarity: 'rare',   weight: 3 },
    { key: 'arc_celeste',   name: 'Arc céleste',         emoji: '🌈', rarity: 'epic',   weight: 1 },
  ],
  Voleur: [
    { key: 'poignard_mat',  name: 'Poignard mat',        emoji: '🔪', rarity: 'common', weight: 6 },
    { key: 'cape_ombre',    name: 'Cape d’ombre',        emoji: '🕶️', rarity: 'rare',   weight: 3 },
    { key: 'bague_noire',   name: 'Bague noire',         emoji: '💍', rarity: 'epic',   weight: 1 },
  ],
  Aventurier: [
    { key: 'porte_bonh',    name: 'Porte-bonheur',       emoji: '🍀', rarity: 'common', weight: 10 },
  ],
};

export function poolForHouseRoleId(houseRoleId?: string | null) {
  const name = houses.find(h => h.roleId === houseRoleId)?.name ?? 'Aventurier';
  return { name, pool: POOLS[name] ?? POOLS['Aventurier'] };
}

export function rollLoot(houseRoleId?: string | null): LootItem | null {
  // Chance de drop ~30%
  if (Math.random() > 0.30) return null;
  const { pool } = poolForHouseRoleId(houseRoleId);
  // tirage pondéré
  const total = pool.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of pool) {
    if ((r -= it.weight) <= 0) return it;
  }
  return pool[0] ?? null;
}
