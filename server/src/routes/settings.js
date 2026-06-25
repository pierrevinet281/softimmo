// Settings: AI config (+ key), crawl politeness, search keys, theme. Secrets are
// stored locally and returned MASKED to the client.
import { Router } from 'express';
import { wrap } from '../lib/errors.js';
import { Settings } from '../db/repositories/index.js';

const r = Router();

const mask = (v) => (typeof v === 'string' && v.length > 4 ? `••••${v.slice(-4)}` : (v ? '••••' : ''));

function publicView() {
  const ai = Settings.get('ai', {}) || {};
  const crawl = Settings.get('crawl', {}) || {};
  const search = Settings.get('search', {}) || {};
  return {
    ai: { enabled: !!ai.enabled, model: ai.model || 'claude-opus-4-8', maxTokens: ai.maxTokens || 1024, apiKeySet: !!ai.apiKey, apiKeyMasked: mask(ai.apiKey) },
    crawl: {
      concurrency: crawl.concurrency ?? 4,
      perDomainDelayMs: crawl.perDomainDelayMs ?? 1500,
      respectRobots: !!crawl.respectRobots,
      smtpProbe: !!crawl.smtpProbe,
    },
    search: { cseKeySet: !!search.cseKey, cseKeyMasked: mask(search.cseKey), cseCx: search.cseCx || '', searxUrl: search.searxUrl || '', engines: search.engines || null },
    theme: Settings.get('theme', 'light'),
  };
}

r.get('/', wrap(async (req, res) => res.json(publicView())));

r.put('/', wrap(async (req, res) => {
  const body = req.body || {};

  if (body.ai) {
    const cur = Settings.get('ai', {}) || {};
    const next = { ...cur };
    if (body.ai.enabled !== undefined) next.enabled = !!body.ai.enabled;
    if (body.ai.model) next.model = body.ai.model;
    if (body.ai.maxTokens) next.maxTokens = parseInt(body.ai.maxTokens, 10);
    // Only overwrite the key when a non-masked value is provided.
    if (typeof body.ai.apiKey === 'string' && body.ai.apiKey && !body.ai.apiKey.startsWith('••••')) next.apiKey = body.ai.apiKey.trim();
    if (body.ai.apiKey === '') next.apiKey = '';
    Settings.set('ai', next);
  }

  if (body.crawl) {
    const cur = Settings.get('crawl', {}) || {};
    Settings.set('crawl', {
      ...cur,
      concurrency: body.crawl.concurrency ?? cur.concurrency ?? 4,
      perDomainDelayMs: body.crawl.perDomainDelayMs ?? cur.perDomainDelayMs ?? 1500,
      respectRobots: body.crawl.respectRobots ?? cur.respectRobots ?? false,
      smtpProbe: body.crawl.smtpProbe ?? cur.smtpProbe ?? false,
    });
  }

  if (body.search) {
    const cur = Settings.get('search', {}) || {};
    const next = { ...cur };
    if (typeof body.search.cseKey === 'string' && body.search.cseKey && !body.search.cseKey.startsWith('••••')) next.cseKey = body.search.cseKey.trim();
    if (body.search.cseKey === '') next.cseKey = '';
    if (body.search.cseCx !== undefined) next.cseCx = body.search.cseCx;
    if (body.search.searxUrl !== undefined) next.searxUrl = body.search.searxUrl;
    if (body.search.engines !== undefined) next.engines = body.search.engines;
    Settings.set('search', next);
  }

  if (body.theme) Settings.set('theme', body.theme);

  res.json(publicView());
}));

export default r;
