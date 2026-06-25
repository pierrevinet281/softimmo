# Feature Catalog — Lead Gen

> Deliverable #4. A complete catalog of capabilities found across the source documents,
> the original Colab tool, and competitive research — mapped to whether they belong in
> our **100%-owned core engine** (free, no recurring cost, permissively licensed) or in
> the **optional Marketplace** (third-party connectors the user opts into).
>
> Legend — **Tier**: `CORE` = built by us, owned, free · `MKT` = Marketplace connector (third-party API) · `AI` = uses the optional Claude layer.
> **Status**: `v1` = in first build · `v2` = planned/stubbed.

---

## 0. Origin of each capability

The original tool (`Enrichissement de contacts.md`) is a Google Colab Python notebook implementing a
single **"name → web search → scrape → extract → verify"** waterfall:

| Original step                                   | Library used                    | Our owned re-implementation                                                                 |
| ----------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Read `datacontact.xlsx` (column *Contact Name*) | `pandas`                        | CSV/XLSX importer (Node `xlsx`, MIT) → SQLite                                               |
| Google search per contact, keep top-N URLs      | `google` (googlesearch)         | Our `web_search` worker: DuckDuckGo HTML + Bing HTML + Google CSE (optional key), pluggable |
| Fetch each URL, extract emails                  | `requests` + `beautifulsoup4`   | Our `extract` worker: fetch + regex (email/phone) + social-link parser                      |
| Keep LinkedIn / Twitter links                   | string filter                   | Social-profile classifier (regex per network)                                               |
| Group by name, aggregate                        | `pandas.groupby`                | SQLite aggregation + dedup/normalize worker                                                 |
| Validate emails                                 | `email-validator` + `dnspython` | Our `verify` worker: syntax + MX + optional SMTP probe                                      |

Everything below extends that waterfall into a full lead lifecycle.

---

## 1. Lead Sources & Generation (find new leads)

| # | Capability | Tier | Status | Notes / inspired by |
|---|---|---|---|---|
| 1.1 | Manual lead entry (company / contact) | CORE | v1 | Forms |
| 1.2 | CSV / XLSX import with column mapping | CORE | v1 | Replaces "upload datacontact.xlsx"; Gigasheet-style large-file handling via streaming |
| 1.3 | Search-driven company discovery (keyword + geography + industry → candidate companies from public web) | CORE·AI | v1 | Apollo/Crunchbase-style discovery, but built on public search + AI extraction |
| 1.4 | Contact discovery from a company (company name + desired title → find the person) | CORE·AI | v1 | The original use-case: "company + title → name + coordinates" |
| 1.5 | Domain → people/emails (find staff & emails for a domain) | CORE | v1 | Hunter "domain search" pattern, re-built: crawl site + pattern-guess + verify |
| 1.6 | Email pattern inference for a domain (`{first}.{last}@`, `{f}{last}@`, …) | CORE | v1 | Permutation generator + verification ranking |
| 1.7 | Bulk discovery from a list of company names / domains | CORE | v1 | Queue + per-row job items |
| 1.8 | Directory / listing page extraction (paste URLs → extract all records) | CORE·AI | v1 | Octoparse/Diffbot "auto-detect listing layout" → AI-assisted table extraction |
| 1.9 | SERP harvesting (a query → structured candidate list) | CORE·AI | v1 | Generalized version of the original Google step |
| 1.10 | Lead Source connectors (Apollo, Crunchbase, DataAxle, Lusha, RocketReach, Cognism, UpLead, Seamless…) | MKT | v1 cards | Marketplace cards, greyed-out until connected |
| 1.11 | LinkedIn / Sales Nav extraction connectors (Evaboot, Scalelist, Prospeo, PhantomBuster…) | MKT | v1 cards | Marketplace only; we never automate the user's account |

## 2. Enrichment (fill missing fields on existing leads)

| # | Capability | Tier | Status | Notes |
|---|---|---|---|---|
| 2.1 | Waterfall enrichment engine (try source A → if miss, source B → …) | CORE | v1 | BetterContact/FullEnrich "waterfall" pattern, owned implementation |
| 2.2 | Find email (name + company/domain → email) | CORE | v1 | Crawl + pattern + verify |
| 2.3 | Find phone (public web + page extraction) | CORE | v1 | regex + libphonenumber parsing |
| 2.4 | Find LinkedIn profile URL | CORE·AI | v1 | search + AI disambiguation of homonyms |
| 2.5 | Find other socials (Twitter/X, Facebook, Instagram, YouTube) | CORE | v1 | Social-link classifier |
| 2.6 | Company firmographics (website, description, industry, size hint, location, logo) | CORE·AI | v1 | Extract from homepage/about page + AI summarize |
| 2.7 | Company tech / metadata (title, meta description, social handles, address) | CORE | v1 | Lightweight "BuiltWith-lite" from HTML/headers |
| 2.8 | Contact role/title normalization & seniority tagging | CORE·AI | v1 | AI maps free-text titles → canonical role + seniority |
| 2.9 | Avatar / company logo capture | CORE | v2 | favicon/Clearbit-logo-style from site |
| 2.10 | Enrichment connectors (People Data Labs, Clearbit, FullContact, Enrich.so…) | MKT | v1 cards | Marketplace |
| 2.11 | Per-field provenance & confidence (which source, when, score) | CORE·AI | v1 | Every field stores source + confidence + timestamp |

## 3. Verification & Data Quality

| # | Capability | Tier | Status | Notes |
|---|---|---|---|---|
| 3.1 | Email syntax validation | CORE | v1 | RFC-ish validator (owned) |
| 3.2 | Email domain / MX check | CORE | v1 | DNS MX lookup (dnspython) |
| 3.3 | Email SMTP deliverability probe (optional, rate-limited) | CORE | v1 | RCPT probe; off by default to protect IP reputation |
| 3.4 | Disposable / role-based / free-provider flags | CORE | v1 | Curated lists baked in (own data) |
| 3.5 | Catch-all domain detection | CORE | v1 | Heuristic via SMTP probe of random mailbox |
| 3.6 | Phone validation & formatting (E.164, type landline/mobile) | CORE | v1 | libphonenumber (Apache-2.0) |
| 3.7 | URL / social link liveness check | CORE | v1 | HEAD/GET status |
| 3.8 | Duplicate detection & merge (fuzzy on name/email/domain) | CORE | v1 | RingLead-style dedup, owned |
| 3.9 | Record completeness score & lead grade (A–D) | CORE | v1 | Trestle/lead-grade pattern |
| 3.10 | Verification connectors (ZeroBounce, Hunter Verifier, Trestle, ServiceObjects, MillionVerifier…) | MKT | v1 cards | Marketplace |
| 3.11 | Bulk re-verification / freshness decay (re-check stale records) | CORE | v2 | scheduled job |

## 4. Data Manipulation & Management

| # | Capability | Tier | Status | Notes |
|---|---|---|---|---|
| 4.1 | Lead table with sort / filter / search / pagination | CORE | v1 | |
| 4.2 | Lists / segments (saved filters or static lists) | CORE | v1 | |
| 4.3 | Tags, status pipeline (New → Enriched → Verified → Exported) | CORE | v1 | |
| 4.4 | Inline edit + field history | CORE | v1 | |
| 4.5 | Bulk actions (enrich, verify, tag, delete, add-to-list, export) | CORE | v1 | |
| 4.6 | Column mapping & transform on import (split, trim, case, concat) | CORE | v1 | data-cleaning |
| 4.7 | Normalization (casing, whitespace, domain canonicalization, name parsing) | CORE | v1 | |
| 4.8 | Dedup across whole DB or within a list | CORE | v1 | |
| 4.9 | Export CSV / XLSX / JSON (full or filtered) | CORE | v1 | |
| 4.10 | Large-file split / chunked processing | CORE | v1 | splitcsv pattern |
| 4.11 | Activity log / audit trail | CORE | v1 | |
| 4.12 | Dashboard (counts, quality, recent jobs, source breakdown) | CORE | v1 | |

## 5. AI Layer (optional Claude, deeply integrated)

| # | Capability | Tier | Status |
|---|---|---|---|
| 5.1 | Generate optimal search queries from a lead's known fields | AI | v1 |
| 5.2 | Read a fetched page and extract the relevant person/company entity | AI | v1 |
| 5.3 | Homonym / entity resolution (pick the right person among many) | AI | v1 |
| 5.4 | Confidence scoring & explanation per enriched field | AI | v1 |
| 5.5 | Title/role normalization & seniority classification | AI | v1 |
| 5.6 | Listing-layout understanding for arbitrary directory pages | AI | v1 |
| 5.7 | Natural-language segment builder ("CTOs in Montreal SaaS, verified email") | AI | v2 |
| 5.8 | Per-task on/off + cost guardrails (token budget, model choice) | AI | v1 |

## 6. Marketplace (third-party connectors — cards, opt-in)

All providers from the source docs become cards, grouped by category, greyed-out until the user
adds a key/connection. We import their results into our schema; we never embed their code.

Categories & sample providers (full list in `marketplace.seed.json`):
- **Lead Source**: Apollo, DataAxle/InfoUSA, Crunchbase, D&B Hoovers, UpLead, Seamless.AI, Lead411, BoldData, Scott's, ZoomInfo
- **Lead Generation / Outreach**: LinkedHelper, PhantomBuster, Dux-Soup, Waalaxy, Lemlist, La Growth Machine
- **Enrichment**: People Data Labs, Clearbit, FullContact, BetterContact, FullEnrich, Enrich.so, Datanyze
- **Email finder**: Hunter, Snov.io, VoilaNorbert, Skrapp, FindThatLead, AeroLeads, GetProspect, Tomba
- **Verification**: ZeroBounce, Hunter Verifier, MillionVerifier, Trestle, ServiceObjects, Email-Checker
- **Extraction / Scraping**: Apify, Diffbot, Octoparse, ParseHub, ScrapeHero, Outscraper, Bardeen
- **Data manipulation**: Gigasheet, Konbert, SplitCSV
- **Search / SERP**: SerpAPI, Google CSE, Bing API

## 7. Cross-cutting / platform

| # | Capability | Tier | Status |
|---|---|---|---|
| 7.1 | Background job queue with progress, pause/resume, retry, logs | CORE | v1 |
| 7.2 | Rate limiting & polite crawling (per-domain delay, robots-aware, UA) | CORE | v1 |
| 7.3 | Settings (API keys vault, crawl politeness, AI config, theme) | CORE | v1 |
| 7.4 | Light/Dark theme (Netritious tokens) | CORE | v1 |
| 7.5 | Local-first, single-user, no auth (v1) | CORE | v1 |
| 7.6 | Multi-tenant-ready data model (tenant_id columns nullable now) | CORE | v1 |
| 7.7 | i18n-ready UI (string catalog, English default) | CORE | v1 |
