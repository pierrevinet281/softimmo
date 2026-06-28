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

-- ═══════════════════════════════════════════════════════════════════════
--  SOFTIMMO — entités métier immobilières (Modules 1-5)
--  tenant_id nullable partout (mono-utilisateur aujourd'hui, multi-tenant plus tard).
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────── Clients (vendeurs / acheteurs) ─────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  kind          TEXT NOT NULL DEFAULT 'seller',  -- seller|buyer|both
  full_name     TEXT NOT NULL,
  org_name      TEXT,                  -- personne morale, le cas échéant
  email         TEXT,
  phone         TEXT,
  contact_id    TEXT REFERENCES contacts(id) ON DELETE SET NULL,  -- lien vers le CRM (Module 6)
  -- Loi 25 (consentement)
  consent_given INTEGER DEFAULT 0,     -- 0/1
  consent_at    TEXT,
  consent_scope TEXT,                  -- finalités consenties
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_kind ON clients(kind);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(full_name);

-- ───────────────────────── Propriétés (sujet d'un mandat) ─────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  client_id     TEXT REFERENCES clients(id) ON DELETE SET NULL,  -- vendeur / mandant
  name          TEXT,
  genre         TEXT NOT NULL DEFAULT 'unifamilial', -- unifamilial|condo|plex|multi|commercial|industriel|terrain|rpa|autre
  address       TEXT,
  city          TEXT,
  region        TEXT,
  province      TEXT DEFAULT 'QC',     -- province/État
  postal_code   TEXT,
  country       TEXT DEFAULT 'Canada',
  zoning        TEXT,
  num_buildings INTEGER DEFAULT 1,
  lot_number    TEXT,                  -- numéro de lot / cadastre
  area_unit     TEXT DEFAULT 'pi2',    -- pi2|m2 (unité d'affichage des superficies)
  mls_number    TEXT,                  -- numéro Centris/MLS si applicable
  brochure_qr_url TEXT,                 -- lien encodé par le QR de la brochure (fiche Centris, site, courriel…)
  municipal_assessment REAL,           -- évaluation foncière municipale (corroboration ACM)
  assessment_year INTEGER,             -- année du rôle d'évaluation
  status        TEXT NOT NULL DEFAULT 'prospect', -- prospect|actif|inscrit|vendu|expire|archive
  summary       TEXT,
  notes         TEXT,
  attributes    TEXT,                  -- JSON : valeurs des attributs de vente par type (voir lib/salesAttributes)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_properties_client ON properties(client_id);
CREATE INDEX IF NOT EXISTS idx_properties_genre  ON properties(genre);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);

-- ───────────────────────── Bâtiments ─────────────────────────
CREATE TABLE IF NOT EXISTS buildings (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT,
  property_id      TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label            TEXT,               -- ex. "Bâtiment A"
  building_type    TEXT,               -- ex. "Triplex", "Entrepôt"
  land_area        REAL,               -- superficie du terrain
  building_area    REAL,               -- superficie du bâtiment (empreinte)
  livable_area     REAL,               -- superficie habitable/occupable
  floors_basement  INTEGER,            -- étages sous-sol
  floors_above     INTEGER,            -- étages hors-sol
  floors_total     INTEGER,            -- total
  year_built       INTEGER,
  structure        TEXT,
  foundation       TEXT,
  exterior_cladding TEXT,              -- revêtement extérieur
  fenestration     TEXT,               -- type de fenestration
  roofing          TEXT,               -- type de toiture
  flooring         TEXT,               -- type de planchers
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON buildings(property_id);

-- ───────────────────────── Unités / logements (rent roll) ─────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  building_id   TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  label         TEXT,                  -- numéro/identifiant d'unité
  unit_type     TEXT,                  -- ex. "4½", "Local commercial"
  area          REAL,
  bedrooms      REAL,
  bathrooms     REAL,
  rent_monthly  REAL,                  -- loyer mensuel
  lease_type    TEXT,                  -- brut|net|TMI (commercial)
  lease_end     TEXT,                  -- échéance du bail
  is_vacant     INTEGER DEFAULT 0,     -- 0/1
  occupant      TEXT,
  other_income  REAL,                  -- stationnement, buanderie, rangement…
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);

-- ───────────────────────── Dépenses ─────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,         -- taxes_municipales|taxes_scolaires|assurances|energie|entretien|gestion|deneigement|conciergerie|reserve|autre
  label         TEXT,
  amount        REAL,                  -- montant
  period        TEXT DEFAULT 'annuel', -- annuel|mensuel
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);

-- ───────────────────────── Transactions / historique ─────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date          TEXT,
  status        TEXT,                  -- en_vigueur|vendue|expiree|inscription|retiree
  price         REAL,
  party_seller  TEXT,
  party_buyer   TEXT,
  source        TEXT,                  -- Centris|Registre foncier|JLR|autre
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_property ON transactions(property_id);

-- ───────────────────────── Comparables (ACM) ─────────────────────────
-- seller_redacted : caviardage des données identifiant le vendeur avant partage client
-- (exigence OACIQ ; voir docs/06-conformite-legale.md).
CREATE TABLE IF NOT EXISTS comparables (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT,
  property_id     TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,  -- propriété sujet
  address         TEXT,
  city            TEXT,
  kind            TEXT DEFAULT 'sold',   -- sold|active|expired
  centris_no      TEXT,                  -- No Centris (extrait Matrix)
  date            TEXT,
  sale_date       TEXT,                  -- date de vente (VE) — distincte de `date` (inscription)
  price           REAL,                  -- prix générique (rétrocompat ; voir list_price/sold_price)
  list_price      REAL,                  -- dernier prix inscrit
  sold_price      REAL,                  -- prix vendu (VE)
  area            REAL,
  livable_area    REAL,                  -- superficie habitable (pc)
  price_per_area  REAL,
  bedrooms        REAL,
  bathrooms       REAL,
  year_built      INTEGER,
  municipal_assessment REAL,             -- évaluation foncière du comparable
  days_on_market  INTEGER,               -- JSM (jours sur le marché)
  foundation      TEXT,                  -- fondation (beton|blocs|pieux|pierre)
  cladding        TEXT,                  -- revêtement extérieur (brique|pierre|aluminium|…)
  windows_type    TEXT,                  -- type de fenêtres (pvc|hybride|aluminium|bois)
  flooring        TEXT,                  -- type de planchers (bois_franc|ceramique|…)
  windows_age     INTEGER,               -- âge des fenêtres (ans)
  roof_age        INTEGER,               -- âge de la toiture (ans)
  inclusions      TEXT,                  -- JSON: {clé:qté} (ex. {"foyer":2}) ; booléens en 0/1
  rating          TEXT,                  -- worse|equal|better (vs sujet)
  weight          REAL,                  -- pondération dans l'ACM
  adjustments     TEXT,                  -- JSON: [{key,label,subject,comp,delta,unit,rate,amount,explanation}]
  seller_redacted INTEGER DEFAULT 1,     -- 1 = masquer les infos vendeur à l'export client
  source          TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comparables_property ON comparables(property_id);

-- ───────────────────────── Rapports d'expertise ─────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  report_type   TEXT,                  -- inspection|sol|environnemental|arpentage|autre
  title         TEXT,
  date          TEXT,
  url           TEXT,                  -- lien externe
  file_path     TEXT,                  -- fichier téléversé
  results       TEXT,                  -- JSON: [{label, value}] (tableau des résultats)
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_property ON reports(property_id);

-- ───────────────────────── Médias de propriété (photos) ─────────────────────────
-- Photos téléversées, utilisées par les brochures et autres sorties marketing.
-- `role` : hero (photo principale) | map (carte) | interior (intérieur) | gallery (non assigné).
CREATE TABLE IF NOT EXISTS property_media (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'gallery',
  position      INTEGER DEFAULT 0,
  file_path     TEXT NOT NULL,
  filename      TEXT,
  mime          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_property_media_property ON property_media(property_id);

-- ───────────────────────── Documents générés ─────────────────────────
-- Toute sortie produite (analyse, évaluation, offre, marketing, guide). `data` est
-- l'instantané JSON ayant servi au rendu — base de l'aller-retour PPTX (docs/09).
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  property_id   TEXT REFERENCES properties(id) ON DELETE SET NULL,
  client_id     TEXT REFERENCES clients(id) ON DELETE SET NULL,
  doc_type      TEXT NOT NULL,         -- analyse|evaluation|offre|brochure|pub_moyenne|fb_feed|fb_marketplace|instagram|x|linkedin|carrousel|guide
  title         TEXT,
  template      TEXT,                  -- gabarit utilisé (ex. rpa, unifamiliale)
  lang          TEXT DEFAULT 'fr',     -- fr|en (sortie ; FR prééminent — Loi 96)
  format        TEXT,                  -- pdf|pptx|md|html
  status        TEXT NOT NULL DEFAULT 'draft', -- draft|final
  version       INTEGER DEFAULT 1,
  data          TEXT,                  -- JSON: instantané des données de rendu
  pdf_path      TEXT,
  pptx_path     TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_property ON documents(property_id);
CREATE INDEX IF NOT EXISTS idx_documents_type     ON documents(doc_type);

-- ───────────────────────── Assets du courtier ─────────────────────────
-- Matériel marketing du COURTIER lui-même (carte d'affaires, bio, signature, logos,
-- portraits, accroches, certificats, gabarits personnels). Réutilisable dans les offres,
-- brochures et le marketing. `text` = contenu textuel (bio/accroche/signature) ; `file_path`
-- = image/PDF téléversé. Voir docs/01 §« Assets courtier ».
CREATE TABLE IF NOT EXISTS broker_assets (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT,
  name          TEXT NOT NULL,
  asset_type    TEXT NOT NULL DEFAULT 'autre', -- logo|portrait|carte|bio|signature|accroche|certificat|hero|autre
  category      TEXT,
  lang          TEXT,                          -- fr|en|bi|null
  text          TEXT,                          -- contenu textuel (bio, accroche, signature…)
  file_path     TEXT,                          -- image/PDF téléversé (optionnel)
  filename      TEXT,
  mime          TEXT,
  tags          TEXT,                          -- JSON: liste d'étiquettes
  notes         TEXT,
  position      INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_broker_assets_type ON broker_assets(asset_type);
