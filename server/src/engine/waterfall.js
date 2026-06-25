// The enrichment waterfall — owned re-implementation of the "find missing contact
// details by any means" pipeline. Works WITH or WITHOUT search/AI:
//   plan -> search -> crawl -> resolve -> email-pattern -> verify -> score
// Returns { fields, provenance[], log[], confidence } WITHOUT persisting (the
// queue/route persists), so it is pure and reusable in any host app.
import { Companies } from '../db/repositories/index.js';
import { search, extract, verifyEmails, parsePhones } from './workers.js';
import { generateQueries, resolveEntity, normalizeTitle, isAiEnabled } from './ai/index.js';
import { emailCandidates, genericCompanyEmails } from './emailPatterns.js';
import { canonicalDomain, guessDomains, contactPages } from './domains.js';
import logger from '../lib/logger.js';

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

function prov(field, value, source, method, confidence, verified = false) {
  return { field, value, source, method, confidence, verified };
}

async function safe(label, fn, log) {
  try { return await fn(); }
  catch (e) { log.push(`${label}: ERROR ${e.message}`); logger.debug(`${label} failed`, e.message); return null; }
}

// Resolve the best domain for a contact.
function resolveDomain(contact) {
  if (contact.email) { const d = canonicalDomain(contact.email); if (d) return { domain: d, source: 'email' }; }
  if (contact.company_id) {
    const company = Companies.get(contact.company_id);
    if (company?.domain) return { domain: canonicalDomain(company.domain), source: 'company' };
  }
  return { domain: null, source: null };
}

// ── Enrich a CONTACT ───────────────────────────────────────────────────
export async function enrichContact(contact, opts = {}) {
  const log = [];
  const provenance = [];
  const fields = {};
  const limit = opts.searchLimit ?? 6;
  const crawlCap = opts.crawlCap ?? 8;

  let { domain } = resolveDomain(contact);
  if (domain) log.push(`domain: ${domain}`);

  // 1. PLAN
  const queries = await safe('plan', () => generateQueries(contact), log) || [];
  if (queries.length) log.push(`plan: ${queries.length} queries (${isAiEnabled() ? 'AI' : 'heuristic'})`);

  // 2. SEARCH (best-effort)
  let searchUrls = [];
  if (queries.length && opts.useSearch !== false) {
    const sr = await safe('search', () => search(queries, { limit }), log);
    if (sr?.results?.length) {
      searchUrls = sr.results.map((r) => r.url);
      log.push(`search: ${searchUrls.length} urls`);
    } else {
      log.push(`search: 0 results${sr?.errors?.length ? ` (${sr.errors[0].error})` : ''}`);
    }
    // If we still have no domain, try to infer it from a non-social result.
    if (!domain) {
      const cand = searchUrls.find((u) => !/(linkedin|twitter|facebook|instagram|youtube)\./.test(u));
      if (cand) { domain = canonicalDomain(cand); if (domain) log.push(`domain (from search): ${domain}`); }
    }
  }

  // 3. CRAWL — company pages first (reliable), then top search results.
  const crawlUrls = uniq([
    ...(domain ? contactPages(domain) : []),
    ...searchUrls,
  ]).slice(0, crawlCap);
  let pages = [];
  if (crawlUrls.length) {
    const ex = await safe('crawl', () => extract(crawlUrls, { maxChars: 3500 }), log);
    pages = ex?.pages?.filter((p) => p.status === 200) || [];
    log.push(`crawl: ${pages.length}/${crawlUrls.length} pages ok`);
  }

  // 4. RESOLVE the right entity from crawled pages.
  let resolved = {};
  if (pages.length) {
    resolved = await safe('resolve', () => resolveEntity({ lead: contact, pages }), log) || {};
    log.push(`resolve: email=${resolved.email || '-'} phone=${resolved.phone || '-'} linkedin=${resolved.linkedin ? 'yes' : '-'} (${resolved.__ai ? 'AI' : 'heuristic'})`);
  }

  // 5. EMAIL PATTERN fallback — if no email yet, generate & verify candidates.
  let chosenEmail = resolved.email || null;
  let emailMethod = chosenEmail ? 'crawl' : null;
  if (!chosenEmail && domain) {
    const candidates = emailCandidates({ ...contact, domain });
    const generic = candidates.length ? [] : genericCompanyEmails(domain);
    const toTry = uniq([...candidates, ...generic]).slice(0, 10);
    if (toTry.length) {
      log.push(`pattern: trying ${toTry.length} candidates @${domain}`);
      const vr = await safe('pattern-verify', () => verifyEmails(toTry, { smtp: opts.smtp }), log);
      const results = vr?.results || [];
      const valid = results.find((r) => r.status === 'valid')
        || results.find((r) => r.status === 'catch_all')
        || results.find((r) => r.status === 'risky');
      if (valid) { chosenEmail = valid.email; emailMethod = 'pattern'; log.push(`pattern: chose ${valid.email} (${valid.status})`); }
      else log.push('pattern: no candidate passed');
    }
  }

  // 6. VERIFY the chosen email (records status + provenance).
  if (chosenEmail) {
    const vr = await safe('verify', () => verifyEmails([chosenEmail], { smtp: opts.smtp }), log);
    const r = vr?.results?.[0];
    fields.email = chosenEmail;
    fields.email_status = r?.status || 'unknown';
    provenance.push(prov('email', chosenEmail, domain || resolved.source || 'web', emailMethod || 'crawl',
      resolved.confidence ?? 0.5, r?.status === 'valid'));
    log.push(`verify: ${chosenEmail} -> ${fields.email_status}`);
  }

  // 7. PHONE — only accept a number libphonenumber considers valid, to avoid
  // regex false-positives (IDs, prices, etc.).
  const phone = resolved.phone || null;
  if (phone) {
    const pr = await safe('phone', () => parsePhones([{ value: phone, region: opts.region || 'US' }]), log);
    const p = pr?.results?.[0];
    if (p?.valid) {
      fields.phone = p.e164;
      fields.phone_type = p.type || null;
      provenance.push(prov('phone', fields.phone, domain || 'web', 'crawl', resolved.confidence ?? 0.4, true));
      log.push(`phone: ${p.e164} (${p.type})`);
    } else {
      log.push(`phone: discarded "${phone}" (not a valid number)`);
    }
  }

  // 8. Socials / linkedin / name / title.
  if (resolved.linkedin) { fields.linkedin = resolved.linkedin; provenance.push(prov('linkedin', resolved.linkedin, 'web', 'crawl', resolved.confidence ?? 0.5)); }
  if (resolved.socials && Object.keys(resolved.socials).length) fields.socials = resolved.socials;
  if (!contact.full_name && resolved.first_name) { fields.first_name = resolved.first_name; fields.last_name = resolved.last_name; }
  const titleToNormalize = resolved.title || contact.title;
  if (titleToNormalize) {
    const norm = await safe('title', () => normalizeTitle(titleToNormalize), log);
    if (norm) { fields.role = norm.role; fields.seniority = norm.seniority; if (!contact.title && resolved.title) fields.title = resolved.title; }
  }
  if (domain && !contact.company_id) fields.company_domain = domain; // hint for linking

  return { fields, provenance, log, confidence: resolved.confidence ?? (chosenEmail ? 0.5 : 0.1) };
}

// ── Enrich a COMPANY ───────────────────────────────────────────────────
export async function enrichCompany(company, opts = {}) {
  const log = [];
  const provenance = [];
  const fields = {};

  let domain = canonicalDomain(company.domain) || null;
  if (!domain) {
    // Try guessed domains; accept the first that serves a 200 homepage.
    const guesses = guessDomains(company.name);
    if (guesses.length) {
      log.push(`domain guess: trying ${guesses.length}`);
      const ex = await safe('crawl-guess', () => extract(guesses.map((d) => `https://${d}`), { maxChars: 2000 }), log);
      const hit = ex?.pages?.find((p) => p.status === 200);
      if (hit) { domain = canonicalDomain(hit.final_url || hit.url); log.push(`domain: ${domain} (guessed)`); fields.domain = domain; provenance.push(prov('domain', domain, 'guess', 'pattern', 0.4)); }
    }
  }
  if (!domain) { log.push('domain: not found'); return { fields, provenance, log, confidence: 0 }; }
  if (!company.domain) fields.domain = domain;

  // Crawl key pages for firmographics + contacts.
  const ex = await safe('crawl', () => extract(contactPages(domain), { maxChars: 4000 }), log);
  const pages = ex?.pages?.filter((p) => p.status === 200) || [];
  log.push(`crawl: ${pages.length} pages ok`);
  if (!pages.length) return { fields, provenance, log, confidence: 0.1 };

  const home = pages[0];
  fields.website = home.final_url || `https://${domain}`;
  if (home.description && !company.description) { fields.description = home.description; provenance.push(prov('description', home.description, domain, 'crawl', 0.6)); }

  const agg = ex.aggregate || {};
  if (agg.phones?.length && !company.phone) {
    const pr = await safe('phone', () => parsePhones(agg.phones.slice(0, 5).map((v) => ({ value: v, region: opts.region || 'US' })), {}), log);
    const valid = pr?.results?.find((r) => r.valid);
    if (valid) { fields.phone = valid.e164; provenance.push(prov('phone', valid.e164, domain, 'crawl', 0.6, true)); }
  }
  if (agg.socials && Object.keys(agg.socials).length) {
    fields.socials = agg.socials;
    provenance.push(prov('socials', JSON.stringify(agg.socials), domain, 'crawl', 0.6));
  }

  // Optional AI firmographic summary (industry/size) from homepage text.
  if (isAiEnabled() && (!company.industry || !company.description)) {
    const out = await safe('ai-firmographics', () => resolveEntity({ lead: { kind: 'company', name: company.name }, pages: pages.slice(0, 3) }), log);
    if (out) {
      if (out.company_name && !company.description && out.reasoning) { /* keep description from crawl */ }
    }
  }

  return { fields, provenance, log, confidence: 0.6 };
}

export default { enrichContact, enrichCompany };
