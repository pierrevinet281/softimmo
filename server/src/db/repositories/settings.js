import { getDb } from '../index.js';
import { parseJson, toJson } from '../helpers.js';

// Settings stored as JSON-encoded values keyed by string. A small typed facade.
export const Settings = {
  get(key, fallback = null) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? parseJson(row.value, row.value) : fallback;
  },
  set(key, value) {
    getDb().prepare(`INSERT INTO settings (key,value) VALUES (?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, toJson(value));
    return value;
  },
  all() {
    const rows = getDb().prepare('SELECT key,value FROM settings').all();
    const out = {};
    for (const r of rows) out[r.key] = parseJson(r.value, r.value);
    return out;
  },
};

export default Settings;
