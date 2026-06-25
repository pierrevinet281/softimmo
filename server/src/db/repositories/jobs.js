import { getDb } from '../index.js';
import { newId, now, parseJson, toJson, buildUpdate } from '../helpers.js';

function jobOut(row) {
  if (!row) return null;
  return { ...row, params: parseJson(row.params, {}), result: parseJson(row.result, null) };
}
function itemOut(row) {
  if (!row) return null;
  return { ...row, input: parseJson(row.input, {}), result: parseJson(row.result, null) };
}

export const Jobs = {
  create({ type, params = {}, total = 0, tenant_id = null }) {
    const db = getDb();
    const id = newId('job');
    const ts = now();
    db.prepare(`INSERT INTO jobs (id,tenant_id,type,status,params,total,created_at,updated_at)
      VALUES (@id,@tenant_id,@type,'queued',@params,@total,@ts,@ts)`)
      .run({ id, tenant_id, type, params: toJson(params), total, ts });
    return this.get(id);
  },

  get(id) {
    return jobOut(getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id));
  },

  update(id, fields) {
    const db = getDb();
    const patch = { ...fields, updated_at: now() };
    if ('params' in patch) patch.params = toJson(patch.params);
    if ('result' in patch) patch.result = toJson(patch.result);
    delete patch.id;
    const { set, params } = buildUpdate(patch);
    if (!set) return this.get(id);
    db.prepare(`UPDATE jobs SET ${set} WHERE id = @id`).run({ ...params, id });
    return this.get(id);
  },

  list({ type, status, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    const where = [];
    const p = {};
    if (type) { where.push('type = @type'); p.type = type; }
    if (status) { where.push('status = @status'); p.status = status; }
    const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM jobs ${wsql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
      .all({ ...p, limit, offset });
    const total = db.prepare(`SELECT COUNT(*) n FROM jobs ${wsql}`).get(p).n;
    return { rows: rows.map(jobOut), total };
  },

  // ── items ──
  addItem({ job_id, entity_type = null, entity_id = null, input = {} }) {
    const db = getDb();
    const id = newId('jit');
    const ts = now();
    db.prepare(`INSERT INTO job_items (id,job_id,entity_type,entity_id,input,status,created_at,updated_at)
      VALUES (@id,@job_id,@entity_type,@entity_id,@input,'queued',@ts,@ts)`)
      .run({ id, job_id, entity_type, entity_id, input: toJson(input), ts });
    return id;
  },

  getItem(id) {
    return itemOut(getDb().prepare('SELECT * FROM job_items WHERE id = ?').get(id));
  },

  updateItem(id, fields) {
    const db = getDb();
    const patch = { ...fields, updated_at: now() };
    if ('input' in patch) patch.input = toJson(patch.input);
    if ('result' in patch) patch.result = toJson(patch.result);
    delete patch.id;
    const { set, params } = buildUpdate(patch);
    if (!set) return this.getItem(id);
    db.prepare(`UPDATE job_items SET ${set} WHERE id = @id`).run({ ...params, id });
    return this.getItem(id);
  },

  items(job_id) {
    return getDb().prepare('SELECT * FROM job_items WHERE job_id = ? ORDER BY created_at ASC').all(job_id).map(itemOut);
  },

  nextQueuedItem(job_id) {
    return itemOut(getDb().prepare(`SELECT * FROM job_items WHERE job_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1`).get(job_id));
  },

  // Jobs that should resume on boot.
  resumable() {
    return getDb().prepare(`SELECT * FROM jobs WHERE status IN ('queued','running') ORDER BY created_at ASC`).all().map(jobOut);
  },

  recomputeProgress(job_id) {
    const db = getDb();
    const agg = db.prepare(`SELECT
        COUNT(*) total,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done,
        SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) err,
        SUM(CASE WHEN status IN ('done','error','skipped') THEN 1 ELSE 0 END) processed
      FROM job_items WHERE job_id = ?`).get(job_id);
    const progress = agg.total ? agg.processed / agg.total : 0;
    this.update(job_id, { processed: agg.processed, succeeded: agg.done, failed: agg.err, progress });
    return agg;
  },
};

export default Jobs;
