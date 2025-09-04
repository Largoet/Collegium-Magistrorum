// src/lib/rp.ts
import { houses } from './houses';

export function houseNameFromRoleId(roleId?: string | null) {
  return houses.find(h => h.roleId === roleId)?.name ?? 'Aventurier';
}

export function introLine(houseName: string, minutes: number, skill: string) {
  const L: Record<string, string[]> = {
    Mage: [
      `🧙 ${houseName}, une antique bibliothèque s’ouvre devant toi. Saura-tu déchiffrer ses runes en ${minutes} min sur **${skill}** ?`,
    ],
    Guerrier: [
      `🛡️ ${houseName}, l’entraînement commence. Tiendras-tu ${minutes} min sur **${skill}** ?`,
    ],
    Archer: [
      `🏹 ${houseName}, ajuste ton tir. ${minutes} min de concentration sur **${skill}** t’attendent.`,
    ],
    Voleur: [
      `🗡️ ${houseName}, l’ombre t’accompagne. ${minutes} min en filigrane sur **${skill}**.`,
    ],
    Aventurier: [
      `🎒 ${houseName}, une nouvelle étape commence : ${minutes} min sur **${skill}**.`,
    ],
  };
  const pool = L[houseName] ?? L['Aventurier'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function victoryLine(houseName: string, minutes: number, xp: number, gold: number, lootStr?: string) {
  const base = `🏆 ${houseName}, tu ressors victorieux ! +${xp} XP` + (gold ? ` • +${gold} 🪙` : '');
  return lootStr ? `${base}\n🎁 Butin : ${lootStr}` : base;
}

export function failLine(houseName: string, xp: number) {
  return `⚰️ ${houseName}, la bataille était rude… mais tu obtiens tout de même ${xp} XP.`;
}
