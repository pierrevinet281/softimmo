import { Router } from 'express';
import { z } from 'zod';
import { wrap, notFound, badRequest } from '../lib/errors.js';
import { Companies, Provenance, Activity } from '../db/repositories/index.js';
import { companyCompleteness, gradeCompany } from '../engine/scoring.js';

const r = Router();

const upsertSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  socials: z.record(z.string()).optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
}).passthrough();

function recompute(company) {
  const completeness = companyCompleteness(company);
  return Companies.update(company.id, { completeness, grade: gradeCompany(company) });
}

r.get('/', wrap(async (req, res) => {
  const { q, status, limit, offset, sort, dir } = req.query;
  res.json(Companies.list({
    q, status,
    limit: Math.min(parseInt(limit || '50', 10), 500),
    offset: parseInt(offset || '0', 10),
    sort, dir,
  }));
}));

r.post('/', wrap(async (req, res) => {
  const data = upsertSchema.parse(req.body);
  if (!data.name) throw badRequest('name is required');
  let company = Companies.create({ ...data, source: data.source || 'manual' });
  company = recompute(company);
  Activity.log({ kind: 'create', entity_type: 'company', entity_id: company.id, summary: `Created company ${company.name}` });
  res.status(201).json(company);
}));

r.get('/:id', wrap(async (req, res) => {
  const company = Companies.get(req.params.id);
  if (!company) throw notFound('Company not found');
  res.json(company);
}));

r.get('/:id/provenance', wrap(async (req, res) => {
  res.json({ rows: Provenance.forEntity('company', req.params.id) });
}));

r.patch('/:id', wrap(async (req, res) => {
  const existing = Companies.get(req.params.id);
  if (!existing) throw notFound('Company not found');
  const data = upsertSchema.parse(req.body);
  Companies.update(req.params.id, data);
  const company = recompute(Companies.get(req.params.id));
  Activity.log({ kind: 'update', entity_type: 'company', entity_id: company.id, summary: `Updated company ${company.name}` });
  res.json(company);
}));

r.delete('/:id', wrap(async (req, res) => {
  const existing = Companies.get(req.params.id);
  if (!existing) throw notFound('Company not found');
  Companies.delete(req.params.id);
  Activity.log({ kind: 'delete', entity_type: 'company', entity_id: req.params.id, summary: `Deleted company ${existing.name}` });
  res.json({ ok: true });
}));

export default r;
