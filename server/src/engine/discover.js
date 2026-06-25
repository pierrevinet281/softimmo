// Lead discovery — create NEW leads from a brief, the original tool's core use case
// ("company + title -> find the person and their coordinates") plus company discovery
// from a search query. Reuses the enrichment waterfall and workers.
import { Companies, Contacts, Provenance, Activity } from '../db/repositories/index.js';
import { enrichContact } from './waterfall.js';
import { applyContactResult } from './apply.js';
import { search, extract } from './workers.js';
import { canonicalDomain } from './domains.js';
import { contactCompleteness, companyCompleteness, gradeContact, gradeCompany } from './scoring.js';

const uniq = (a) => [...new Set(a.filter(Boolean))];

// Discover ONE contact for a company+title brief.
export async function discoverContact(input, params = {}) {
  const log = [];
  // Link or create the company if we have a name/domain.
  let company = null;
  const domain = canonicalDomain(input.domain);
  if (domain) company = Companies.findByDomain(domain);
  if (!company && input.company_name) {
    company = Companies.create({
      name: input.company_name, domain: domain || null, source: 'discovery', status: 'new',
    });
    company.completeness = companyCompleteness(company);
    Companies.update(company.id, { completeness: company.completeness, grade: gradeCompany(company) });
    log.push(`company created: ${company.name}`);
  }

  // Create a stub contact, then run the full enrichment waterfall on it.
  const stub = Contacts.create({
    company_id: company?.id || null,
    company_name: input.company_name || company?.name || null,
    title: input.title || null,
    full_name: input.full_name || null,
    location: input.location || null,
    source: 'discovery',
    status: 'new',
  });
  log.push(`contact stub: ${stub.full_name || input.title || 'unknown'} @ ${stub.company_name || '-'}`);

  const result = await enrichContact({ ...stub, domain }, params);
  applyContactResult(stub, result, { overwrite: false });
  log.push(...result.log);
  return { id: stub.id, log };
}

// Discover companies from a free-text query (e.g. "boat dealers in Ontario").
export async function discoverCompanies(input, params = {}) {
  const log = [];
  const ids = [];
  const query = input.query;
  const limit = params.limit ?? 10;
  if (!query) return { ids, log: ['no query'] };

  const sr = await search([query], { limit });
  const urls = (sr.results || []).map((r) => r.url)
    .filter((u) => !/(linkedin|twitter|facebook|instagram|youtube|wikipedia|yelp|reddit)\./.test(u));
  log.push(`search: ${urls.length} candidate urls`);
  if (!urls.length) { log.push(`search returned nothing${sr.errors?.[0] ? ` (${sr.errors[0].error})` : ''}`); return { ids, log }; }

  // One company per distinct domain.
  const byDomain = new Map();
  for (const u of urls) { const d = canonicalDomain(u); if (d && !byDomain.has(d)) byDomain.set(d, u); }

  const ex = await extract([...byDomain.values()].slice(0, limit), { maxChars: 2500 });
  for (const page of ex.pages || []) {
    if (page.status !== 200) continue;
    const d = canonicalDomain(page.final_url || page.url);
    if (!d || Companies.findByDomain(d)) continue;
    const name = (page.title || d).split(/[|\-–—:]/)[0].trim().slice(0, 120) || d;
    const s = page.socials || {};
    const created = Companies.create({
      name, domain: d, website: page.final_url || `https://${d}`,
      description: page.description || null,
      // Map known socials to discrete columns (source of truth); keep JSON as catch-all.
      linkedin: s.linkedin || null, facebook: s.facebook || null, instagram: s.instagram || null,
      youtube: s.youtube || null, twitter: s.twitter || null,
      socials: Object.keys(s).length ? s : null,
      source: 'discovery', status: 'enriched',
    });
    Provenance.record({ entity_type: 'company', entity_id: created.id, field: 'domain', value: d, source: 'search', method: 'discover', confidence: 0.5 });
    const comp = companyCompleteness(created);
    Companies.update(created.id, { completeness: comp, grade: gradeCompany(created) });
    ids.push(created.id);
  }
  log.push(`created ${ids.length} companies`);
  Activity.log({ kind: 'enrich', summary: `Discovered ${ids.length} companies for "${query}"` });
  return { ids, log };
}

export default { discoverContact, discoverCompanies };
