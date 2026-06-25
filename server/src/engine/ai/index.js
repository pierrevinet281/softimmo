// AI layer (optional). Wraps Claude for query generation, entity resolution,
// field mapping, title normalization and confidence scoring. Every function
// degrades gracefully to a deterministic heuristic when AI is disabled or no key
// is set — so the whole engine works with or without AI.
import Anthropic from '@anthropic-ai/sdk';
import config from '../../lib/config.js';
import logger from '../../lib/logger.js';
import { Settings, Reference } from '../../db/repositories/index.js';

let _client = null;

export function aiConfig() {
  const s = Settings.get('ai', {}) || {};
  const apiKey = s.apiKey || config.ai.apiKey || '';
  const enabled = (s.enabled ?? config.ai.enabled) && !!apiKey;
  return {
    enabled,
    apiKey,
    model: s.model || config.ai.model,
    maxTokens: s.maxTokens || config.ai.maxTokens,
  };
}

export function isAiEnabled() { return aiConfig().enabled; }

function client() {
  const c = aiConfig();
  if (!c.enabled) return null;
  if (_client && _client.__key === c.apiKey) return _client;
  _client = new Anthropic({ apiKey: c.apiKey });
  _client.__key = c.apiKey;
  return _client;
}

// Call Claude and parse a JSON object from the response. Returns null on any failure.
async function askJson(system, user, { maxTokens } = {}) {
  const c = aiConfig();
  const cl = client();
  if (!cl) return null;
  try {
    const resp = await cl.messages.create({
      model: c.model,
      max_tokens: maxTokens || c.maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = resp.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') || '';
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    logger.warn('AI call failed:', e.message);
    return null;
  }
}

// ── 1. Query generation ────────────────────────────────────────────────
export async function generateQueries(lead) {
  const heuristic = heuristicQueries(lead);
  if (!isAiEnabled()) return heuristic;
  const out = await askJson(
    'You craft precise web-search queries to find a specific person or company\'s public contact details (email, phone, LinkedIn). Return JSON only: {"queries": ["..."]}. 3-6 queries, varied (site:linkedin.com, company site, name+title+location). No prose.',
    `Known fields: ${JSON.stringify(lead)}`,
    { maxTokens: 400 },
  );
  const qs = out?.queries?.filter((q) => typeof q === 'string' && q.trim());
  return qs && qs.length ? qs.slice(0, 6) : heuristic;
}

export function heuristicQueries(lead) {
  const name = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  const company = lead.company_name || lead.company || '';
  const title = lead.title || '';
  const domain = lead.domain || '';
  const loc = lead.location || '';
  const q = [];
  if (name && company) q.push(`"${name}" "${company}" email`);
  if (name && company) q.push(`"${name}" ${company} contact ${loc}`.trim());
  if (name) q.push(`"${name}" ${title} linkedin`.trim());
  if (!name && company && title) q.push(`${company} "${title}" email contact`);
  if (!name && company) q.push(`${company} ${title} site:linkedin.com`.trim());
  if (domain) q.push(`${name || title} email @${domain}`.trim());
  if (company && !q.length) q.push(`${company} contact email phone`);
  return [...new Set(q)].filter(Boolean).slice(0, 6);
}

// ── 2. Entity resolution / field mapping from fetched pages ────────────
export async function resolveEntity({ lead, pages }) {
  // pages: [{url,title,description,emails,phones,socials,text}]
  if (!isAiEnabled()) return heuristicResolve({ lead, pages });
  const compact = pages.slice(0, 6).map((p) => ({
    url: p.url, title: p.title, description: p.description,
    emails: p.emails?.slice(0, 8), phones: p.phones?.slice(0, 6), socials: p.socials,
    text: (p.text || '').slice(0, 1200),
  }));
  const out = await askJson(
    'You extract the BEST contact details for the target lead from scraped pages. '
    + 'Only attribute data you are confident belongs to THIS person/company (beware homonyms). '
    + 'Return JSON only: {"email":null|str,"phone":null|str,"linkedin":null|str,'
    + '"socials":{},"first_name":null,"last_name":null,"title":null,"company_name":null,'
    + '"website":null,"confidence":0..1,"reasoning":str}. Use null when unsure.',
    `TARGET: ${JSON.stringify(lead)}\n\nPAGES: ${JSON.stringify(compact)}`,
    { maxTokens: 700 },
  );
  if (!out) return heuristicResolve({ lead, pages });
  out.__ai = true;
  return out;
}

// Deterministic fallback resolver: pick the most plausible email/phone/linkedin.
export function heuristicResolve({ lead, pages }) {
  const allEmails = [];
  const allPhones = [];
  let socials = {};
  let website = null;
  for (const p of pages) {
    for (const e of p.emails || []) allEmails.push({ email: e, url: p.url });
    for (const ph of p.phones || []) allPhones.push(ph);
    socials = { ...p.socials, ...socials };
    if (!website && p.final_url) {
      try { website = new URL(p.final_url).origin; } catch { /* ignore */ }
    }
  }
  const name = (lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`).toLowerCase().trim();
  const parts = name.split(/\s+/).filter(Boolean);
  // Prefer an email whose local-part matches the person's name.
  let best = null;
  for (const { email } of allEmails) {
    const local = email.split('@')[0].toLowerCase();
    const score = parts.reduce((s, part) => (part.length > 1 && local.includes(part) ? s + 1 : s), 0);
    if (!best || score > best.score) best = { email, score };
  }
  const confidence = best ? (best.score > 0 ? 0.6 : 0.35) : 0;
  return {
    email: best?.email || (allEmails[0]?.email ?? null),
    phone: allPhones[0] || null,
    linkedin: socials.linkedin || null,
    socials,
    website,
    confidence,
    reasoning: best?.score ? 'email local-part matches name' : 'first available contact on pages',
    __ai: false,
  };
}

// ── 3. Title normalization / seniority ─────────────────────────────────
// Seniority keywords come from the DB reference data (category 'seniority'),
// not hardcoded. Longer keywords are matched first for specificity.
export function normalizeTitleHeuristic(title) {
  if (!title) return { role: null, seniority: null };
  const t = title.toLowerCase();
  const rules = Reference.entries('seniority')
    .map((e) => ({ kw: e.value, seniority: e.meta?.seniority || 'Other' }))
    .sort((a, b) => b.kw.length - a.kw.length);
  for (const r of rules) {
    if (t.includes(r.kw)) return { role: title.trim(), seniority: r.seniority };
  }
  return { role: title.trim(), seniority: 'Other' };
}

export async function normalizeTitle(title) {
  const h = normalizeTitleHeuristic(title);
  if (!isAiEnabled() || !title) return h;
  const out = await askJson(
    'Normalize a job title. Return JSON only: {"role":str,"seniority":"C-level|VP|Director|Manager|IC|Other","department":str|null}.',
    `Title: ${title}`,
    { maxTokens: 150 },
  );
  return out && out.role ? out : h;
}

export default { generateQueries, resolveEntity, normalizeTitle, isAiEnabled, aiConfig };
