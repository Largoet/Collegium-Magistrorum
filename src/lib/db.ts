// src/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './config';

// -- dossier data
const dir = path.dirname(env.DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// -- DB + pragmas
export const db = new Database(env.DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// -- schéma
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  discord_id TEXT PRIMARY KEY,
  prefs_json TEXT DEFAULT '{}',
  gold INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  status TEXT CHECK(status IN ('done','aborted')) NOT NULL,
  skill TEXT,
  subject TEXT,
  house_role_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(discord_id)
);

CREATE TABLE IF NOT EXISTS xp_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta_xp INTEGER NOT NULL,
  at_ts INTEGER NOT NULL,
  house_role_id TEXT
);

CREATE TABLE IF NOT EXISTS loot(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  house_role_id TEXT,
  rarity TEXT NOT NULL,
  obtained_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_claims(
  user_id TEXT PRIMARY KEY,
  last_claim_ts INTEGER NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(discord_id)
);

/* Boutique d’objets (par utilisateur + jour) */
CREATE TABLE IF NOT EXISTS shop_offers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  generated_day INTEGER NOT NULL,
  house_role_id TEXT,
  item_key TEXT NOT NULL,
  rarity TEXT NOT NULL,
  price INTEGER NOT NULL,
  purchased_ts INTEGER,
  UNIQUE(user_id, generated_day, item_key)
);

/* index utiles */
CREATE INDEX IF NOT EXISTS idx_xp_user_ts           ON xp_log(user_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_user_start  ON sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_xp_house_ts          ON xp_log(house_role_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_house_start ON sessions(house_role_id, started_at);
CREATE INDEX IF NOT EXISTS idx_loot_user_ts         ON loot(user_id, obtained_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_user_day        ON shop_offers(user_id, generated_day);
`);

// -- helpers migration
function hasColumn(table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some(r => r.name === col);
}
function addColumnIfMissing(table: string, defSql: string) {
  const col = defSql.split(/\s+/)[0];
  if (!hasColumn(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${defSql}`);
}

// -- migrations légères (pour anciennes bases)
addColumnIfMissing('shop_offers', `generated_day INTEGER NOT NULL DEFAULT CAST(strftime('%s','now')/86400 AS INTEGER)`);
addColumnIfMissing('shop_offers', `house_role_id TEXT`);
addColumnIfMissing('shop_offers', `rarity TEXT NOT NULL DEFAULT 'common'`);
addColumnIfMissing('shop_offers', `price INTEGER NOT NULL DEFAULT 0`);
addColumnIfMissing('shop_offers', `purchased_ts INTEGER`);
db.exec(`
UPDATE shop_offers
SET generated_day = CAST(strftime('%s','now')/86400 AS INTEGER)
WHERE generated_day IS NULL OR generated_day = 0;
`);
db.exec(`UPDATE shop_offers SET rarity = COALESCE(rarity,'common');`);
db.exec(`UPDATE shop_offers SET price = COALESCE(price,0);`);

// -- requêtes
export const sql = {
  // users
  upsertUser: db.prepare(`INSERT OR IGNORE INTO users(discord_id) VALUES (?)`),
  getUser: db.prepare(`SELECT discord_id, prefs_json, COALESCE(gold,0) AS gold FROM users WHERE discord_id = ?`),

  // sessions
  insertSession: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject)
    VALUES (?,?,?,?,?,?)
  `),
  insertSessionWithHouse: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject, house_role_id)
    VALUES (?,?,?,?,?,?,?)
  `),

  // xp
  insertXP: db.prepare(`INSERT INTO xp_log(user_id, delta_xp, at_ts) VALUES (?,?,?)`),
  insertXPWithHouse: db.prepare(`INSERT INTO xp_log(user_id, delta_xp, at_ts, house_role_id) VALUES (?,?,?,?)`),

  totalXP30d: db.prepare(`
    SELECT COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ? AND at_ts >= strftime('%s','now','-30 days')
  `),
  totalXPAll: db.prepare(`
    SELECT COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ?
  `),
  totalSessions30d: db.prepare(`
    SELECT COUNT(*) AS n
    FROM sessions
    WHERE user_id = ? AND status='done'
      AND started_at >= strftime('%s','now','-30 days')
  `),

  // skills
  topSkills30d: db.prepare(`
    SELECT skill, SUM(duration_min) AS minutes
    FROM sessions
    WHERE user_id = ? AND status='done' AND skill IS NOT NULL
      AND started_at >= strftime('%s','now','-30 days')
    GROUP BY skill
    ORDER BY minutes DESC
    LIMIT 5
  `),
  topSkillsAllTime: db.prepare(`
    SELECT skill, SUM(duration_min) AS minutes
    FROM sessions
    WHERE user_id = ? AND status='done' AND skill IS NOT NULL
    GROUP BY skill
    ORDER BY minutes DESC
  `),

  // XP par guilde
  xpByHouse30d: db.prepare(`
    SELECT house_role_id AS house, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ? AND house_role_id IS NOT NULL
      AND at_ts >= strftime('%s','now','-30 days')
    GROUP BY house_role_id
  `),
  xpByHouseAll: db.prepare(`
    SELECT house_role_id AS house, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ? AND house_role_id IS NOT NULL
    GROUP BY house_role_id
  `),

  // leaderboard
  topXP30d: db.prepare(`
    SELECT user_id, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE at_ts >= strftime('%s','now','-30 days')
    GROUP BY user_id
    ORDER BY xp DESC
    LIMIT 10
  `),

  // or & loot
  getGold: db.prepare(`SELECT COALESCE(gold,0) AS gold FROM users WHERE discord_id = ?`),
  spendGold: db.prepare(`
    UPDATE users SET gold = COALESCE(gold,0) - ?
    WHERE discord_id = ? AND COALESCE(gold,0) >= ?
  `),
  addGold: db.prepare(`UPDATE users SET gold = COALESCE(gold,0) + ? WHERE discord_id = ?`),
  insertLoot: db.prepare(`
    INSERT INTO loot(user_id, item_key, house_role_id, rarity, obtained_at) VALUES (?,?,?,?,?)
  `),
  recentLoot: db.prepare(`
    SELECT item_key, rarity, house_role_id, obtained_at
    FROM loot WHERE user_id = ? ORDER BY obtained_at DESC LIMIT 10
  `),
  hasLoot: db.prepare(`SELECT 1 FROM loot WHERE user_id = ? AND item_key = ? LIMIT 1`),
  countLootByKeyForUser: db.prepare(`SELECT COUNT(*) AS c FROM loot WHERE user_id = ? AND item_key = ?`),

  // daily
  getDaily: db.prepare(`SELECT last_claim_ts, streak FROM daily_claims WHERE user_id = ?`),
  upsertDaily: db.prepare(`
    INSERT INTO daily_claims(user_id, last_claim_ts, streak)
    VALUES (?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET last_claim_ts=excluded.last_claim_ts, streak=excluded.streak
  `),

  // boutique (API unifiée)
  getOffersForUserToday: db.prepare(`
    SELECT id, item_key, rarity, price, purchased_ts
    FROM shop_offers
    WHERE user_id = ? AND generated_day = ?
    ORDER BY CASE rarity
      WHEN 'unique' THEN 5
      WHEN 'legendary' THEN 4
      WHEN 'epic' THEN 3
      WHEN 'rare' THEN 2
      ELSE 1 END DESC, price DESC
  `),
  insertOffer: db.prepare(`
    INSERT OR IGNORE INTO shop_offers(user_id, generated_day, house_role_id, item_key, rarity, price)
    VALUES (?,?,?,?,?,?)
  `),
  markOfferPurchased: db.prepare(`
    UPDATE shop_offers
    SET purchased_ts = ?
    WHERE id = ? AND user_id = ? AND purchased_ts IS NULL
  `),
  cleanupOldOffers: db.prepare(`
    DELETE FROM shop_offers
    WHERE generated_day < ?
  `),
};

// -- transactions
export type SessionStatus = 'done' | 'aborted';

export const commitSession = db.transaction((
  userId: string,
  startedAtSec: number,
  durationMin: number,
  status: SessionStatus,
  skill: string | null,
  subject: string | null,
  houseRoleId?: string | null
) => {
  sql.upsertUser.run(userId);
  if (houseRoleId) {
    sql.insertSessionWithHouse.run(userId, startedAtSec, durationMin, status, skill, subject, houseRoleId);
  } else {
    sql.insertSession.run(userId, startedAtSec, durationMin, status, skill, subject);
  }
  if (status === 'done') {
    const now = Math.floor(Date.now() / 1000);
    if (houseRoleId) sql.insertXPWithHouse.run(userId, durationMin, now, houseRoleId);
    else sql.insertXP.run(userId, durationMin, now);
  }
});

export const purchaseXPBoost = db.transaction((
  userId: string,
  xp: number,
  price: number,
  houseRoleId?: string | null
): boolean => {
  sql.upsertUser.run(userId);
  const res = sql.spendGold.run(price, userId, price);
  if (res.changes !== 1) return false;
  const now = Math.floor(Date.now() / 1000);
  if (houseRoleId) sql.insertXPWithHouse.run(userId, xp, now, houseRoleId);
  else sql.insertXP.run(userId, xp, now);
  return true;
});

/** Achat atomique d’une offre boutique */
export function buyShopOffer(userId: string, offerId: number): { ok: boolean; reason?: string } {
  try {
    return db.transaction(() => {
      const row = db.prepare(`
        SELECT id, user_id, item_key, rarity, price, purchased_ts, house_role_id
        FROM shop_offers WHERE id = ? AND user_id = ?
      `).get(offerId, userId) as
        | { id: number; user_id: string; item_key: string; rarity: string; price: number; purchased_ts: number | null; house_role_id: string | null }
        | undefined;

      if (!row) return { ok: false, reason: 'offre introuvable' };
      if (row.purchased_ts) return { ok: false, reason: 'déjà achetée' };

      const goldRow = sql.getGold.get(userId) as { gold?: number } | undefined;
      const gold = goldRow?.gold ?? 0;
      if (gold < row.price) return { ok: false, reason: 'or insuffisant' };

      const now = Math.floor(Date.now() / 1000);

      // Marque l’offre comme achetée (empêche rachats multiples)
      const upd = sql.markOfferPurchased.run(now, row.id, userId);
      if (upd.changes !== 1) return { ok: false, reason: 'conflit' };

      // Débite l'or
      sql.spendGold.run(row.price, userId, row.price);

      // --- Cas spécial : Potion d’XP (+50) ---
      if (row.item_key === 'xp_potion_daily') {
        // On crédite 50 XP directement (pas d'entrée dans loot)
        if (row.house_role_id) {
          sql.insertXPWithHouse.run(userId, 50, now, row.house_role_id);
        } else {
          sql.insertXP.run(userId, 50, now);
        }
        return { ok: true };
      }

      // Cas général : objet de collection → entre dans loot
      db.prepare(`
        INSERT INTO loot(user_id, item_key, house_role_id, rarity, obtained_at)
        VALUES (?,?,?,?,?)
      `).run(userId, row.item_key, row.house_role_id, row.rarity, now);

      return { ok: true };
    })();
  } catch {
    return { ok: false, reason: 'erreur' };
  }
}
