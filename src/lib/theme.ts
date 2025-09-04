// src/lib/theme.ts
import { houses } from './houses';

type Theme = {
  name: string;
  color: number;
  emoji?: string;
  banner?: string | null;
};

const DEFAULT: Theme = {
  name: 'Collegium',
  color: 0x1976d2,
  emoji: '✨',
  banner: process.env.BANNER_DEFAULT ?? null,
};

const COLOR_BY_NAME: Record<string, number> = {
  Mage: 0x6a5acd,      // SlateBlue
  Archer: 0x2e7d32,    // Green
  Guerrier: 0xb71c1c,  // Dark Red
  Voleur: 0x424242,    // Gray
};

const BANNERS_BY_NAME: Record<string, string | undefined> = {
  Mage: process.env.BANNER_MAGE,
  Archer: process.env.BANNER_ARCHER,
  Guerrier: process.env.BANNER_GUERRIER,
  Voleur: process.env.BANNER_VOLEUR,
};

export function themeForHouseRoleId(roleId?: string | null): Theme {
  const h = roleId ? houses.find(x => x.roleId === roleId) : undefined;
  if (!h) return DEFAULT;
  const color = COLOR_BY_NAME[h.name] ?? DEFAULT.color;
  const banner = (BANNERS_BY_NAME[h.name] ?? null) || DEFAULT.banner || null;
  return {
    name: h.name,
    color,
    emoji: (h.emoji as string | undefined) ?? DEFAULT.emoji,
    banner,
  };
}
