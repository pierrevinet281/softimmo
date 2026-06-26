// Generic CRUD router factory for Softimmo business entities.
// Mirrors the hand-written companies route (wrap + zod + Activity logging), so every
// entity exposes a consistent REST surface: GET / (list+filters), POST /, GET/PATCH/DELETE /:id.
import { Router } from 'express';
import { wrap, notFound, badRequest } from '../lib/errors.js';
import { Activity } from '../db/repositories/index.js';

export function makeCrudRouter({ repo, entityType, schema, requiredOnCreate = [], labelField = 'name' }) {
  const r = Router();
  const validate = (body) => (schema ? schema.parse(body) : body);
  const label = (row) => row?.[labelField] ?? row?.title ?? row?.full_name ?? row?.id;

  r.get('/', wrap(async (req, res) => {
    res.json(repo.list(req.query));
  }));

  r.post('/', wrap(async (req, res) => {
    const data = validate(req.body);
    for (const f of requiredOnCreate) {
      if (data[f] === undefined || data[f] === null || data[f] === '') throw badRequest(`${f} est requis`);
    }
    const row = repo.create(data);
    Activity.log({ kind: 'create', entity_type: entityType, entity_id: row.id, summary: `Création ${entityType} ${label(row)}` });
    res.status(201).json(row);
  }));

  r.get('/:id', wrap(async (req, res) => {
    const row = repo.get(req.params.id);
    if (!row) throw notFound(`${entityType} introuvable`);
    res.json(row);
  }));

  r.patch('/:id', wrap(async (req, res) => {
    const existing = repo.get(req.params.id);
    if (!existing) throw notFound(`${entityType} introuvable`);
    const data = validate(req.body);
    const row = repo.update(req.params.id, data);
    Activity.log({ kind: 'update', entity_type: entityType, entity_id: row.id, summary: `Mise à jour ${entityType} ${label(row)}` });
    res.json(row);
  }));

  r.delete('/:id', wrap(async (req, res) => {
    const existing = repo.get(req.params.id);
    if (!existing) throw notFound(`${entityType} introuvable`);
    repo.delete(req.params.id);
    Activity.log({ kind: 'delete', entity_type: entityType, entity_id: req.params.id, summary: `Suppression ${entityType} ${label(existing)}` });
    res.json({ ok: true });
  }));

  return r;
}

export default makeCrudRouter;
