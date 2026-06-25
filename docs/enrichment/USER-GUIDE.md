# Lead Gen — User Guide

> A practical walkthrough of every screen. The UI is English; the app is single-user with no
> login. (Internal slug `leadgen` appears in package names, the DB file and env vars.)

## Getting around

The left sidebar groups everything:

- **Overview** (top item) — the dashboard for this module.
- **Leads** → Contact Leads, Company Leads, Leads Lists
- **Engine** → Generate, Verify, Import / Export
- **Platform** → Marketplace, Activity, Settings

Top-right: a **theme toggle** (light/dark) and a live **“job running”** indicator when the engine
is working in the background. Numbers next to Contact/Company Leads show your totals.

---

## Overview

At-a-glance counts (contacts, companies, with email, with phone), an **Email quality** bar
(valid/risky/invalid/unknown), a **Lead grades** bar (A–D), quick actions, and recent activity.

---

## Contact Leads & Company Leads

The two core tables. Each row shows the key fields, status badges and a **grade** (A = complete &
verified, D = sparse).

- **Search** by name / email / company / domain; **filter** by status and email status.
- **Click a row** to open the detail drawer.
- **Select rows** (checkboxes) to run **bulk actions**: Enrich, Verify (contacts), Delete, Export.
- **Add** a record manually with the **Add** button — a full form covering identity, address
  (company), classification (SIC/NAICS for companies), phone/extension/mobile (contacts), and a
  complete set of social/messaging profiles (LinkedIn, Facebook, Instagram, YouTube, X, plus
  TikTok, WhatsApp, Reddit, WeChat, Telegram, Threads for contacts). Fields the engine does not
  auto-enrich yet can still be filled manually or via import.
- **Export** the current (optionally filtered) view as CSV.

### Lead detail drawer

Opens on the right. From here you can:

- **Enrich** — runs the waterfall to fill missing fields.
- **Verify** (contacts) — re-checks the email and phone.
- **Edit** any field inline and **Save**.
- See **social/website buttons** when found.
- Review **Provenance & confidence** — every enriched value with its source, method
  (`crawl` / `pattern` / `ai` / `search`), timestamp and a confidence bar. This is your audit of
  *where each value came from and how trustworthy it is*.

---

## Generate (lead generation)

Two modes:

### Find a contact
The original use case. Enter a **company name** (and optionally its **domain**, which improves
accuracy), a **target title** (e.g. “VP of Sales”) and optionally a location. The engine:
1. generates search queries, 2. crawls the company site + top results, 3. extracts and verifies
the best email / phone / LinkedIn, 4. creates the contact (and the company if new). A live
progress bar appears; when done, open **Contacts**.

### Discover companies
Describe what you want (e.g. “boat dealers in Ontario”) and a max count. The engine searches the
public web, opens each distinct site, and creates company records with website, description and
socials. Open **Companies** when done.

> If search returns nothing, your network/IP is likely rate-limited by the free search engines.
> Add a Google Programmable Search key in **Settings** or connect a search provider in the
> **Marketplace**. Direct crawling/enrichment still works without search.

---

## Verify

Bulk-validate emails and phones. Choose which contacts to check (those with **unknown** or
**risky** email status, or **all**), then run. Results update each contact’s email status
(valid / risky / invalid / catch-all), normalize phones to E.164, and recompute grades.

Email checking levels: **syntax → MX (mail server) → optional SMTP probe**. The SMTP probe gives
the strongest signal but can affect your sending IP reputation, so it’s **off by default** (enable
it in Settings).

---

## Leads Lists

Create **static lists** (e.g. “Q3 outreach”) for contacts or companies. Add members from the
tables, view members, and export. Lists are great for organizing outreach batches.

---

## Import / Export

### Import
1. Choose **Contacts** or **Companies**.
2. Pick a **CSV or Excel** file. Lead Gen previews the columns and **auto-suggests a mapping**.
3. Adjust the **column → field** mapping if needed, then **Import**. You’ll see how many rows were
   created/skipped.

### Export
Download your full **Contacts** or **Companies** database as **CSV, XLSX or JSON**. Filtered
exports are available from the search bars on the table pages.

---

## Marketplace

58 third-party provider cards grouped by category (Lead Sources, Enrichment, Email Finders,
Verification, Extraction, Data Manipulation, Search, Lead Generation). Cards are **greyed-out until
connected**.

- Click **Connect** to add an API key (stored locally) or follow a provider’s manual steps.
- Connected providers are marked and their data flows into your database.
- The **free core never requires any of these** — they are optional power-ups you pay the provider
  for directly.

---

## Activity

A full audit trail: recent **jobs** (with status and success counts) and an **activity log** of
every create/update/delete/enrich/verify/import/export/connect action.

---

## Settings

- **AI layer (Claude)** — toggle on, paste your Anthropic API key, choose the model. Enables smart
  query generation, homonym resolution, confidence scoring and title normalization. Optional.
- **Search provider** — add a Google CSE key (+ engine ID) or a self-hosted SearXNG URL for
  reliable search.
- **Crawling & verification** — per-domain delay, concurrency, respect robots.txt, and the SMTP
  probe toggle.
- **System status** — confirms the Python engine is ready and whether AI is active.

All secrets stay on your machine (local SQLite).

---

## Tips

- Start by **importing** an existing list or **adding** a few leads, then **Enrich** them.
- Use **Verify** before exporting for outreach to maximize deliverability.
- Watch **Provenance** to understand and trust each value.
- For best discovery results, add a search key (Settings) — the rest of the engine is fully free.
