-- Lead Gen schema. SQLite. Idempotent (CREATE IF NOT EXISTS).
-- tenant_id columns exist everywhere but are NULL in single-user mode, so the
-- model upgrades to multi-tenant without migration of structure.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ───────────────────────── Companies ─────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  name          TEXT NOT NULL,
  domain        TEXT,                 -- canonical root domain (example.com)
  website       TEXT,
  industry      TEXT,
  sic_code      TEXT,                 -- Standard Industrial Classification
  naics_code    TEXT,                 -- North American Industry Classification System
  size          TEXT,                 -- free text / range hint (e.g. "11-50")
  -- Address (discrete + free-text fallback `location` kept for enrichment/display)
  address       TEXT,
  city          TEXT,
  state         TEXT,                 -- state / province / region
  postal_code   TEXT,                 -- postal code / ZIP
  location      TEXT,
  country       TEXT,
  description   TEXT,
  logo_url      TEXT,
  phone         TEXT,
  -- Discrete social profiles
  linkedin      TEXT,
  facebook      TEXT,
  instagram     TEXT,
  youtube       TEXT,
  twitter       TEXT,                 -- X (Twitter)
  socials       TEXT,                 -- JSON catch-all for any extra networks
  source        TEXT,                 -- where this company first came from
  status        TEXT NOT NULL DEFAULT 'new',     -- new|enriched|verified|archived
  grade         TEXT,                 -- A|B|C|D
  completeness  REAL DEFAULT 0,       -- 0..1
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_name   ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- ───────────────────────── Contacts ─────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  company_id    TEXT REFERENCES companies(id) ON DELETE SET NULL,
  company_name  TEXT,                 -- denormalized for imports without a linked company
  first_name    TEXT,
  last_name     TEXT,
  full_name     TEXT,                 -- derived from first+last (kept for search/lists)
  title         TEXT,                 -- raw job title
  role          TEXT,                 -- normalized canonical role
  seniority     TEXT,                 -- C-level|VP|Director|Manager|IC|Other
  email         TEXT,
  email_status  TEXT,                 -- unknown|valid|invalid|risky|catch_all
  phone         TEXT,                 -- main / direct line
  extension     TEXT,                 -- phone extension
  mobile        TEXT,                 -- mobile / cell number
  phone_type    TEXT,                 -- mobile|landline|voip|unknown
  -- Discrete social / messaging profiles
  linkedin      TEXT,
  facebook      TEXT,
  instagram     TEXT,
  youtube       TEXT,
  twitter       TEXT,                 -- X (Twitter)
  tiktok        TEXT,
  whatsapp      TEXT,
  reddit        TEXT,
  wechat        TEXT,
  telegram      TEXT,
  threads       TEXT,
  socials       TEXT,                 -- JSON catch-all for any extra networks
  location      TEXT,
  country       TEXT,
  source        TEXT,
  status        TEXT NOT NULL DEFAULT 'new',
  grade         TEXT,
  completeness  REAL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_name    ON contacts(full_name);
CREATE INDEX IF NOT EXISTS idx_contacts_status  ON contacts(status);

-- ───────────────── Field provenance / trust ─────────────────
-- One row per (entity, field, observation). Powers "where did this value come
-- from, how sure are we, when did we see it".
CREATE TABLE IF NOT EXISTS field_provenance (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  entity_type   TEXT NOT NULL,        -- company|contact
  entity_id     TEXT NOT NULL,
  field         TEXT NOT NULL,        -- email|phone|linkedin|...
  value         TEXT,
  source        TEXT,                 -- domain/provider that yielded it
  method        TEXT,                 -- search|crawl|pattern|ai|import|connector:<slug>
  confidence    REAL,                 -- 0..1
  verified      INTEGER DEFAULT 0,    -- 0/1
  observed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prov_entity ON field_provenance(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_prov_field  ON field_provenance(field);

-- ───────────────────────── Lists ─────────────────────────
CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'static',  -- static|smart
  entity_type TEXT NOT NULL DEFAULT 'contact', -- contact|company
  filter      TEXT,                            -- JSON for smart lists
  color       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS list_members (
  list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (list_id, entity_type, entity_id)
);

-- ───────────────────────── Tags ─────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT,
  name      TEXT NOT NULL,
  color     TEXT
);
CREATE TABLE IF NOT EXISTS entity_tags (
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

-- ───────────────────────── Jobs ─────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT,
  type         TEXT NOT NULL,         -- discover|enrich|verify|import|export|dedup
  status       TEXT NOT NULL DEFAULT 'queued', -- queued|running|paused|done|error|canceled
  params       TEXT,                  -- JSON
  total        INTEGER DEFAULT 0,
  processed    INTEGER DEFAULT 0,
  succeeded    INTEGER DEFAULT 0,
  failed       INTEGER DEFAULT 0,
  progress     REAL DEFAULT 0,        -- 0..1
  error        TEXT,
  result       TEXT,                  -- JSON summary
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  started_at   TEXT,
  finished_at  TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type   ON jobs(type);

CREATE TABLE IF NOT EXISTS job_items (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id   TEXT,
  input       TEXT,                   -- JSON input snapshot
  status      TEXT NOT NULL DEFAULT 'queued', -- queued|running|done|error|skipped
  result      TEXT,                   -- JSON
  log         TEXT,                   -- step-by-step text log
  attempts    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobitems_job ON job_items(job_id, status);

-- ───────────────── Marketplace providers ─────────────────
CREATE TABLE IF NOT EXISTS providers (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  categories  TEXT,                   -- JSON array
  website     TEXT,
  description TEXT,
  auth_type   TEXT,                   -- api_key|oauth|manual|none
  pricing     TEXT,
  docs_url    TEXT,
  is_free     INTEGER DEFAULT 0,
  is_open_source INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS provider_connections (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT,
  provider_id  TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'disconnected', -- disconnected|connected|error
  credentials  TEXT,                  -- JSON (local only; masked to client)
  config       TEXT,                  -- JSON
  connected_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────────────────────── Settings ─────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ─────────────────── Reference data (seeded) ───────────────────
-- Single source of truth for engine reference lists: disposable email domains,
-- free email providers, role-account local-parts, seniority keywords, etc.
-- Seeded from server/src/db/seeds/reference.seed.json — never hardcoded in code.
CREATE TABLE IF NOT EXISTS reference_data (
  id        TEXT PRIMARY KEY,
  category  TEXT NOT NULL,           -- disposable_domain|free_provider|role_local|seniority|industry
  value     TEXT NOT NULL,           -- the token (e.g. "gmail.com", "vp")
  meta      TEXT,                    -- JSON (e.g. {"seniority":"VP"})
  UNIQUE(category, value)
);
CREATE INDEX IF NOT EXISTS idx_refdata_cat ON reference_data(category);

-- ───────────────────────── Activity ─────────────────────────
CREATE TABLE IF NOT EXISTS activity (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT,
  kind        TEXT NOT NULL,          -- create|update|delete|enrich|verify|import|export|job|connect
  entity_type TEXT,
  entity_id   TEXT,
  summary     TEXT,
  meta        TEXT,                   -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
