import { getDb, transaction } from '../index.js';
import { newId, now, parseJson, toJson, buildUpdate } from '../helpers.js';

function out(row) {
  if (!row) return null;
  return { ...row, filter: parseJson(row.filter, null) };
}

export const Lists = {
  create({ name, kind = 'static', entity_type = 'contact', filter = null, color = null, tenant_id = null }) {
    const db = getDb();
    const id = newId('lst');
    const ts = now();
    db.prepare(`INSERT INTO lists (id,tenant_id,name,kind,entity_type,filter,color,created_at,updated_at)
      VALUES (@id,@tenant_id,@name,@kind,@entity_type,@filter,@color,@ts,@ts)`)
      .run({ id, tenant_id, name, kind, entity_type, filter: toJson(filter), color, ts });
    return this.get(id);
  },
  get(id) { return out(getDb().prepare('SELECT * FROM lists WHERE id = ?').get(id)); },
  update(id, fields) {
    const patch = { ...fields, updated_at: now() };
    if ('filter' in patch) patch.filter = toJson(patch.filter);
    delete patch.id;
    const { set, params } = buildUpdate(patch);
    if (!set) return this.get(id);
    getDb().prepare(`UPDATE lists SET ${set} WHERE id=@id`).run({ ...params, id });
    return this.get(id);
  },
  delete(id) { return getDb().prepare('DELETE FROM lists WHERE id=?').run(id).changes; },
  all() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM lists ORDER BY created_at DESC').all().map(out);
    for (const r of rows) {
      r.member_count = db.prepare('SELECT COUNT(*) n FROM list_members WHERE list_id=?').get(r.id).n;
    }
    return rows;
  },
  addMembers(list_id, entity_type, ids = []) {
    const ts = now();
    transaction((db) => {
      const stmt = db.prepare(`INSERT OR IGNORE INTO list_members (list_id,entity_type,entity_id,added_at)
        VALUES (?,?,?,?)`);
      for (const eid of ids) stmt.run(list_id, entity_type, eid, ts);
    });
    return ids.length;
  },
  removeMember(list_id, entity_type, entity_id) {
    return getDb().prepare('DELETE FROM list_members WHERE list_id=? AND entity_type=? AND entity_id=?')
      .run(list_id, entity_type, entity_id).changes;
  },
  memberIds(list_id) {
    return getDb().prepare('SELECT entity_type,entity_id FROM list_members WHERE list_id=?').all(list_id);
  },
};

export default Lists;
