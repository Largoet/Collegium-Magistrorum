// src/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './config';

// 1) dossier data
const dir = path.dirname(env.DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 2) ouvrir la base + réglages
export const db = new Database(env.DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000'); // éviter SQLITE_BUSY

// 3) schéma de base
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  discord_id TEXT PRIMARY KEY,
  prefs_json TEXT DEFAULT '{}',
  gold INTEGER NOT NULL DEFAULT 0          -- ➕ or
);
CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,          -- ts (s)
  duration_min INTEGER NOT NULL,
  status TEXT CHECK(status IN ('done','aborted')) NOT NULL,
  skill TEXT,
  subject TEXT,
  house_role_id TEXT,                   -- ➕ tag guilde
  FOREIGN KEY(user_id) REFERENCES users(discord_id)
);
CREATE TABLE IF NOT EXISTS xp_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta_xp INTEGER NOT NULL,
  at_ts INTEGER NOT NULL,               -- ts (s)
  house_role_id TEXT                    -- ➕ tag guilde
);
`);

// 3bis) migrations légères
function hasColumn(table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some(r => r.name === col);
}
if (!hasColumn('sessions', 'house_role_id')) {
  db.exec(`ALTER TABLE sessions ADD COLUMN house_role_id TEXT`);
}
if (!hasColumn('xp_log', 'house_role_id')) {
  db.exec(`ALTER TABLE xp_log ADD COLUMN house_role_id TEXT`);
}
if (!hasColumn('users', 'gold')) {
  db.exec(`ALTER TABLE users ADD COLUMN gold INTEGER NOT NULL DEFAULT 0`);
}

// 3ter) table loot (inventaire)
db.exec(`
CREATE TABLE IF NOT EXISTS loot(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  house_role_id TEXT,
  rarity TEXT NOT NULL,            -- 'common' | 'rare' | 'epic'
  obtained_at INTEGER NOT NULL     -- ts (s)
);
`);

// ➕ ADDED: 3quinquies) table daily claims (récompense quotidienne)
db.exec(`
CREATE TABLE IF NOT EXISTS daily_claims(
  user_id TEXT PRIMARY KEY,
  last_claim_ts INTEGER NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(discord_id)
);
`);

// 3quater) index utiles
db.exec(`
CREATE INDEX IF NOT EXISTS idx_xp_user_ts           ON xp_log(user_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_user_start  ON sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_xp_house_ts          ON xp_log(house_role_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_house_start ON sessions(house_role_id, started_at);
CREATE INDEX IF NOT EXISTS idx_loot_user_ts         ON loot(user_id, obtained_at DESC);
`);

// 4) requêtes
export const sql = {
  upsertUser: db.prepare(`INSERT OR IGNORE INTO users(discord_id) VALUES (?)`),

  insertSession: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject)
    VALUES (?,?,?,?,?,?)
  `),
  insertSessionWithHouse: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject, house_role_id)
    VALUES (?,?,?,?,?,?,?)
  `),

  insertXP: db.prepare(`
    INSERT INTO xp_log(user_id, delta_xp, at_ts) VALUES (?,?,?)
  `),
  insertXPWithHouse: db.prepare(`
    INSERT INTO xp_log(user_id, delta_xp, at_ts, house_role_id) VALUES (?,?,?,?)
  `),

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
  xpByHouse30d: db.prepare(`
    SELECT house_role_id AS house, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ?
      AND house_role_id IS NOT NULL
      AND at_ts >= strftime('%s','now','-30 days')
    GROUP BY house_role_id
  `),
  xpByHouseAll: db.prepare(`
    SELECT house_role_id AS house, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ?
      AND house_role_id IS NOT NULL
    GROUP BY house_role_id
  `),

  // ➕ ADDED: leaderboard (XP 30j)
  topXP30d: db.prepare(`
    SELECT user_id, COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE at_ts >= strftime('%s','now','-30 days')
    GROUP BY user_id
    ORDER BY xp DESC
    LIMIT 10
  `),

  // Or & loot
  getGold: db.prepare(`
    SELECT COALESCE(gold,0) AS gold FROM users WHERE discord_id = ?
  `),
  spendGold: db.prepare(`                      -- débit d'or conditionnel
    UPDATE users
    SET gold = COALESCE(gold, 0) - ?
    WHERE discord_id = ? AND COALESCE(gold, 0) >= ?
  `),
  addGold: db.prepare(`
    UPDATE users SET gold = COALESCE(gold,0) + ? WHERE discord_id = ?
  `),
  insertLoot: db.prepare(`
    INSERT INTO loot(user_id, item_key, house_role_id, rarity, obtained_at) VALUES (?,?,?,?,?)
  `),
  recentLoot: db.prepare(`
    SELECT item_key, rarity, house_role_id, obtained_at
    FROM loot WHERE user_id = ? ORDER BY obtained_at DESC LIMIT 10
  `),

  // ➕ ADDED: daily
  getDaily: db.prepare(`
    SELECT last_claim_ts, streak FROM daily_claims WHERE user_id = ?
  `),
  upsertDaily: db.prepare(`
    INSERT INTO daily_claims(user_id, last_claim_ts, streak)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET last_claim_ts = excluded.last_claim_ts, streak = excluded.streak
  `),
};

// 5) transaction session
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
    if (houseRoleId) {
      sql.insertXPWithHouse.run(userId, durationMin, now, houseRoleId);
    } else {
      sql.insertXP.run(userId, durationMin, now);
    }
  }
});

// ➕ ADDED: transaction d'achat d'XP avec débit d'or atomique
export const purchaseXPBoost = db.transaction((
  userId: string,
  xp: number,
  price: number,
  houseRoleId?: string | null
): boolean => {
  sql.upsertUser.run(userId);

  // Tente de débiter; si pas assez d’or, aucune modification (changes = 0)
  const res = sql.spendGold.run(price, userId, price);
  if (res.changes !== 1) return false;

  const now = Math.floor(Date.now() / 1000);
  if (houseRoleId) {
    sql.insertXPWithHouse.run(userId, xp, now, houseRoleId);
  } else {
    sql.insertXP.run(userId, xp, now);
  }
  return true;
});
