// Engine actions: enrich, verify, discover. All create background jobs and return
// the job so the UI can poll progress.
import { Router } from 'express';
import { z } from 'zod';
import { wrap, badRequest, notFound } from '../lib/errors.js';
import { Contacts, Companies } from '../db/repositories/index.js';
import { enqueue } from '../engine/queue.js';

const r = Router();

const idsSchema = z.object({
  entity_type: z.enum(['contact', 'company']).default('contact'),
  ids: z.array(z.string()).min(1),
  params: z.record(z.any()).optional(),
});

// POST /api/enrich  { entity_type, ids[], params }
r.post('/enrich', wrap(async (req, res) => {
  const { entity_type, ids, params = {} } = idsSchema.parse(req.body);
  const items = ids.map((id) => ({ entity_type, entity_id: id, input: {} }));
  const job = enqueue('enrich', params, items);
  res.status(202).json(job);
}));

// POST /api/verify  { ids[], params }
r.post('/verify', wrap(async (req, res) => {
  const schema = z.object({ ids: z.array(z.string()).min(1), params: z.record(z.any()).optional() });
  const { ids, params = {} } = schema.parse(req.body);
  const items = ids.map((id) => ({ entity_type: 'contact', entity_id: id, input: {} }));
  const job = enqueue('verify', params, items);
  res.status(202).json(job);
}));

// POST /api/discover/contact  { company_name, title, location, domain, full_name, count }
r.post('/discover/contact', wrap(async (req, res) => {
  const schema = z.object({
    company_name: z.string().optional(),
    domain: z.string().optional(),
    title: z.string().optional(),
    full_name: z.string().optional(),
    location: z.string().optional(),
    count: z.number().int().min(1).max(50).optional(),
    params: z.record(z.any()).optional(),
  });
  const body = schema.parse(req.body);
  if (!body.company_name && !body.domain) throw badRequest('Provide company_name or domain');
  const n = body.count || 1;
  const items = Array.from({ length: n }, () => ({ input: { company_name: body.company_name, domain: body.domain, title: body.title, full_name: body.full_name, location: body.location } }));
  const job = enqueue('discover', { mode: 'contact', ...(body.params || {}) }, items);
  res.status(202).json(job);
}));

// POST /api/discover/companies  { query, limit }
r.post('/discover/companies', wrap(async (req, res) => {
  const schema = z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(30).optional(), params: z.record(z.any()).optional() });
  const { query, limit = 10, params = {} } = schema.parse(req.body);
  const job = enqueue('discover', { mode: 'company', limit, ...params }, [{ input: { query } }]);
  res.status(202).json(job);
}));

// Convenience: enrich a single entity by path.
r.post('/:type(contacts|companies)/:id/enrich', wrap(async (req, res) => {
  const entity_type = req.params.type === 'companies' ? 'company' : 'contact';
  const repo = entity_type === 'company' ? Companies : Contacts;
  if (!repo.get(req.params.id)) throw notFound('Entity not found');
  const job = enqueue('enrich', req.body?.params || {}, [{ entity_type, entity_id: req.params.id, input: {} }]);
  res.status(202).json(job);
}));

export default r;
