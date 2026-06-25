import { getDb } from '../index.js';
import { newId, now, parseJson, toJson } from '../helpers.js';

function provOut(row) {
  if (!row) return null;
  return { ...row, categories: parseJson(row.categories, []), is_free: !!row.is_free, is_open_source: !!row.is_open_source };
}

// Mask secrets before sending a connection to the client.
function maskCreds(creds) {
  const c = parseJson(creds, null);
  if (!c) return null;
  const masked = {};
  for (const [k, v] of Object.entries(c)) {
    masked[k] = typeof v === 'string' && v.length > 4 ? `••••${v.slice(-4)}` : '••••';
  }
  return masked;
}

export const Providers = {
  upsert(p) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM providers WHERE slug = ?').get(p.slug);
    const id = existing?.id || newId('prv');
    const rec = {
      id,
      slug: p.slug,
      name: p.name,
      categories: toJson(p.categories || []),
      website: p.website ?? null,
      description: p.description ?? null,
      auth_type: p.auth_type ?? 'api_key',
      pricing: p.pricing ?? null,
      docs_url: p.docs_url ?? null,
      is_free: p.is_free ? 1 : 0,
      is_open_source: p.is_open_source ? 1 : 0,
    };
    if (existing) {
      // node:sqlite rejects bound keys not used by the statement — omit `slug`.
      const { slug, ...upd } = rec;
      db.prepare(`UPDATE providers SET name=@name,categories=@categories,website=@website,description=@description,
        auth_type=@auth_type,pricing=@pricing,docs_url=@docs_url,is_free=@is_free,is_open_source=@is_open_source WHERE id=@id`).run(upd);
    } else {
      db.prepare(`INSERT INTO providers (id,slug,name,categories,website,description,auth_type,pricing,docs_url,is_free,is_open_source)
        VALUES (@id,@slug,@name,@categories,@website,@description,@auth_type,@pricing,@docs_url,@is_free,@is_open_source)`).run(rec);
    }
    return id;
  },

  all() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM providers ORDER BY name ASC').all().map(provOut);
    for (const r of rows) {
      const conn = db.prepare('SELECT * FROM provider_connections WHERE provider_id=? LIMIT 1').get(r.id);
      r.connection = conn ? { id: conn.id, status: conn.status, credentials: maskCreds(conn.credentials), connected_at: conn.connected_at } : { status: 'disconnected' };
    }
    return rows;
  },

  get(slug) {
    return provOut(getDb().prepare('SELECT * FROM providers WHERE slug = ?').get(slug));
  },

  connect(slug, { credentials = {}, config = {} } = {}) {
    const db = getDb();
    const prov = db.prepare('SELECT id FROM providers WHERE slug=?').get(slug);
    if (!prov) throw new Error(`Unknown provider: ${slug}`);
    const existing = db.prepare('SELECT id FROM provider_connections WHERE provider_id=?').get(prov.id);
    const ts = now();
    if (existing) {
      db.prepare(`UPDATE provider_connections SET status='connected',credentials=@credentials,config=@config,connected_at=@ts,updated_at=@ts WHERE id=@id`)
        .run({ id: existing.id, credentials: toJson(credentials), config: toJson(config), ts });
      return existing.id;
    }
    const id = newId('pcn');
    db.prepare(`INSERT INTO provider_connections (id,provider_id,status,credentials,config,connected_at,updated_at)
      VALUES (@id,@provider_id,'connected',@credentials,@config,@ts,@ts)`)
      .run({ id, provider_id: prov.id, credentials: toJson(credentials), config: toJson(config), ts });
    return id;
  },

  disconnect(slug) {
    const db = getDb();
    const prov = db.prepare('SELECT id FROM providers WHERE slug=?').get(slug);
    if (!prov) return 0;
    return db.prepare(`UPDATE provider_connections SET status='disconnected',credentials=NULL,connected_at=NULL,updated_at=? WHERE provider_id=?`)
      .run(now(), prov.id).changes;
  },
};

export default Providers;
