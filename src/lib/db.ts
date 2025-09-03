// src/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './config';

// 1) s'assurer que le dossier data existe
const dir = path.dirname(env.DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 2) ouvrir la base + réglages safe
export const db = new Database(env.DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000'); // évite SQLITE_BUSY quand il y a un peu de concurrence

// 3) schéma minimal (MVP)
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  discord_id TEXT PRIMARY KEY,
  prefs_json TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,          -- timestamp (s)
  duration_min INTEGER NOT NULL,
  status TEXT CHECK(status IN ('done','aborted')) NOT NULL,
  skill TEXT,
  subject TEXT,
  FOREIGN KEY(user_id) REFERENCES users(discord_id)
);
CREATE TABLE IF NOT EXISTS xp_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta_xp INTEGER NOT NULL,
  at_ts INTEGER NOT NULL                 -- timestamp (s)
);
`);

// 3bis) index utiles (perf /profile et historique)
db.exec(`
CREATE INDEX IF NOT EXISTS idx_xp_user_ts
  ON xp_log(user_id, at_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_user_start
  ON sessions(user_id, started_at);
`);

// 4) requêtes
export const sql = {
  upsertUser: db.prepare(`INSERT OR IGNORE INTO users(discord_id) VALUES (?)`),

  insertSession: db.prepare(`
    INSERT INTO sessions(user_id, started_at, duration_min, status, skill, subject)
    VALUES (?,?,?,?,?,?)
  `),

  insertXP: db.prepare(`
    INSERT INTO xp_log(user_id, delta_xp, at_ts) VALUES (?,?,?)
  `),

  totalXP30d: db.prepare(`
    SELECT COALESCE(SUM(delta_xp),0) AS xp
    FROM xp_log
    WHERE user_id = ? AND at_ts >= strftime('%s','now','-30 days')
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
};


// 5) transaction atomique pour valider une session
export type SessionStatus = 'done' | 'aborted';

export const commitSession = db.transaction((
  userId: string,
  startedAtSec: number,
  durationMin: number,
  status: SessionStatus,
  skill: string | null,
  subject: string | null
) => {
  sql.upsertUser.run(userId);
  sql.insertSession.run(userId, startedAtSec, durationMin, status, skill, subject);
  if (status === 'done') {
    sql.insertXP.run(userId, durationMin, Math.floor(Date.now() / 1000));
  }
});
