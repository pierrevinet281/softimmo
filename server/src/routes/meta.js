import { Router } from 'express';
import { wrap } from '../lib/errors.js';
import { getDb } from '../db/index.js';
import { Companies, Contacts, Jobs, Activity, Reference } from '../db/repositories/index.js';
import { pythonHealth } from '../services/python.js';
import { isAiEnabled } from '../engine/ai/index.js';

const r = Router();

r.get('/health', wrap(async (req, res) => {
  const py = await pythonHealth();
  res.json({ ok: true, python: py, ai: isAiEnabled(), time: new Date().toISOString() });
}));

r.get('/stats', wrap(async (req, res) => {
  const db = getDb();
  const contactsByStatus = db.prepare("SELECT status, COUNT(*) n FROM contacts GROUP BY status").all();
  const contactsByEmail = db.prepare("SELECT COALESCE(email_status,'none') s, COUNT(*) n FROM contacts GROUP BY s").all();
  const contactsByGrade = db.prepare("SELECT COALESCE(grade,'?') g, COUNT(*) n FROM contacts GROUP BY g").all();
  const bySource = db.prepare("SELECT COALESCE(source,'manual') s, COUNT(*) n FROM contacts GROUP BY s ORDER BY n DESC LIMIT 8").all();
  const withEmail = db.prepare("SELECT COUNT(*) n FROM contacts WHERE email IS NOT NULL AND email <> ''").get().n;
  const withPhone = db.prepare("SELECT COUNT(*) n FROM contacts WHERE phone IS NOT NULL AND phone <> ''").get().n;
  res.json({
    companies: Companies.count(),
    contacts: Contacts.count(),
    withEmail,
    withPhone,
    contactsByStatus,
    contactsByEmail,
    contactsByGrade,
    bySource,
    activeJobs: Jobs.list({ status: 'running' }).total + Jobs.list({ status: 'queued' }).total,
  });
}));

r.get('/activity', wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  res.json({ rows: Activity.recent({ limit }) });
}));

r.get('/reference/:category', wrap(async (req, res) => {
  res.json({ category: req.params.category, values: Reference.entries(req.params.category) });
}));

export default r;
