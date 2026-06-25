# Lead Gen — Technical Documentation

For developers maintaining or extending the system. See `02-architecture.md` for the high-level
design and `integration/INTEGRATION-GUIDE.md` for porting into a host SaaS.

## 1. Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18, Vite 5, React Router, TanStack Query, lucide-react | ESM, plain-CSS design tokens |
| API | Node ≥22, Express 4 (ESM) | localhost-only by default |
| DB | `node:sqlite` (built-in `DatabaseSync`) | **no native add-on**, no build step |
| Workers | Python 3.9+ (requests, beautifulsoup4, lxml, dnspython, phonenumbers) | spawned per call |
| AI | `@anthropic-ai/sdk` (optional) | degrades to heuristics |

All dependencies are permissively licensed (see `../LICENSING.md`).

## 2. Running & scripts

```
npm install                 # workspaces: server, web
npm run setup:python        # venv + requirements
npm run dev                 # concurrently: API (:8787) + Vite (:5180)
npm run build               # web/dist
npm start                   # API serves API + built UI on :8787
node server/src/db/seed.js [--demo]   # reseed
```

Env: `server/src/lib/config.js` reads `.env` (see `.env.example`). Settings are also editable at
runtime via `/api/settings` and stored in the `settings` table (DB overrides env for AI/crawl/search).

## 3. Data model (SQLite)

Tables (DDL: `server/src/db/schema.sql`):

- `companies` — core company leads. Identity (`name`, `domain`, `website`), discrete address
  (`address`, `city`, `state`, `postal_code`, `country`, plus free-text `location`), classification
  (`industry`, `sic_code`, `naics_code`, `size`), `phone`, and **discrete social columns**
  (`linkedin`, `facebook`, `instagram`, `youtube`, `twitter`). `completeness` (0..1), `grade` (A–D),
  `status` (new→enriched→verified→archived).
- `contacts` — core contact leads. `first_name`/`last_name` (+ derived `full_name`), `title`,
  `company_name`, `company_id` (FK → companies, enforced; bad/manual values are dropped or
  auto-linked by name), `email`/`email_status`, `phone`/`extension`/`mobile`/`phone_type`, and
  **discrete social/messaging columns** (`linkedin`, `facebook`, `instagram`, `youtube`, `twitter`,
  `tiktok`, `whatsapp`, `reddit`, `wechat`, `telegram`, `threads`). Some socials (e.g. TikTok) are
  not auto-enriched yet but are storable via manual entry or import.
- Both tables keep a `socials` JSON column as a catch-all for any extra networks; the discrete
  columns are the source of truth and what the UI displays. Schema changes after the first release
  are applied by an idempotent `ALTER TABLE ADD COLUMN` migration in `db/index.js` (no data loss).
- `field_provenance` — per-field history: entity, field, value, source, method, confidence,
  verified, observed_at.
- `lists`, `list_members` — static/smart lists.
- `tags`, `entity_tags`.
- `jobs`, `job_items` — background work, persisted for restart-safety.
- `providers`, `provider_connections` — marketplace catalog + local credentials.
- `reference_data` — engine reference lists (disposable domains, free providers, role locals,
  seniority keywords). **All seeded from JSON; never hardcoded.**
- `settings`, `activity`.

Every owned table has a nullable `tenant_id` for a later multi-tenant upgrade.

### No hardcoded data
All data — demo leads, reference lists, the marketplace catalog — lives in the DB, seeded from
`server/src/db/seeds/*.seed.json`. Python workers receive reference lists from Node (sourced from
the DB) in their input payload; they contain no hardcoded data.

## 4. The engine

Located in `server/src/engine/`:

- `workers.js` — Node wrappers around the Python workers, injecting DB reference data + settings.
- `domains.js` — domain canonicalization, name→domain guessing, contact-page URL building.
- `emailPatterns.js` — candidate email generation (`{first}.{last}@`, etc.) + generic role mailboxes.
- `scoring.js` — completeness + grade for contacts/companies.
- `ai/index.js` — Claude wrappers (query gen, entity resolve, title normalize) with heuristic
  fallbacks; reads key/model from settings.
- `waterfall.js` — `enrichContact` / `enrichCompany`: plan → search → crawl → resolve → pattern →
  verify → score. Pure (returns `{fields, provenance, log, confidence}`; does not persist).
- `discover.js` — `discoverContact` / `discoverCompanies` (create new leads).
- `apply.js` — merges a waterfall result into an entity (missing fields only unless overwrite),
  writes provenance, recomputes score/grade/status.
- `queue.js` — in-process, SQLite-backed job queue. Processors for `enrich` / `verify` / `discover`.
  Resumes unfinished jobs on boot. Sequential + per-domain polite.

### Python workers (`server/python/`)
Each reads one JSON object on stdin, writes one JSON object on stdout (`shared/io.py`):

- `search.py` — multi-engine (Google CSE, SearXNG, DuckDuckGo, Bing, Mojeek), free-first, graceful.
- `extract.py` — fetch + extract emails / phones / socials / title / description.
- `verify_email.py` — syntax + MX + optional SMTP probe; disposable/free/role flags from input lists.
- `phone.py` — libphonenumber parse/format/type.
- `shared/` — `io.py` (UTF-8 JSON pipe), `net.py` (polite HTTP GET/POST), `patterns.py` (regexes).

Bridge: `server/src/services/python.js` (`runWorker(name, input, {timeoutMs})`).

## 5. API reference

Base: `/api`. JSON in/out. Errors: `{ error, details }` with proper status.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | server + python + AI status |
| GET | `/stats` | dashboard counts |
| GET | `/activity?limit=` | audit log |
| GET | `/reference/:category` | reference list |
| GET/POST | `/contacts` | list / create |
| GET/PATCH/DELETE | `/contacts/:id` | read / update / delete |
| GET | `/contacts/:id/provenance` | field history |
| GET/POST/PATCH/DELETE | `/companies…` | same shape as contacts |
| POST | `/enrich` | `{entity_type, ids[], params}` → job |
| POST | `/verify` | `{ids[], params}` → job |
| POST | `/discover/contact` | `{company_name, title, …}` → job |
| POST | `/discover/companies` | `{query, limit}` → job |
| POST | `/contacts/:id/enrich`, `/companies/:id/enrich` | single-entity enrich |
| GET | `/jobs`, `/jobs/:id`, `/jobs/:id/items` | job status |
| POST | `/jobs/:id/pause\|resume\|cancel` | control |
| GET/POST/PATCH/DELETE | `/lists…` + `/lists/:id/members` | lists |
| GET | `/providers` · POST `/providers/:slug/connect\|disconnect` | marketplace |
| GET/PUT | `/settings` | config (secrets masked on read) |
| POST | `/import/preview`, `/import` | upload + map + insert |
| GET | `/export?entity=&format=csv\|xlsx\|json` | download |

## 6. Frontend structure

- `src/api/client.js` — fetch wrapper.
- `src/components/` — `ui.jsx` (Button, Card, Modal, Badge…), `Toast.jsx`, `LeadDrawer.jsx`,
  `JobProgress.jsx`.
- `src/hooks/useJob.js` — polls a job until terminal.
- `src/pages/` — Dashboard, Contacts, Companies, Generate, Verify, Lists, ImportExport,
  Marketplace, ActivityPage, Settings.
- `src/styles/tokens.css` + `app.css` — Netritious design system (light/dark via `data-theme`).

## 7. Extending

- **Add a marketplace connector** that actually fetches: register a SOURCE stage in `waterfall.js`
  guarded by `provider_connections.status === 'connected'`, read the key from the connection, map
  the provider response into our fields + provenance (`method: 'connector:<slug>'`).
- **Add a reference list**: add a category to `seeds/reference.seed.json`, reseed, read via
  `Reference.values('<category>')`.
- **Swap the queue** for a real broker: replace `queue.js` internals; routes are unchanged.

## 8. Operational notes

- SQLite runs in WAL mode. The DB file is `data/leadgen.db`.
- Crawling is polite (per-domain delay, concurrency cap, custom UA, timeouts). Configurable.
- The SMTP probe is off by default.
- All third-party calls are user-initiated via Marketplace connections.
