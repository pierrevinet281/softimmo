import { Router } from 'express';
import { z } from 'zod';
import { wrap, notFound, badRequest } from '../lib/errors.js';
import { Contacts, Companies, Provenance, Activity } from '../db/repositories/index.js';
import { contactCompleteness, gradeContact } from '../engine/scoring.js';

const r = Router();

const upsertSchema = z.object({
  company_id: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  full_name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  socials: z.record(z.string()).optional().nullable(),
  location: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
}).passthrough();

function recompute(contact) {
  return Contacts.update(contact.id, { completeness: contactCompleteness(contact), grade: gradeContact(contact) });
}

// A manually-entered company_id must reference a real company (FK is enforced).
// If it doesn't, drop it (keep company_name) instead of failing. If absent but a
// company_name matches an existing company exactly, auto-link it.
function linkCompany(data) {
  if (data.company_id) {
    if (!Companies.get(data.company_id)) data.company_id = null;
  } else if (data.company_name) {
    const hit = Companies.list({ q: data.company_name, limit: 5 }).rows
      .find((c) => c.name?.toLowerCase() === data.company_name.toLowerCase());
    if (hit) data.company_id = hit.id;
  }
  return data;
}

r.get('/', wrap(async (req, res) => {
  const { q, status, company_id, email_status, limit, offset, sort, dir } = req.query;
  res.json(Contacts.list({
    q, status, company_id, email_status,
    limit: Math.min(parseInt(limit || '50', 10), 500),
    offset: parseInt(offset || '0', 10),
    sort, dir,
  }));
}));

r.post('/', wrap(async (req, res) => {
  const data = linkCompany(upsertSchema.parse(req.body));
  if (!data.full_name && !data.first_name && !data.email && !data.company_name) {
    throw badRequest('Provide at least a name, email, or company');
  }
  let contact = Contacts.create({ ...data, source: data.source || 'manual' });
  contact = recompute(contact);
  Activity.log({ kind: 'create', entity_type: 'contact', entity_id: contact.id, summary: `Created contact ${contact.full_name || contact.email || ''}` });
  res.status(201).json(contact);
}));

r.get('/:id', wrap(async (req, res) => {
  const contact = Contacts.get(req.params.id);
  if (!contact) throw notFound('Contact not found');
  res.json(contact);
}));

r.get('/:id/provenance', wrap(async (req, res) => {
  res.json({ rows: Provenance.forEntity('contact', req.params.id) });
}));

r.patch('/:id', wrap(async (req, res) => {
  const existing = Contacts.get(req.params.id);
  if (!existing) throw notFound('Contact not found');
  const data = linkCompany(upsertSchema.parse(req.body));
  Contacts.update(req.params.id, data);
  const contact = recompute(Contacts.get(req.params.id));
  Activity.log({ kind: 'update', entity_type: 'contact', entity_id: contact.id, summary: `Updated contact ${contact.full_name || contact.email || ''}` });
  res.json(contact);
}));

r.delete('/:id', wrap(async (req, res) => {
  const existing = Contacts.get(req.params.id);
  if (!existing) throw notFound('Contact not found');
  Contacts.delete(req.params.id);
  Activity.log({ kind: 'delete', entity_type: 'contact', entity_id: req.params.id, summary: `Deleted contact ${existing.full_name || ''}` });
  res.json({ ok: true });
}));

export default r;
