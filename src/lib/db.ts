// src/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './config';

/* -------------------- Ouverture & PRAGMAs -------------------- */
const dir = path.dirname(env.DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(env.DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/* -------------------- Création schéma -------------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  discord_id TEXT PRIMARY KEY,
  prefs_json TEXT DEFAULT '{}',
  gold INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,          -- ts (s)
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
  at_ts INTEGER NOT NULL,               -- ts (s)
  house_role_id TEXT
);

CREATE TABLE IF NOT EXISTS daily_claims(
  user_id TEXT PRIMARY KEY,
  last_claim_ts INTEGER NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(discord_id)
);

-- Inventaire (loot)
CREATE TABLE IF NOT EXISTS loot(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  house_role_id TEXT,
  rarity TEXT NOT NULL,            -- 'common' | 'rare' | 'epic' | 'legendary' | 'unique'
  obtained_at INTEGER NOT NULL
);

-- Offres boutique (par utilisateur & jour UTC)
CREATE TABLE IF NOT EXISTS shop_offers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  day INTEGER,                         -- yyyymmdd (UTC) ; peut être NULL sur anciens schémas
  house_role_id TEXT,
  item_key TEXT NOT NULL,
  rarity TEXT NOT NULL,
  price INTEGER NOT NULL,
  purchased INTEGER NOT NULL DEFAULT 0,
  purchased_at INTEGER                 -- nullable
);
`);

/* -------------------- Migrations légères -------------------- */
function hasColumn(table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some(r => r.name === col);
}
if (!hasColumn('sessions', 'house_role_id')) db.exec(`ALTER TABLE sessions ADD COLUMN house_role_id TEXT`);
if (!hasColumn('xp_log', 'house_role_id')) db.exec(`ALTER TABLE xp_log ADD COLUMN house_role_id TEXT`);
if (!hasColumn('users', 'gold')) db.exec(`ALTER TABLE users ADD COLUMN gold INTEGER NOT NULL DEFAULT 0`);

/* --- compat anciennes colonnes shop_offers --- */
const hasShopGeneratedDay = (() => {
  try {
    const info = db.prepare(`PRAGMA table_info(shop_offers)`).all() as Array<{ name: string }>;
    return info.some(c => c.name === 'generated_day');
  } catch { return false; }
})();

if (!hasColumn('shop_offers', 'day')) {
  db.exec(`ALTER TABLE shop_offers ADD COLUMN day INTEGER`);
  db.exec(`
    UPDATE shop_offers
    SET day = COALESCE(
      ${hasShopGeneratedDay ? 'generated_day' : 'NULL'},
      CAST(strftime('%Y%m%d','now') AS INTEGER)
    )
    WHERE day IS NULL
  `);
}

if (hasShopGeneratedDay) {
  db.exec(`
    UPDATE shop_offers
    SET generated_day = COALESCE(generated_day, day, CAST(strftime('%Y%m%d','now') AS INTEGER))
    WHERE generated_day IS NULL
  `);
}

if (!hasColumn('shop_offers', 'purchased_at')) {
  db.exec(`ALTER TABLE shop_offers ADD COLUMN purchased_at INTEGER`);
}

/* -------------------- Déduplication des loots existants -------------------- */
db.exec(`
DELETE FROM loot
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM loot
  GROUP BY user_id, item_key
);
`);

/* -------------------- Index -------------------- */
db.exec(`
CREATE INDEX IF NOT EXISTS idx_xp_user_ts           ON xp_log(user_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_user_start  ON sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_xp_house_ts          ON xp_log(house_role_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_house_start ON sessions(house_role_id, started_at);
CREATE INDEX IF NOT EXISTS idx_loot_user_ts         ON loot(user_id, obtained_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_loot_user_item ON loot(user_id, item_key);

CREATE INDEX IF NOT EXISTS idx_shop_user_day        ON shop_offers(user_id, day);
CREATE INDEX IF NOT EXISTS idx_shop_user_purchased  ON shop_offers(user_id, purchased);
`);

/* -------------------- Helpers -------------------- */
export function todayUTC(): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  return y * 10000 + m * 100 + d; // yyyymmdd
}

/* -------------------- Requêtes -------------------- */
const _insertOffer6 = db.prepare(`
  INSERT INTO shop_offers(user_id, day, house_role_id, item_key, rarity, price)
  VALUES (?,?,?,?,?,?)
`);
const _insertOffer7 = hasShopGeneratedDay
  ? db.prepare(`
      INSERT INTO shop_offers(user_id, day, house_role_id, item_key, rarity, price, generated_day)
      VALUES (?,?,?,?,?,?,?)
    `)
  : null;

export const sql = {
  /* Users & or */
  upsertUser: db.prepare(`INSERT OR IGNORE INTO users(discord_id) VALUES (?)`),
  getGold: db.prepare(`SELECT COALESCE(gold,0) AS gold FROM users WHERE discord_id = ?`),
  addGold: db.prepare(`UPDATE users SET gold = COALESCE(gold,0) + ? WHERE discord_id = ?`),
  spendGold: db.prepare(`
    UPDATE users
    SET gold = COALESCE(gold, 0) - ?
    WHERE discord_id = ? AND COALESCE(gold, 0) >= ?
  `),

  /* Sessions */
  insertSession: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject)
    VALUES (?,?,?,?,?,?)
  `),
  insertSessionWithHouse: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject, house_role_id)
    VALUES (?,?,?,?,?,?,?)
  `),

  /* XP */
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
    WHERE user_id = ?
      AND status = 'done'
      AND started_at >= strftime('%s','now','-30 days')
  `),

  topSkills30d: db.prepare(`
    SELECT skill, SUM(duration_min) AS minutes
    FROM sessions
    WHERE user_id = ?
      AND status = 'done'
      AND skill IS NOT NULL
      AND started_at >= strftime('%s','now','-30 days')
    GROUP BY skill
    ORDER BY minutes DESC
    LIMIT 3
  `),

  topSkillsAllTime: db.prepare(`
    SELECT skill, SUM(duration_min) AS minutes
    FROM sessions
    WHERE user_id = ?
      AND status = 'done'
      AND skill IS NOT NULL
    GROUP BY skill
    ORDER BY minutes DESC
  `),

  xpByHouse30d: db.prepare(`
    SELECT house_role_id AS house, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ?
      AND house_role_id IS NOT NULL
      AND at_ts >= strftime('%s','now','-30 days')
    GROUP BY house_role_id
  `),
  xpByGuildAllTime: db.prepare(`
    SELECT house_role_id, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ? AND house_role_id IS NOT NULL
    GROUP BY house_role_id
  `),

  /* Leaderboard 30j */
  topXP30d: db.prepare(`
    SELECT user_id, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE at_ts >= strftime('%s','now','-30 days')
    GROUP BY user_id
    ORDER BY xp DESC
    LIMIT 10
  `),

  /* Loot */
  insertLoot: db.prepare(`
    INSERT OR IGNORE INTO loot(user_id, item_key, house_role_id, rarity, obtained_at)
    VALUES (?,?,?,?,?)
  `),
  hasLoot: db.prepare(`SELECT 1 FROM loot WHERE user_id = ? AND item_key = ? LIMIT 1`),
  countLootByKeyForUser: db.prepare(`SELECT COUNT(*) AS c FROM loot WHERE user_id = ? AND item_key = ?`),
  recentLoot: db.prepare(`
    SELECT item_key, rarity, house_role_id, obtained_at
    FROM loot WHERE user_id = ? ORDER BY obtained_at DESC LIMIT 10
  `),

  /* Daily */
  getDaily: db.prepare(`SELECT last_claim_ts, streak FROM daily_claims WHERE user_id = ?`),
  upsertDaily: db.prepare(`
    INSERT INTO daily_claims(user_id, last_claim_ts, streak)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      last_claim_ts = excluded.last_claim_ts,
      streak = excluded.streak
  `),

  /* Shop */
  getOffersForUserToday: db.prepare(`
    SELECT id, user_id, day, house_role_id, item_key, rarity, price, purchased, purchased_at
    FROM shop_offers
    WHERE user_id = ? AND day = ?
    ORDER BY id ASC
  `),
  insertOffer: {
    run: (userId: string, day: number, houseRoleId: string | null, itemKey: string, rarity: string, price: number) => {
      if (hasShopGeneratedDay && _insertOffer7) {
        return _insertOffer7.run(userId, day, houseRoleId, itemKey, rarity, price, day);
      }
      return _insertOffer6.run(userId, day, houseRoleId, itemKey, rarity, price);
    },
  },
  getOfferById: db.prepare(`
    SELECT id, user_id, day, house_role_id, item_key, rarity, price, purchased, purchased_at
    FROM shop_offers
    WHERE id = ?
  `),
  markOfferPurchased: db.prepare(`
    UPDATE shop_offers
    SET purchased = 1, purchased_at = ?
    WHERE id = ? AND user_id = ? AND purchased = 0
  `),
  cleanupOldOffers: db.prepare(`
    DELETE FROM shop_offers
    WHERE day < (SELECT CAST(strftime('%Y%m%d','now','-14 days') AS INTEGER))
  `),
};

/* -------------------- Transactions utiles -------------------- */
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

/* Achat d’une offre de boutique (débit or + ajout loot, atomique) */
export const buyShopOffer = db.transaction((userId: string, offerId: number): { ok: true } | { ok: false; reason: string } => {
  sql.upsertUser.run(userId);

  const off = sql.getOfferById.get(offerId) as
    | { id: number; user_id: string; day: number; house_role_id?: string | null; item_key: string; rarity: string; price: number; purchased: number }
    | undefined;

  if (!off) return { ok: false, reason: 'offre introuvable' };
  if (off.user_id !== userId) return { ok: false, reason: 'offre non liée à cet utilisateur' };
  if (off.purchased) return { ok: false, reason: 'déjà achetée' };

  const res = sql.spendGold.run(off.price, userId, off.price);
  if (res.changes !== 1) return { ok: false, reason: 'or insuffisant' };

  const now = Math.floor(Date.now() / 1000);
  const upd = sql.markOfferPurchased.run(now, off.id, userId);
  if (upd.changes !== 1) return { ok: false, reason: 'conflit achat' };

  sql.insertLoot.run(userId, off.item_key, off.house_role_id ?? null, off.rarity, now);
  return { ok: true };
});

/* Achat d’XP direct (optionnel) */
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
