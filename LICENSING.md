# Licensing & Ownership

> **Goal**: the Lead Gen **core** is 100% your property, carries **no recurring or usage
> fee**, and imposes **no legal barrier** to commercializing the product or selling the
> company.

## 1. Your code

All application code in this repository (Node server, React app, Python workers, SQL,
docs) is original work written for you. You own it outright. There is no copyleft
contamination because every runtime dependency is **permissively licensed** (below).

## 2. Runtime dependencies — all permissive

| Dependency | License | Commercial use | Resale OK | Notes |
|---|---|---|---|---|
| React, React Router, Express, better-sqlite3, zod, csv-parse/stringify, @anthropic-ai/sdk | MIT | ✅ | ✅ | keep LICENSE file in node_modules; no UI attribution required |
| lucide-react, dnspython | ISC | ✅ | ✅ | |
| requests, phonenumbers, SheetJS `xlsx` | Apache-2.0 | ✅ | ✅ | patent grant included |
| beautifulsoup4 | MIT | ✅ | ✅ | |
| lxml | BSD-3 | ✅ | ✅ | |
| email-validator (if used) | CC0 / Unlicense | ✅ | ✅ | public domain |

**What permissive licenses require of you**: essentially only that the dependency's own
copyright/license notice stays inside its distributed files (i.e. in `node_modules` /
the Python package). This is **not** user-facing attribution, does **not** apply to your
own code, and does **not** restrict selling your product or company.

## 3. Hard exclusions (CI/contributor rule)

Never add a dependency under any of these — they can force source disclosure or block
commercial resale:

- **GPL / LGPL / AGPL** (copyleft)
- **SSPL**, **BSL/Business Source**, **Elastic License**, **“Commons Clause”**
- Anything labeled **“non-commercial”**, **“source-available”**, or **“free for personal
  use only”**

Before adding any package run a license check (e.g. `license-checker` for npm,
`pip-licenses` for Python) and reject the above.

## 4. Third-party data & the Marketplace

The Marketplace connects to external providers (Apollo, Hunter, ZeroBounce, …) **only via
their public APIs using your own account/keys**. We never bundle or fork their code.
The data they return is governed by *your* contract with that provider — that is a usage
choice you opt into per provider, fully separate from the free core. Removing every
Marketplace connection leaves a fully functional, cost-free product.

## 5. Web crawling note

The core engine fetches public web pages (like a browser) for extraction. Keep crawling
polite (rate limits, optional robots.txt respect — both configurable in Settings) and
mind each site's terms for your jurisdiction. This is an operational policy, not a
licensing obligation on the code.
