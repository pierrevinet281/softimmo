# Action Plan — Lead Gen

> Deliverable #6. Build order. We proceed non-stop; each phase yields working software.

## Phase 0 — Foundations (docs + scaffold)
- [x] Read & analyze all source docs, original tool, design system.
- [x] Feature catalog, architecture, action plan, licensing.
- [ ] Monorepo scaffold: root `package.json` (workspaces), `web` (Vite+React), `server` (Express), `python` (requirements + venv), `.env.example`, `.gitignore`.

## Phase 1 — Data layer
- [ ] `schema.sql` (all tables) + `migrate.js` (idempotent).
- [ ] Repositories: companies, contacts, provenance, lists, jobs, providers, settings, activity.
- [ ] Seed: marketplace providers (`marketplace.seed.json`), demo leads.

## Phase 2 — Core engine (Python workers + Node orchestrator)
- [ ] `python/search.py` (DuckDuckGo + Bing HTML, normalized JSON out).
- [ ] `python/extract.py` (fetch + email/phone/social extraction, BeautifulSoup).
- [ ] `python/verify.py` (email syntax + MX + optional SMTP) and `python/phone.py`.
- [ ] `python/dedup.py`, `python/listing.py`.
- [ ] Node `services/python.js` bridge (spawn, JSON IO, timeout).
- [ ] Node `engine/` : queue worker, waterfall, rate limiter, email-pattern generator.
- [ ] AI layer `engine/ai/` : query gen, entity resolve, field map, scoring (Claude, optional).

## Phase 3 — REST API
- [ ] Routes for every resource (CRUD, import/export, jobs, enrich, verify, dedup, lists, marketplace, settings, stats).
- [ ] zod validation, error handling, activity logging.

## Phase 4 — Frontend
- [ ] Design tokens CSS + base components (Button, Card, Input, Badge, Table, Modal, Tabs, Toast, JobProgress, ThemeToggle, Sidebar/Topbar).
- [ ] Pages: Dashboard, Leads (Companies/Contacts tabs), Lead detail (with provenance), Generate, Enrich, Verify, Lists, Import/Export, Marketplace, Activity, Settings.
- [ ] API hooks (TanStack Query), i18n wiring.

## Phase 5 — Docs
- [ ] README (run instructions), User Guide, Technical Doc, Integration Guide for the multi-tenant SaaS.

## Phase 6 — Verify & polish
- [ ] `npm install`, create venv, install python reqs.
- [ ] Boot server + vite, seed data, run a real enrichment job end-to-end.
- [ ] Fix issues, screenshot UI in light/dark, confirm export.

## Run commands (target)
```
npm install            # root → installs web + server workspaces
npm run setup:python   # creates venv + installs requirements
npm run dev            # concurrently: server (API) + vite (web)
```
