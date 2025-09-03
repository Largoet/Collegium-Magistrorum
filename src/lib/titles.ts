// src/lib/titles.ts
import { houses } from './houses';

/** Titres par guilde (du plus bas au plus haut). Adapte librement. */
const TITLES: Record<string, string[]> = {
  Mage:     ['Novice', 'Apprenti', 'Ensorceleur', 'Magicien certifié', 'Archimage'],
  Archer:   ['Péquin', 'Rôdeur', 'Tireur émérite', 'Maître-archer', 'Sylve-sentinelle'],
  Guerrier: ['Recrue', 'Homme d’armes', 'Champion', 'Maître d’armes', 'Légende'],
  Voleur:   ['Pickpocket', 'Filou', 'Ombre', 'Assassin', 'Main noire'],
};

/** Retourne le titre pour une guilde donnée en fonction du niveau calculé. */
export function titleForHouse(houseRoleId: string, level: number): string {
  const h = houses.find(x => x.roleId === houseRoleId);
  const names = (h && TITLES[h.name]) || ['Novice', 'Adepte', 'Expert', 'Maître'];
  const idx = Math.min(names.length - 1, Math.floor(level / 3)); // 1 titre tous les 3 niveaux
  return names[idx];
}
