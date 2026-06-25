// Apply a waterfall result to an entity: merge only missing/empty fields (unless
// overwrite), persist field provenance, recompute completeness + grade + status.
import { Companies, Contacts, Provenance } from '../db/repositories/index.js';
import { contactCompleteness, companyCompleteness, gradeContact, gradeCompany } from './scoring.js';

const isEmpty = (v) => v == null || v === '' || (typeof v === 'object' && !Object.keys(v).length);

// Discrete social columns we expand a `socials` JSON object into.
const SOCIAL_KEYS = ['linkedin', 'facebook', 'instagram', 'youtube', 'twitter'];

// Spread a socials object onto discrete columns (only filling empty ones).
function expandSocials(entity, socials, patch) {
  if (!socials || typeof socials !== 'object') return;
  for (const k of SOCIAL_KEYS) {
    if (socials[k] && isEmpty(entity[k]) && isEmpty(patch[k])) patch[k] = socials[k];
  }
}

export function applyContactResult(contact, result, { overwrite = false } = {}) {
  const patch = {};
  for (const [k, v] of Object.entries(result.fields || {})) {
    if (k === 'company_domain') continue; // hint only
    if (isEmpty(v)) continue;
    if (overwrite || isEmpty(contact[k])) patch[k] = v;
  }
  expandSocials(contact, result.fields?.socials, patch);
  const merged = { ...contact, ...patch };
  patch.completeness = contactCompleteness(merged);
  patch.grade = gradeContact(merged);
  if (merged.status === 'new') patch.status = 'enriched';

  const updated = Contacts.update(contact.id, patch);
  for (const p of result.provenance || []) {
    Provenance.record({ entity_type: 'contact', entity_id: contact.id, ...p, verified: p.verified ? 1 : 0 });
  }
  return updated;
}

export function applyCompanyResult(company, result, { overwrite = false } = {}) {
  const patch = {};
  for (const [k, v] of Object.entries(result.fields || {})) {
    if (isEmpty(v)) continue;
    if (overwrite || isEmpty(company[k])) patch[k] = v;
  }
  expandSocials(company, result.fields?.socials, patch);
  const merged = { ...company, ...patch };
  patch.completeness = companyCompleteness(merged);
  patch.grade = gradeCompany(merged);
  if (merged.status === 'new') patch.status = 'enriched';

  const updated = Companies.update(company.id, patch);
  for (const p of result.provenance || []) {
    Provenance.record({ entity_type: 'company', entity_id: company.id, ...p, verified: p.verified ? 1 : 0 });
  }
  return updated;
}

export default { applyContactResult, applyCompanyResult };
