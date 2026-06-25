import { Router } from 'express';
import { z } from 'zod';
import { wrap, notFound, badRequest } from '../lib/errors.js';
import { Lists, Contacts, Companies } from '../db/repositories/index.js';

const r = Router();

r.get('/', wrap(async (req, res) => res.json({ rows: Lists.all() })));

r.post('/', wrap(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    kind: z.enum(['static', 'smart']).optional(),
    entity_type: z.enum(['contact', 'company']).optional(),
    filter: z.record(z.any()).optional().nullable(),
    color: z.string().optional().nullable(),
  });
  const data = schema.parse(req.body);
  res.status(201).json(Lists.create(data));
}));

r.get('/:id', wrap(async (req, res) => {
  const list = Lists.get(req.params.id);
  if (!list) throw notFound('List not found');
  const members = Lists.memberIds(req.params.id);
  res.json({ ...list, members });
}));

r.get('/:id/members', wrap(async (req, res) => {
  const list = Lists.get(req.params.id);
  if (!list) throw notFound('List not found');
  const refs = Lists.memberIds(req.params.id);
  const rows = refs.map(({ entity_type, entity_id }) =>
    (entity_type === 'company' ? Companies.get(entity_id) : Contacts.get(entity_id))).filter(Boolean);
  res.json({ rows, entity_type: list.entity_type });
}));

r.post('/:id/members', wrap(async (req, res) => {
  const list = Lists.get(req.params.id);
  if (!list) throw notFound('List not found');
  const schema = z.object({ entity_type: z.enum(['contact', 'company']).optional(), ids: z.array(z.string()).min(1) });
  const { entity_type, ids } = schema.parse(req.body);
  const n = Lists.addMembers(req.params.id, entity_type || list.entity_type, ids);
  res.json({ added: n });
}));

r.delete('/:id/members/:entityId', wrap(async (req, res) => {
  const list = Lists.get(req.params.id);
  if (!list) throw notFound('List not found');
  const entity_type = req.query.entity_type || list.entity_type;
  res.json({ removed: Lists.removeMember(req.params.id, entity_type, req.params.entityId) });
}));

r.patch('/:id', wrap(async (req, res) => {
  if (!Lists.get(req.params.id)) throw notFound('List not found');
  res.json(Lists.update(req.params.id, req.body || {}));
}));

r.delete('/:id', wrap(async (req, res) => {
  if (!Lists.get(req.params.id)) throw notFound('List not found');
  Lists.delete(req.params.id);
  res.json({ ok: true });
}));

export default r;
