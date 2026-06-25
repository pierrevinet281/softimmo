# Architecture & Tech Stack — Lead Gen

> Deliverable #5. How the system is structured, the stack, and why each choice keeps the
> product **100% owned, permissively licensed, and free of recurring cost**.

---

## 1. High-level shape

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser  —  React + Vite SPA (ESM)                                │
│  Netritious design system · light/dark · Lucide icons              │
└───────────────▲───────────────────────────────┬──────────────────┘
                │ REST / JSON (localhost)        │
┌───────────────┴───────────────────────────────▼──────────────────┐
│  Node.js API server (Express, ESM)                                 │
│  • REST routes  • better-sqlite3 data layer                        │
│  • Job queue (in-process worker)                                   │
│  • Engine orchestrator                                             │
│      ├─ AI layer  → Anthropic SDK (optional, keyed)               │
│      └─ Python workers (child_process spawn)                       │
└───────────────┬──────────────────────────────┬───────────────────┘
                │                               │
        ┌───────▼────────┐          ┌───────────▼─────────────┐
        │ SQLite file    │          │ Python workers (venv)   │
        │ leadgen.db   │          │ search · extract · verify│
        └────────────────┘          │ dedup · phone · listing │
                                     └──────────┬──────────────┘
                                                │ outbound HTTP (public web)
                                  ┌─────────────▼──────────────┐
                                  │ Public web: search engines,│
                                  │ company sites, social pages │
                                  └─────────────────────────────┘

   Marketplace connectors (opt-in) call third-party APIs and import
   results back into SQLite — never embedded code, only data.
```

## 2. Stack & licenses (all permissive — safe to sell)

| Layer | Choice | License | Why |
|---|---|---|---|
| Frontend | React 18 + Vite 5 | MIT | Required; ESM-native, fast dev server |
| Routing | React Router | MIT | |
| Server state | TanStack Query | MIT | caching, background refetch |
| Icons | lucide-react | ISC | design system mandates Lucide |
| Styling | Plain CSS + design tokens | n/a (our CSS) | exact Netritious tokens, zero framework lock-in |
| API server | Express 4 (ESM) | MIT | minimal, owned routes |
| DB driver | better-sqlite3 | MIT | synchronous, fast, embedded |
| Excel/CSV | `xlsx` (SheetJS community) + `csv-parse`/`csv-stringify` | Apache-2.0 / MIT | import/export |
| AI | @anthropic-ai/sdk | MIT | optional Claude layer |
| Validation | zod | MIT | request/DTO validation |
| Python: HTTP | requests | Apache-2.0 | fetch |
| Python: parse | beautifulsoup4 + lxml | MIT / BSD | HTML extraction |
| Python: DNS | dnspython | ISC | MX checks |
| Python: phone | phonenumbers | Apache-2.0 | E.164 / type |

**Explicitly excluded**: any GPL/AGPL/SSPL/“non-commercial”/“source-available” dependency.
See `LICENSING.md`. No paid SDKs are bundled — paid services are reached only through the
Marketplace via the user's own keys.

## 3. Monorepo layout

```
lead-gen-code/
├─ package.json            # npm workspaces: server, web
├─ .env.example            # config (no secrets committed)
├─ LICENSING.md
├─ README.md
├─ docs/                   # analysis, architecture, plan, user & tech guides
│  └─ integration/INTEGRATION-GUIDE.md   # for porting into the multi-tenant SaaS
├─ data/                   # leadgen.db (gitignored), seeds
├─ server/
│  ├─ src/
│  │  ├─ index.js          # Express bootstrap
│  │  ├─ db/               # connection, schema.sql, migrate.js, repositories/
│  │  ├─ routes/           # leads, companies, contacts, jobs, enrich, verify,
│  │  │                    #   lists, import, export, marketplace, settings, stats
│  │  ├─ engine/           # orchestrator, waterfall, queue, ai/, sources/
│  │  ├─ services/         # python bridge, rate limiter, provenance
│  │  └─ lib/              # logger, config, errors
│  └─ python/
│     ├─ requirements.txt
│     ├─ search.py  extract.py  verify.py  phone.py  dedup.py  listing.py
│     └─ shared/ (http, regexes, useragents)
└─ web/
   ├─ index.html
   ├─ vite.config.js
   └─ src/
      ├─ main.jsx  App.jsx  router.jsx
      ├─ styles/tokens.css  app.css
      ├─ components/  (Sidebar, Topbar, Table, Badge, Button, Modal, JobProgress…)
      ├─ pages/  (Dashboard, Leads, LeadDetail, Generate, Enrich, Verify,
      │           Lists, ImportExport, Marketplace, Activity, Settings)
      ├─ api/  (client.js + per-resource hooks)
      └─ i18n/  (en.json)
```

## 4. Data model (SQLite) — summary

Core tables (full DDL in `server/src/db/schema.sql`):

- `companies` — id, tenant_id?, name, domain, website, industry, sic_code, naics_code, size, address, city, state, postal_code, location, country, description, logo_url, phone, discrete socials (linkedin, facebook, instagram, youtube, twitter), socials(json catch-all), status, grade, completeness, created/updated.
- `contacts` — id, tenant_id?, company_id?, first/last/full name, title, role, seniority, email, email_status, phone, extension, mobile, phone_type, discrete socials (linkedin, facebook, instagram, youtube, twitter, tiktok, whatsapp, reddit, wechat, telegram, threads), socials(json catch-all), location, country, status, grade, completeness, created/updated.
- `field_provenance` — entity_type, entity_id, field, value, source, method, confidence, verified, observed_at. (per-field history & trust)
- `lists` — id, name, type(static|smart), filter(json). `list_members` — list_id, entity ref.
- `jobs` — id, type(discover|enrich|verify|import|export|dedup), status, params(json), totals, progress, error, timestamps.
- `job_items` — job_id, entity ref, status, result(json), logs, attempts.
- `providers` — marketplace catalog (slug, name, categories(json), website, auth_type, status, docs). `provider_connections` — provider_id, credentials(json, local), status.
- `settings` — singleton key/value (AI config, crawl politeness, theme, keys vault).
- `activity` — audit trail.
- `tags`, `entity_tags`.

`tenant_id` columns exist but are nullable/`NULL` in single-user mode → trivial multi-tenant upgrade later.

## 5. The enrichment engine (owned waterfall)

```
Job(type=enrich, items=[lead…])
  └─ for each item (rate-limited, concurrent N):
       1. PLAN      → (AI optional) build search queries from known fields
       2. SEARCH    → python search.py → candidate URLs (DDG/Bing/CSE)
       3. FETCH     → python extract.py → text + emails + phones + social links
       4. RESOLVE   → (AI optional) pick the right entity, map fields
       5. PATTERN   → if email missing: generate domain permutations
       6. VERIFY    → python verify.py → syntax/MX/(SMTP) + phone.py
       7. SCORE     → completeness + confidence + grade
       8. PERSIST   → write fields + field_provenance, update job_item
```

Each stage is independently togglable and pluggable. Marketplace connectors register as
additional SOURCE stages in the waterfall when connected.

## 6. Job queue

In-process, SQLite-backed: jobs/items persisted so progress survives restarts. A single worker
loop pulls `queued` items, respects per-domain rate limits, writes results, emits progress the UI
polls via `GET /api/jobs/:id`. No external broker (no Redis) → zero infra cost. Designed so it can
later be swapped for a real queue without touching routes.

## 7. Security & politeness

- Runs on `127.0.0.1` only; no auth in v1 (single user, local).
- API keys stored in `settings` (local SQLite), never sent to the frontend in clear beyond masked form.
- Crawler: configurable per-domain delay, concurrency cap, custom User-Agent, optional robots.txt respect, timeouts, retry/backoff. SMTP probe off by default.
- All third-party calls are user-initiated via Marketplace connections.

## 8. Multi-tenant / i18n readiness (for the future port)

- `tenant_id` on every owned-data table.
- All engine logic is pure functions of (input, settings) — no global single-user assumptions.
- UI strings live in `web/src/i18n/en.json`; components read via `t('key')`.
- The integration guide (`docs/integration/INTEGRATION-GUIDE.md`) tells Claude exactly how to
  graft this into the existing multi-tenant, multilingual SaaS.
