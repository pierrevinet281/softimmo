import { getDb } from '../index.js';
import { newId, now, parseJson, toJson, buildUpdate } from '../helpers.js';

const JSON_COLS = ['socials'];

// Columns a client may write via create/update (excludes id/timestamps).
const WRITABLE = new Set([
  'tenant_id', 'name', 'domain', 'website', 'industry', 'sic_code', 'naics_code', 'size',
  'address', 'city', 'state', 'postal_code', 'location', 'country', 'description', 'logo_url',
  'phone', 'linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'socials', 'source',
  'status', 'grade', 'completeness', 'notes',
]);

function rowOut(row) {
  if (!row) return null;
  const out = { ...row };
  for (const c of JSON_COLS) out[c] = parseJson(row[c], null);
  return out;
}

export const Companies = {
  create(data) {
    const db = getDb();
    const id = data.id || newId('cmp');
    const ts = now();
    const rec = {
      id,
      tenant_id: data.tenant_id ?? null,
      name: data.name,
      domain: data.domain ?? null,
      website: data.website ?? null,
      industry: data.industry ?? null,
      sic_code: data.sic_code ?? null,
      naics_code: data.naics_code ?? null,
      size: data.size ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postal_code: data.postal_code ?? null,
      location: data.location ?? null,
      country: data.country ?? null,
      description: data.description ?? null,
      logo_url: data.logo_url ?? null,
      phone: data.phone ?? null,
      linkedin: data.linkedin ?? null,
      facebook: data.facebook ?? null,
      instagram: data.instagram ?? null,
      youtube: data.youtube ?? null,
      twitter: data.twitter ?? null,
      socials: toJson(data.socials ?? null),
      source: data.source ?? null,
      status: data.status ?? 'new',
      grade: data.grade ?? null,
      completeness: data.completeness ?? 0,
      notes: data.notes ?? null,
      created_at: ts,
      updated_at: ts,
    };
    db.prepare(`INSERT INTO companies
      (id,tenant_id,name,domain,website,industry,sic_code,naics_code,size,address,city,state,postal_code,location,country,description,logo_url,phone,linkedin,facebook,instagram,youtube,twitter,socials,source,status,grade,completeness,notes,created_at,updated_at)
      VALUES (@id,@tenant_id,@name,@domain,@website,@industry,@sic_code,@naics_code,@size,@address,@city,@state,@postal_code,@location,@country,@description,@logo_url,@phone,@linkedin,@facebook,@instagram,@youtube,@twitter,@socials,@source,@status,@grade,@completeness,@notes,@created_at,@updated_at)`).run(rec);
    return this.get(id);
  },

  get(id) {
    return rowOut(getDb().prepare('SELECT * FROM companies WHERE id = ?').get(id));
  },

  findByDomain(domain) {
    if (!domain) return null;
    return rowOut(getDb().prepare('SELECT * FROM companies WHERE domain = ? LIMIT 1').get(domain));
  },

  update(id, fields) {
    const db = getDb();
    // Keep only real, writable columns (plus computed grade/completeness/status).
    const patch = {};
    for (const [k, v] of Object.entries(fields)) if (WRITABLE.has(k)) patch[k] = v;
    if ('socials' in patch) patch.socials = toJson(patch.socials);
    patch.updated_at = now();
    const { set, params } = buildUpdate(patch);
    if (!set) return this.get(id);
    db.prepare(`UPDATE companies SET ${set} WHERE id = @id`).run({ ...params, id });
    return this.get(id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM companies WHERE id = ?').run(id).changes;
  },

  list({ q, status, limit = 50, offset = 0, sort = 'updated_at', dir = 'desc' } = {}) {
    const db = getDb();
    const where = [];
    const p = {};
    if (q) { where.push('(name LIKE @q OR domain LIKE @q OR industry LIKE @q)'); p.q = `%${q}%`; }
    if (status) { where.push('status = @status'); p.status = status; }
    const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeSort = ['name', 'updated_at', 'created_at', 'grade', 'completeness'].includes(sort) ? sort : 'updated_at';
    const safeDir = dir === 'asc' ? 'ASC' : 'DESC';
    const rows = db.prepare(`SELECT * FROM companies ${wsql} ORDER BY ${safeSort} ${safeDir} LIMIT @limit OFFSET @offset`)
      .all({ ...p, limit, offset });
    const total = db.prepare(`SELECT COUNT(*) n FROM companies ${wsql}`).get(p).n;
    return { rows: rows.map(rowOut), total };
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) n FROM companies').get().n;
  },
};

export default Companies;
