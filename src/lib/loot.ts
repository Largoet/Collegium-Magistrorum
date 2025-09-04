// src/lib/loot.ts
import { sql } from './db';
import { houses } from './houses';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'unique';
export type GuildName = 'Mage' | 'Archer' | 'Guerrier' | 'Voleur';
export type Item = { key: string; name: string; emoji?: string; rarity: Rarity; guild: GuildName };

export const RARITY_ORDER: Rarity[] = ['common','rare','epic','legendary','unique'];
export const RARITY_PRICE: Record<Rarity, number> = { common: 50, rare: 150, epic: 500, legendary: 1400, unique: 5000 };
const RARITY_PROB: Record<Rarity, number> = { common: 0.65, rare: 0.25, epic: 0.08, legendary: 0.02, unique: 0.005 };

function it(g: GuildName, r: Rarity, key: string, name: string, emoji?: string): Item {
  return { guild: g, rarity: r, key, name, emoji };
}

const CATALOG: Record<GuildName, Record<Rarity, Item[]>> = {
  Mage: {
    common: [
      it('Mage','common','mage_wand_wood','Baguette en bois','🪄'),
      it('Mage','common','mage_glasses_chip','Lunettes ébréchées','👓'),
      it('Mage','common','mage_hat_worn','Chapeau usé','🎩'),
      it('Mage','common','mage_gloves_cloth','Gants de toile','🧤'),
      it('Mage','common','mage_ink_bottle','Encrier banal','🖋️'),
      it('Mage','common','mage_scroll_simple','Parchemin froissé','📜'),
    ],
    rare: [
      it('Mage','rare','mage_wand_carved','Baguette ciselée','🪄'),
      it('Mage','rare','mage_lens_focus','Lentille focalisante','🔍'),
      it('Mage','rare','mage_robe_stitched','Robe cousue','🧵'),
      it('Mage','rare','mage_ring_rune','Anneau runique','💍'),
    ],
    epic: [
      it('Mage','epic','mage_staff_arcane','Bâton arcanique','🪄'),
      it('Mage','epic','mage_hat_moon','Chapeau lunaire','🌙'),
      it('Mage','epic','mage_codex_gilded','Codex doré','📚'),
    ],
    legendary: [
      it('Mage','legendary','mage_grimoire_enchanted','Grimoire enchanté','📖'),
      it('Mage','legendary','mage_orb_stars','Orbe des étoiles','✨'),
    ],
    unique: [
      it('Mage','unique','mage_relic_origin','Relique Primordiale','🜁'),
    ],
  },
  Archer: {
    common: [
      it('Archer','common','archer_bow_crude','Arc grossier','🏹'),
      it('Archer','common','archer_fletch_plain','Empenne simple','🪶'),
      it('Archer','common','archer_bracer_leather','Brassard de cuir','🛡️'),
      it('Archer','common','archer_hood_worn','Capuche usée','🧢'),
      it('Archer','common','archer_quiver_scuffed','Carquois râpé','🧺'),
    ],
    rare: [
      it('Archer','rare','archer_bow_treated','Arc traité','🏹'),
      it('Archer','rare','archer_arrows_balanced','Flèches équilibrées','➡️'),
      it('Archer','rare','archer_boots_silent','Bottes silencieuses','👢'),
    ],
    epic: [
      it('Archer','epic','archer_bow_song','Arc chantant','🎶'),
      it('Archer','epic','archer_amulet_wind','Amulette du vent','🌀'),
    ],
    legendary: [
      it('Archer','legendary','archer_bow_storm','Arc de la Tempête','⚡'),
    ],
    unique: [
      it('Archer','unique','archer_quiver_infinite','Carquois sans fin','♾️'),
    ],
  },
  Guerrier: {
    common: [
      it('Guerrier','common','war_sword_dull','Épée émoussée','🗡️'),
      it('Guerrier','common','war_shield_wood','Bouclier boisé','🛡️'),
      it('Guerrier','common','war_helm_dented','Heaume cabossé','🪖'),
      it('Guerrier','common','war_gauntlet_iron','Gantelet de fer','🧤'),
    ],
    rare: [
      it('Guerrier','rare','war_sword_sharp','Épée aiguisée','🗡️'),
      it('Guerrier','rare','war_mail_riveted','Cotte rivetée','⛓️'),
      it('Guerrier','rare','war_banner_clan','Bannière de clan','🚩'),
    ],
    epic: [
      it('Guerrier','epic','war_hammer_thunder','Marteau-tonnerre','⚒️'),
      it('Guerrier','epic','war_armor_engraved','Armure gravée','🛡️'),
    ],
    legendary: [
      it('Guerrier','legendary','war_blade_enchanted','Épée enchantée','✨'),
    ],
    unique: [
      it('Guerrier','unique','war_blade_excalibur','Excalibur','🗡️'),
    ],
  },
  Voleur: {
    common: [
      it('Voleur','common','thief_dagger_rust','Dague rouillée','🗡️'),
      it('Voleur','common','thief_lockpick_bent','Crochet tordu','🗝️'),
      it('Voleur','common','thief_cloak_faded','Cape passée','🧥'),
      it('Voleur','common','thief_pouch_frayed','Bourse effilochée','👝'),
    ],
    rare: [
      it('Voleur','rare','thief_dagger_balanced','Dague équilibrée','🗡️'),
      it('Voleur','rare','thief_gloves_silken','Gants de soie','🧤'),
      it('Voleur','rare','thief_powder_sleep','Poudre de sommeil','💤'),
    ],
    epic: [
      it('Voleur','epic','thief_cloak_night','Cape de Nuit','🌑'),
      it('Voleur','epic','thief_tools_master','Trousse de maître','🧰'),
    ],
    legendary: [
      it('Voleur','legendary','thief_dagger_shadow','Dague des Ombres','🌫️'),
    ],
    unique: [
      it('Voleur','unique','thief_coin_fate','Pièce du Destin','🪙'),
    ],
  },
};

export function guildNameFromRoleId(roleId?: string | null): GuildName | null {
  if (!roleId) return null;
  const h = houses.find(x => x.roleId === roleId);
  return (h?.name ?? null) as GuildName | null;
}

export function listItems(g: GuildName, r: Rarity): Item[] { return CATALOG[g][r]; }

function hasItem(userId: string, key: string): boolean {
  const row = sql.hasLoot?.get?.(userId, key) as { 1?: number } | undefined;
  if (row) return true;
  const c = sql.countLootByKeyForUser?.get?.(userId, key) as { c?: number } | undefined;
  return !!(c && (c.c ?? 0) > 0);
}

function missing(userId: string, g: GuildName, r: Rarity): Item[] {
  return listItems(g, r).filter(it => !hasItem(userId, it.key));
}

function pickRarity(): Rarity {
  const r = Math.random(); let acc = 0;
  for (const rar of RARITY_ORDER) { acc += RARITY_PROB[rar]; if (r <= acc) return rar; }
  return 'common';
}

/** Loot non dupliqué pour l’utilisateur (descend de rareté si complet) */
export function rollLootForUser(userId: string, houseRoleId?: string | null) {
  const g = guildNameFromRoleId(houseRoleId) ?? null;
  if (!g) return null;
  let rar = pickRarity();
  for (let step = 0; step < RARITY_ORDER.length; step++) {
    const pool = missing(userId, g, rar);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    const idx = RARITY_ORDER.indexOf(rar);
    rar = RARITY_ORDER[Math.max(0, idx - 1)];
  }
  return null;
}

const BONUS_XP_BY_RARITY: Record<Rarity, number> = { common: 0.01, rare: 0.02, epic: 0.04, legendary: 0.07, unique: 0.10 };

/** Bonus cumulés (XP pour toutes les guildes sauf Voleur → Or) */
export function collectionBonuses(userId: string) {
  let xpMult = 1, goldMult = 1;
  (['Mage','Archer','Guerrier','Voleur'] as GuildName[]).forEach((g) => {
    RARITY_ORDER.forEach((rar) => {
      const all = listItems(g, rar);
      if (!all.length) return;
      const ownsAll = all.every(it => hasItem(userId, it.key));
      if (ownsAll) {
        const bonus = BONUS_XP_BY_RARITY[rar];
        if (g === 'Voleur') goldMult += bonus; else xpMult += bonus;
      }
    });
  });
  return { xpMult, goldMult };
}

export function collectionProgress(userId: string) {
  const out: Array<{ guild: GuildName; rarity: Rarity; owned: number; total: number; completed: boolean }> = [];
  (['Mage','Archer','Guerrier','Voleur'] as GuildName[]).forEach((g) => {
    RARITY_ORDER.forEach((rar) => {
      const all = listItems(g, rar);
      const owned = all.filter(it => hasItem(userId, it.key)).length;
      out.push({ guild: g, rarity: rar, owned, total: all.length, completed: owned === all.length && all.length > 0 });
    });
  });
  return out;
}

export function describeItem(key: string) {
  for (const g of Object.keys(CATALOG) as GuildName[]) {
    for (const rar of RARITY_ORDER) {
      const it = CATALOG[g][rar].find(x => x.key === key);
      if (it) return { name: it.name, emoji: it.emoji, rarity: it.rarity, guild: g };
    }
  }
  return { name: key, emoji: '🎁', rarity: 'common' as Rarity, guild: 'Mage' as GuildName };
}
