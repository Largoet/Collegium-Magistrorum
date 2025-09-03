// src/lib/houses.ts
import { env } from './config';

export type House = { name: string; roleId: string; emoji?: string };

export function parseHouses(raw?: string): House[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      // Format: Nom:RoleId[:Emoji]
      const [name, roleId, emoji] = entry.split(':').map(x => x.trim());
      if (!name || !roleId) throw new Error(`Entrée HOUSE_ROLES invalide: "${entry}"`);
      return { name, roleId, emoji };
    });
}

export const houses: House[] = parseHouses(env.HOUSE_ROLES);
