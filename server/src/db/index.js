// SQLite connection using Node's built-in `node:sqlite` (DatabaseSync).
// Chosen over native add-ons (better-sqlite3) so there is NO compilation step and
// NO native dependency — works on Node 24+ out of the box and keeps the stack 100%
// owned with zero third-party binaries. API is synchronous, like better-sqlite3.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../lib/config.js';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new DatabaseSync(config.dbPath);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  return _db;
}

// Lightweight transaction helper (node:sqlite has no db.transaction()).
export function transaction(fn) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw e;
  }
}

// Columns added after the initial release. ALTER TABLE ADD COLUMN for any that are
// missing, so existing databases upgrade without losing data (SQLite has no
// "ADD COLUMN IF NOT EXISTS").
const COLUMN_ADDITIONS = {
  companies: [
    ['sic_code', 'TEXT'], ['naics_code', 'TEXT'], ['address', 'TEXT'], ['city', 'TEXT'],
    ['state', 'TEXT'], ['postal_code', 'TEXT'], ['linkedin', 'TEXT'], ['facebook', 'TEXT'],
    ['instagram', 'TEXT'], ['youtube', 'TEXT'], ['twitter', 'TEXT'],
  ],
  contacts: [
    ['extension', 'TEXT'], ['mobile', 'TEXT'], ['facebook', 'TEXT'], ['instagram', 'TEXT'],
    ['youtube', 'TEXT'], ['twitter', 'TEXT'], ['tiktok', 'TEXT'], ['whatsapp', 'TEXT'],
    ['reddit', 'TEXT'], ['wechat', 'TEXT'], ['telegram', 'TEXT'], ['threads', 'TEXT'],
  ],
};

function ensureColumns(db) {
  for (const [table, cols] of Object.entries(COLUMN_ADDITIONS)) {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [name, type] of cols) {
      if (!existing.has(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
        logger.info(`Migrated: added ${table}.${name}`);
      }
    }
  }
}

// Apply schema.sql (idempotent) + column migrations. Safe to call on every boot.
export function migrate() {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  ensureColumns(db);
  logger.ok('DB schema applied:', config.dbPath);
  return db;
}

export default getDb;
