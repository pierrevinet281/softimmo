// Generate candidate email addresses for a person at a domain, ordered by how
// common each pattern is in B2B. Used when no email is found by crawling — the
// candidates are then ranked by verification (MX/SMTP) to pick the best one.
import { Reference } from '../db/repositories/index.js';

const clean = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
  .replace(/[^a-z]/g, '');

// Ordered by real-world prevalence.
const PATTERNS = [
  ({ f, l }) => `${f}.${l}`,
  ({ f, l }) => `${f}${l}`,
  ({ f, l }) => `${f[0]}${l}`,
  ({ f, l }) => `${f}`,
  ({ f, l }) => `${f}_${l}`,
  ({ f, l }) => `${f[0]}.${l}`,
  ({ f, l }) => `${l}.${f}`,
  ({ f, l }) => `${l}${f[0]}`,
  ({ f, l }) => `${f}-${l}`,
  ({ f, l }) => `${l}`,
];

export function emailCandidates({ first_name, last_name, full_name, domain }) {
  if (!domain) return [];
  const d = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  let f = clean(first_name);
  let l = clean(last_name);
  if ((!f || !l) && full_name) {
    const parts = full_name.trim().split(/\s+/);
    if (parts.length >= 2) { f = f || clean(parts[0]); l = l || clean(parts[parts.length - 1]); }
    else f = f || clean(parts[0]);
  }
  if (!f) return [];
  const ctx = { f, l: l || '' };
  const locals = new Set();
  for (const p of PATTERNS) {
    try {
      const local = p(ctx);
      if (local && /^[a-z0-9._-]+$/.test(local) && !local.endsWith('.') && !local.startsWith('.')) {
        locals.add(local);
      }
    } catch { /* pattern needs last name we don't have */ }
  }
  return [...locals].map((local) => `${local}@${d}`);
}

// Role/generic mailboxes to try for a company when we have no person name.
export function genericCompanyEmails(domain) {
  if (!domain) return [];
  const d = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  // Reuse the seeded role-local reference list (no hardcoded data).
  const roles = Reference.values('role_local');
  const common = roles.length ? roles.slice(0, 6) : ['info', 'contact', 'sales', 'hello'];
  return common.map((r) => `${r}@${d}`);
}

export default { emailCandidates, genericCompanyEmails };
