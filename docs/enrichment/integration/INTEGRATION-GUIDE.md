# Lead Gen — Integration Guide (for Claude)

> **Naming**: the product is **Lead Gen**; the internal slug `leadgen` appears in package names,
> the SQLite file (`leadgen.db`) and env vars (`LEADGEN_API_PORT`). Rename to the host's
> convention during integration if desired.
>
> **Audience**: Claude (or any engineer) tasked with integrating this module into an **existing
> multi-tenant, multilingual host SaaS**. This document tells you what it is, what to keep, what to
> change, and the exact extension points. Adapt freely to the host’s conventions.
>
> **UI note**: the sidebar items are **Overview** (dashboard), **Contact Leads**, **Company Leads**,
> Leads Lists, Generate, Verify, Import/Export, Marketplace, Activity, Settings. The host likely has its
> own global dashboard, so this module's "Overview" is intentionally scoped to leads only.

---

## 1. What you are integrating

Lead Gen is a **self-contained lead generation / enrichment / verification / management module**:

- **Backend**: Node/Express (ESM) + `node:sqlite`, an engine (`server/src/engine`) orchestrating
  **Python workers** (`server/python`) for search/crawl/verify/phone, plus an optional **Claude AI
  layer**.
- **Frontend**: React + Vite SPA using the Netritious design tokens.
- **Owned & permissive**: all dependencies are MIT/BSD/Apache/ISC; no recurring fees. Paid services
  are opt-in via the Marketplace using the end-user’s own keys.

It currently runs **single-user, no auth, English UI**. The data model and engine were written to
make the multi-tenant / multilingual upgrade mechanical, not a rewrite.

---

## 2. Design decisions that make integration easy

1. **`tenant_id` everywhere.** Every owned table (`companies`, `contacts`, `field_provenance`,
   `lists`, `jobs`, `provider_connections`, `activity`, …) already has a nullable `tenant_id`
   column. Single-user mode leaves it `NULL`.
2. **No hardcoded data.** Demo data, reference lists (disposable domains, free providers, role
   locals, seniority keywords) and the marketplace catalog all live in the DB, seeded from
   `server/src/db/seeds/*.seed.json`. Nothing to hunt for in code.
3. **Pure engine.** `waterfall.js` returns `{fields, provenance, log, confidence}` and does **not**
   touch the DB. `apply.js` persists. The queue calls them. This separation lets you swap the
   persistence/tenancy layer without rewriting the engine.
4. **Repositories are the only DB access.** All SQL is in `server/src/db/repositories/*`. Add a
   `tenant_id` filter in one place per repo.
5. **i18n-ready UI strings.** Frontend copy is plain text in components today; a string catalog is
   the only UI change needed (section 5).

---

## 3. Step-by-step: make it multi-tenant

### 3.1 Thread the tenant through
- Introduce a request context (host middleware likely already resolves `tenantId` from auth).
  Pass it into the repositories. Two clean options:
  - **Per-request DB scoping**: add `tenant_id` to every `WHERE` and every `INSERT` in the
    repositories. Each method already accepts a data object — add `tenant_id` to it and to the
    `list()` filters. Grep for `FROM companies`, `FROM contacts`, etc.; each repo is ~120 lines.
  - **Database-per-tenant**: keep the code as-is and open a different SQLite file per tenant in
    `db/index.js` (`getDb(tenantId)`), caching handles. Zero query changes, strong isolation. Good
    for SQLite specifically; switch to Postgres if you need cross-tenant analytics (section 6).
- The **job queue** (`engine/queue.js`) stamps jobs with `tenant_id`; the processors load entities
  by id — ensure those loads are tenant-scoped so a job can’t touch another tenant’s rows.

### 3.2 Auth
- Remove the assumption of a single user. Mount the existing host auth middleware before
  `mountRoutes()` in `server/src/index.js`. Reject unauthenticated `/api` calls. Put `tenantId` /
  `userId` on `req` and use them in routes.

### 3.3 Secrets & keys
- Today AI/search/provider keys live in the `settings` and `provider_connections` tables (local).
  For multi-tenant, move them **per-tenant** (they already key naturally by tenant once `tenant_id`
  is threaded) and store using the host’s secrets manager / encryption-at-rest. Never return raw
  keys to the client — the code already masks them (`routes/settings.js`, `repositories/providers.js`).

### 3.4 Background work at scale
- The in-process queue is fine for one machine. For a fleet, replace the internals of `queue.js`
  with the host’s job system (BullMQ, Cloud Tasks, etc.). The processor functions
  (`processEnrich/processVerify/processDiscover`) are reusable as-is — they take `(item, params)`.
- Crawling politeness is per-process; for many workers add a shared rate limiter (Redis token
  bucket) keyed by domain.

---

## 4. Database portability (if not SQLite)

The repositories use straightforward SQL. To move to Postgres/MySQL:
- Replace `db/index.js` (the `node:sqlite` handle + `transaction()`), keep the repository method
  signatures.
- Adjust: `datetime('now')` → `now()`; JSON columns are stored as TEXT (works everywhere) or switch
  to `jsonb`; `INSERT … ON CONFLICT` is already Postgres-compatible syntax.
- Keep `field_provenance`, `jobs`, `job_items` exactly — they’re engine contracts.

---

## 5. Multilingual UI

- Today components render English literals. Introduce the host’s i18n (e.g. `react-i18next`):
  wrap strings in `t('key')`, extract a catalog. The copy is concentrated in `src/pages/*` and
  `src/components/*`; there is no logic tied to specific English strings.
- **Engine output stays language-neutral** (E.164 phones, email statuses like `valid`/`risky`,
  grades A–D). If you localize the AI layer, pass the desired output language into the prompts in
  `engine/ai/index.js` (add a `language` setting and include it in the system prompts). The
  heuristic fallbacks are already language-agnostic.
- Reference data (e.g. role-account local-parts) is English-centric; extend
  `seeds/reference.seed.json` with locale-specific tokens as needed.

---

## 6. What to reuse verbatim vs. adapt

**Reuse as-is** (no host coupling):
- `server/python/*` — the workers (stdin/stdout JSON contract).
- `server/src/engine/*` — waterfall, discover, scoring, domains, emailPatterns, ai (pass keys in).
- `server/src/db/schema.sql` + `seeds/*` — add `tenant_id` filters/seed scoping.
- The Netritious design tokens (`web/src/styles/*`) if the host shares the brand; otherwise map to
  the host’s tokens.

**Adapt**:
- `server/src/index.js` — mount under the host (auth, base path, no static serving if the host
  owns the shell).
- `server/src/db/repositories/*` — tenant scoping.
- `server/src/routes/*` — these are clean REST handlers; re-mount under the host’s API prefix and
  auth. Validation is zod-based and reusable.
- Frontend pages — embed as a feature area / route group; reuse components or restyle.

---

## 7. Marketplace connectors (turning cards into live data)

The Marketplace currently catalogs providers and stores connections; it does not yet call them.
To make a connector live:
1. Read the connection: `Providers` repo → `provider_connections.credentials` (decrypt per host).
2. Add a SOURCE stage in `engine/waterfall.js` (or a dedicated `engine/sources/<slug>.js`) that, when
   the provider is connected, calls its API and maps the response into our field shape.
3. Record provenance with `method: 'connector:<slug>'` and the provider as `source`.
4. Respect the provider’s rate limits and the tenant’s plan.

This keeps the free core intact while letting connected tenants get richer data.

---

## 8. Checklist

- [ ] Mount host auth; reject unauthenticated `/api`.
- [ ] Thread `tenant_id` (per-row scoping **or** db-per-tenant).
- [ ] Tenant-scope job entity loads.
- [ ] Move keys to per-tenant secret storage; keep masking.
- [ ] Swap the queue for the host’s job system (optional, for scale).
- [ ] Add i18n catalog; pass `language` into AI prompts.
- [ ] Decide DB engine (SQLite per tenant vs. Postgres).
- [ ] Re-skin or reuse the Netritious tokens.
- [ ] Optionally implement live marketplace connectors.

Lead Gen was structured so each item above is a localized change, not a rewrite. The engine,
workers, schema and REST contracts are the stable core you build on.
