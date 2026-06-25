import { getDb } from '../index.js';
import { newId, now, parseJson, toJson, buildUpdate } from '../helpers.js';

const JSON_COLS = ['socials'];

const WRITABLE = new Set([
  'tenant_id', 'company_id', 'company_name', 'first_name', 'last_name', 'full_name', 'title',
  'role', 'seniority', 'email', 'email_status', 'phone', 'extension', 'mobile', 'phone_type',
  'linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok', 'whatsapp', 'reddit',
  'wechat', 'telegram', 'threads', 'socials', 'location', 'country', 'source', 'status',
  'grade', 'completeness', 'notes',
]);

function rowOut(row) {
  if (!row) return null;
  const out = { ...row };
  for (const c of JSON_COLS) out[c] = parseJson(row[c], null);
  return out;
}

// Derive full_name / first / last consistently.
function normalizeNames(d) {
  let { first_name, last_name, full_name } = d;
  if (!full_name && (first_name || last_name)) {
    full_name = [first_name, last_name].filter(Boolean).join(' ').trim();
  }
  if (full_name && !first_name && !last_name) {
    const parts = full_name.trim().split(/\s+/);
    if (parts.length >= 2) { first_name = parts[0]; last_name = parts.slice(1).join(' '); }
    else first_name = full_name;
  }
  return { first_name: first_name ?? null, last_name: last_name ?? null, full_name: full_name ?? null };
}

export const Contacts = {
  create(data) {
    const db = getDb();
    const id = data.id || newId('ctc');
    const ts = now();
    const names = normalizeNames(data);
    const rec = {
      id,
      tenant_id: data.tenant_id ?? null,
      company_id: data.company_id ?? null,
      company_name: data.company_name ?? null,
      first_name: names.first_name,
      last_name: names.last_name,
      full_name: names.full_name,
      title: data.title ?? null,
      role: data.role ?? null,
      seniority: data.seniority ?? null,
      email: data.email ?? null,
      email_status: data.email_status ?? 'unknown',
      phone: data.phone ?? null,
      extension: data.extension ?? null,
      mobile: data.mobile ?? null,
      phone_type: data.phone_type ?? null,
      linkedin: data.linkedin ?? null,
      facebook: data.facebook ?? null,
      instagram: data.instagram ?? null,
      youtube: data.youtube ?? null,
      twitter: data.twitter ?? null,
      tiktok: data.tiktok ?? null,
      whatsapp: data.whatsapp ?? null,
      reddit: data.reddit ?? null,
      wechat: data.wechat ?? null,
      telegram: data.telegram ?? null,
      threads: data.threads ?? null,
      socials: toJson(data.socials ?? null),
      location: data.location ?? null,
      country: data.country ?? null,
      source: data.source ?? null,
      status: data.status ?? 'new',
      grade: data.grade ?? null,
      completeness: data.completeness ?? 0,
      notes: data.notes ?? null,
      created_at: ts,
      updated_at: ts,
    };
    db.prepare(`INSERT INTO contacts
      (id,tenant_id,company_id,company_name,first_name,last_name,full_name,title,role,seniority,email,email_status,phone,extension,mobile,phone_type,linkedin,facebook,instagram,youtube,twitter,tiktok,whatsapp,reddit,wechat,telegram,threads,socials,location,country,source,status,grade,completeness,notes,created_at,updated_at)
      VALUES (@id,@tenant_id,@company_id,@company_name,@first_name,@last_name,@full_name,@title,@role,@seniority,@email,@email_status,@phone,@extension,@mobile,@phone_type,@linkedin,@facebook,@instagram,@youtube,@twitter,@tiktok,@whatsapp,@reddit,@wechat,@telegram,@threads,@socials,@location,@country,@source,@status,@grade,@completeness,@notes,@created_at,@updated_at)`).run(rec);
    return this.get(id);
  },

  get(id) {
    return rowOut(getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id));
  },

  update(id, fields) {
    const db = getDb();
    let patch = { ...fields };
    if (patch.first_name !== undefined || patch.last_name !== undefined || patch.full_name !== undefined) {
      const cur = this.get(id) || {};
      const names = normalizeNames({
        first_name: patch.first_name ?? cur.first_name,
        last_name: patch.last_name ?? cur.last_name,
        full_name: patch.full_name !== undefined ? patch.full_name : (patch.first_name !== undefined || patch.last_name !== undefined ? null : cur.full_name),
      });
      patch = { ...patch, ...names };
    }
    // Keep only real, writable columns.
    const filtered = {};
    for (const [k, v] of Object.entries(patch)) if (WRITABLE.has(k)) filtered[k] = v;
    patch = filtered;
    if ('socials' in patch) patch.socials = toJson(patch.socials);
    patch.updated_at = now();
    const { set, params } = buildUpdate(patch);
    if (!set) return this.get(id);
    db.prepare(`UPDATE contacts SET ${set} WHERE id = @id`).run({ ...params, id });
    return this.get(id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id).changes;
  },

  list({ q, status, company_id, email_status, limit = 50, offset = 0, sort = 'updated_at', dir = 'desc' } = {}) {
    const db = getDb();
    const where = [];
    const p = {};
    if (q) { where.push('(full_name LIKE @q OR email LIKE @q OR company_name LIKE @q OR title LIKE @q)'); p.q = `%${q}%`; }
    if (status) { where.push('status = @status'); p.status = status; }
    if (company_id) { where.push('company_id = @company_id'); p.company_id = company_id; }
    if (email_status) { where.push('email_status = @email_status'); p.email_status = email_status; }
    const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeSort = ['full_name', 'updated_at', 'created_at', 'grade', 'completeness', 'company_name'].includes(sort) ? sort : 'updated_at';
    const safeDir = dir === 'asc' ? 'ASC' : 'DESC';
    const rows = db.prepare(`SELECT * FROM contacts ${wsql} ORDER BY ${safeSort} ${safeDir} LIMIT @limit OFFSET @offset`)
      .all({ ...p, limit, offset });
    const total = db.prepare(`SELECT COUNT(*) n FROM contacts ${wsql}`).get(p).n;
    return { rows: rows.map(rowOut), total };
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) n FROM contacts').get().n;
  },

  // For dedup / pattern reuse.
  findByEmail(email) {
    if (!email) return null;
    return rowOut(getDb().prepare('SELECT * FROM contacts WHERE email = ? LIMIT 1').get(email));
  },
};

export default Contacts;
