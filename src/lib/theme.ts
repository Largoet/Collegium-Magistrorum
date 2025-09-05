// src/lib/themes.ts
import { houses } from './houses';

export type Guild = 'Mage' | 'Guerrier' | 'Archer' | 'Voleur';

export const THEME: Record<Guild, { color: number; icon: string; bannerUrl: string }> = {
  Mage: {
    color: 0x7E57C2,
    icon: '🪄',
    bannerUrl:
      'https://cdn.discordapp.com/attachments/1412400628046626928/1413446037485391903/ChatGPT_Image_4_sept._2025_12_47_52.png',
  },
  Guerrier: {
    color: 0xEF5350,
    icon: '🛡️',
    bannerUrl:
      'https://cdn.discordapp.com/attachments/1412400654508625961/1413446094414676078/ChatGPT_Image_5_sept._2025_10_31_52.png',
  },
  Archer: {
    color: 0x66BB6A,
    icon: '🏹',
    bannerUrl:
      'https://cdn.discordapp.com/attachments/1412400678768349335/1413446132628979773/ChatGPT_Image_5_sept._2025_10_47_24.png',
  },
  Voleur: {
    color: 0x546E7A, // bleu-gris
    icon: '🗡️',
    bannerUrl:
      'https://cdn.discordapp.com/attachments/1412400711001571468/1413446161942970489/ChatGPT_Image_5_sept._2025_10_47_25.png',
  },
};

export function themeByRoleId(roleId?: string | null) {
  const h = houses.find(x => x.roleId === roleId);
  const name = (h?.name ?? 'Mage') as Guild;
  return THEME[name];
}

export function themeByGuildName(name?: string | null) {
  const n = (name ?? 'Mage') as Guild;
  return THEME[n];
}
