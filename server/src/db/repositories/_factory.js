// Generic repository factory for Softimmo business entities (CRUD + list).
// Keeps the data-access layer DRY: every entity declares its table, writable columns,
// JSON columns and searchable/sortable columns, and gets a consistent repo. Mirrors the
// hand-written companies/contacts repos (same getDb()/helpers conventions).
import { getDb } from '../index.js';
import { newId, now, parseJson, toJson, buildUpdate } from '../helpers.js';

/**
 * @param {object} cfg
 * @param {string} cfg.table        SQL table name
 * @param {string} cfg.idPrefix     id prefix (e.g. 'prop')
 * @param {string[]} cfg.writable   columns a client may write (excl. id/timestamps)
 * @param {string[]} [cfg.jsonCols] columns stored as JSON text
 * @param {string[]} [cfg.searchCols] columns matched by the `q` search param
 * @param {string[]} [cfg.sortCols]   columns allowed in ORDER BY
 * @param {string[]} [cfg.filterCols] columns allowed as exact-match list filters (e.g. property_id)
 * @param {object}  [cfg.defaults]  default values applied on create
 */
export function makeRepo(cfg) {
  const {
    table, idPrefix, writable,
    jsonCols = [], searchCols = [], sortCols = [],
    filterCols = [], defaults = {},
  } = cfg;
  const writableSet = new Set(writable);
  const jsonSet = new Set(jsonCols);

  const rowOut = (row) => {
    if (!row) return null;
    const out = { ...row };
    for (const c of jsonCols) out[c] = parseJson(row[c], null);
    return out;
  };

  const repo = {
    table,

    create(data = {}) {
      const db = getDb();
      const id = data.id || newId(idPrefix);
      const ts = now();
      const rec = { id, created_at: ts, updated_at: ts };
      for (const col of writable) {
        let v = data[col] !== undefined ? data[col] : (defaults[col] !== undefined ? defaults[col] : null);
        if (jsonSet.has(col)) v = toJson(v);
        rec[col] = v;
      }
      const cols = ['id', ...writable, 'created_at', 'updated_at'];
      const placeholders = cols.map((c) => `@${c}`).join(',');
      db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).run(rec);
      return this.get(id);
    },

    get(id) {
      return rowOut(getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id));
    },

    update(id, fields = {}) {
      const db = getDb();
      const patch = {};
      for (const [k, v] of Object.entries(fields)) {
        if (!writableSet.has(k)) continue;
        patch[k] = jsonSet.has(k) ? toJson(v) : v;
      }
      patch.updated_at = now();
      const { set, params } = buildUpdate(patch);
      if (!set) return this.get(id);
      db.prepare(`UPDATE ${table} SET ${set} WHERE id = @id`).run({ ...params, id });
      return this.get(id);
    },

    delete(id) {
      return getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes;
    },

    list({ q, limit = 100, offset = 0, sort = 'updated_at', dir = 'desc', ...filters } = {}) {
      const db = getDb();
      const where = [];
      const p = {};
      if (q && searchCols.length) {
        where.push('(' + searchCols.map((c) => `${c} LIKE @q`).join(' OR ') + ')');
        p.q = `%${q}%`;
      }
      for (const col of filterCols) {
        if (filters[col] !== undefined && filters[col] !== '' && filters[col] !== null) {
          where.push(`${col} = @f_${col}`);
          p[`f_${col}`] = filters[col];
        }
      }
      const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const safeSort = sortCols.includes(sort) ? sort : 'updated_at';
      const safeDir = dir === 'asc' ? 'ASC' : 'DESC';
      const lim = Math.min(parseInt(limit, 10) || 100, 1000);
      const off = parseInt(offset, 10) || 0;
      const rows = db.prepare(`SELECT * FROM ${table} ${wsql} ORDER BY ${safeSort} ${safeDir} LIMIT @limit OFFSET @offset`)
        .all({ ...p, limit: lim, offset: off });
      const total = db.prepare(`SELECT COUNT(*) n FROM ${table} ${wsql}`).get(p).n;
      return { rows: rows.map(rowOut), total };
    },

    // Convenience: all rows where `field` = value (e.g. listBy('property_id', id)).
    listBy(field, value, { sort = 'created_at', dir = 'asc' } = {}) {
      const safeSort = sortCols.includes(field) || sortCols.includes(sort) ? sort : 'created_at';
      const safeDir = dir === 'asc' ? 'ASC' : 'DESC';
      const rows = getDb().prepare(`SELECT * FROM ${table} WHERE ${field} = ? ORDER BY ${safeSort} ${safeDir}`).all(value);
      return rows.map(rowOut);
    },

    count() {
      return getDb().prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
    },
  };

  return repo;
}

export default makeRepo;
