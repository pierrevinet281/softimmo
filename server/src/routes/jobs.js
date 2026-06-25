import { Router } from 'express';
import { wrap, notFound } from '../lib/errors.js';
import { Jobs } from '../db/repositories/index.js';
import { tick } from '../engine/queue.js';

const r = Router();

r.get('/', wrap(async (req, res) => {
  const { type, status, limit, offset } = req.query;
  res.json(Jobs.list({ type, status, limit: Math.min(parseInt(limit || '50', 10), 200), offset: parseInt(offset || '0', 10) }));
}));

r.get('/:id', wrap(async (req, res) => {
  const job = Jobs.get(req.params.id);
  if (!job) throw notFound('Job not found');
  res.json(job);
}));

r.get('/:id/items', wrap(async (req, res) => {
  if (!Jobs.get(req.params.id)) throw notFound('Job not found');
  res.json({ rows: Jobs.items(req.params.id) });
}));

r.post('/:id/pause', wrap(async (req, res) => {
  if (!Jobs.get(req.params.id)) throw notFound('Job not found');
  res.json(Jobs.update(req.params.id, { status: 'paused' }));
}));

r.post('/:id/resume', wrap(async (req, res) => {
  const job = Jobs.get(req.params.id);
  if (!job) throw notFound('Job not found');
  Jobs.update(req.params.id, { status: 'queued' });
  tick();
  res.json(Jobs.get(req.params.id));
}));

r.post('/:id/cancel', wrap(async (req, res) => {
  if (!Jobs.get(req.params.id)) throw notFound('Job not found');
  res.json(Jobs.update(req.params.id, { status: 'canceled', finished_at: new Date().toISOString() }));
}));

export default r;
