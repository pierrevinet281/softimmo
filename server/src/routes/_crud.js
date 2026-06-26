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

  // Création en lot (import / copier-coller). Best-effort : crée chaque rangée valide,
  // renvoie { created, errors } pour signaler les rangées rejetées sans tout annuler.
  r.post('/bulk', wrap(async (req, res) => {
    const rows = Array.isArray(req.body) ? req.body : (req.body?.rows || []);
    if (!Array.isArray(rows) || rows.length === 0) throw badRequest('rows (tableau non vide) est requis');
    if (rows.length > 2000) throw badRequest('Trop de rangées (max 2000)');
    const created = []; const errors = [];
    rows.forEach((raw, i) => {
      try {
        const data = validate(raw);
        for (const f of requiredOnCreate) {
          if (data[f] === undefined || data[f] === null || data[f] === '') throw new Error(`${f} est requis`);
        }
        created.push(repo.create(data));
      } catch (e) {
        errors.push({ index: i, error: e.message });
      }
    });
    if (created.length) {
      Activity.log({ kind: 'import', entity_type: entityType, summary: `Import ${created.length} ${entityType}(s)` });
    }
    res.status(201).json({ created, errors, count: created.length });
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
