import { getDb, transaction } from '../index.js';
import { newId, parseJson, toJson } from '../helpers.js';

// Reference data: single source of truth for engine lists (disposable domains,
// free providers, role local-parts, seniority keywords). Cached in-process.
let _cache = null;

function loadCache() {
  if (_cache) return _cache;
  const rows = getDb().prepare('SELECT category, value, meta FROM reference_data').all();
  const byCat = {};
  for (const r of rows) {
    (byCat[r.category] ||= []).push({ value: r.value, meta: parseJson(r.meta, null) });
  }
  _cache = byCat;
  return _cache;
}

export const Reference = {
  invalidate() { _cache = null; },

  // Plain string list for a category (values only).
  values(category) {
    return (loadCache()[category] || []).map((x) => x.value);
  },

  // Full entries (value + meta).
  entries(category) {
    return loadCache()[category] || [];
  },

  upsertMany(category, items) {
    transaction((db) => {
      const stmt = db.prepare(`INSERT INTO reference_data (id,category,value,meta)
        VALUES (?,?,?,?)
        ON CONFLICT(category,value) DO UPDATE SET meta=excluded.meta`);
      for (const it of items) {
        if (typeof it === 'string') stmt.run(newId('ref'), category, it.toLowerCase(), null);
        else stmt.run(newId('ref'), category, String(it.value).toLowerCase(), toJson(it.meta || null));
      }
    });
    this.invalidate();
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) n FROM reference_data').get().n;
  },
};

export default Reference;
