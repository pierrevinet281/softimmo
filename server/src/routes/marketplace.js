import { Router } from 'express';
import { z } from 'zod';
import { wrap, notFound } from '../lib/errors.js';
import { Providers, Activity } from '../db/repositories/index.js';

const r = Router();

// GET /api/providers  -> all marketplace cards, grouped client-side by category.
r.get('/', wrap(async (req, res) => {
  const all = Providers.all();
  const categories = [...new Set(all.flatMap((p) => p.categories))].sort();
  res.json({ rows: all, categories });
}));

r.get('/:slug', wrap(async (req, res) => {
  const p = Providers.get(req.params.slug);
  if (!p) throw notFound('Provider not found');
  res.json(p);
}));

// Connect: store credentials locally (kept on this machine only).
r.post('/:slug/connect', wrap(async (req, res) => {
  const p = Providers.get(req.params.slug);
  if (!p) throw notFound('Provider not found');
  const schema = z.object({ credentials: z.record(z.any()).optional(), config: z.record(z.any()).optional() });
  const { credentials = {}, config = {} } = schema.parse(req.body || {});
  Providers.connect(req.params.slug, { credentials, config });
  Activity.log({ kind: 'connect', summary: `Connected provider ${p.name}`, meta: { slug: p.slug } });
  res.json(Providers.get(req.params.slug));
}));

r.post('/:slug/disconnect', wrap(async (req, res) => {
  const p = Providers.get(req.params.slug);
  if (!p) throw notFound('Provider not found');
  Providers.disconnect(req.params.slug);
  Activity.log({ kind: 'connect', summary: `Disconnected provider ${p.name}`, meta: { slug: p.slug } });
  res.json({ ok: true });
}));

export default r;
