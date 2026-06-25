import { getDb } from '../index.js';
import { newId, now, parseJson, toJson } from '../helpers.js';

export const Activity = {
  log({ kind, entity_type = null, entity_id = null, summary = null, meta = null, tenant_id = null }) {
    const db = getDb();
    const id = newId('act');
    db.prepare(`INSERT INTO activity (id,tenant_id,kind,entity_type,entity_id,summary,meta,created_at)
      VALUES (@id,@tenant_id,@kind,@entity_type,@entity_id,@summary,@meta,@created_at)`)
      .run({ id, tenant_id, kind, entity_type, entity_id, summary, meta: toJson(meta), created_at: now() });
    return id;
  },
  recent({ limit = 100, offset = 0 } = {}) {
    return getDb().prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset)
      .map((r) => ({ ...r, meta: parseJson(r.meta, null) }));
  },
};

export default Activity;
