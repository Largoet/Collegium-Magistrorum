// Connexion SQLite + schéma minimal (users, sessions, xp_log, streaks, skills).
// TODO: ouvrir la DB, créer les tables si besoin, préparer quelques requêtes.
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

// 3) schéma minimal (MVP)
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  discord_id TEXT PRIMARY KEY,
  prefs_json TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
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
  at_ts INTEGER NOT NULL
);
`);

// 4) petites requêtes prêtes à l'emploi
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
};
