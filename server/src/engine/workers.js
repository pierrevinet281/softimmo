// Thin wrappers around the Python workers that inject DB-sourced reference data
// and runtime settings (search keys, crawl politeness, SMTP toggle). Keeps the
// Python workers pure (no DB access) while honoring "no hardcoded data".
import { runWorker } from '../services/python.js';
import { Reference, Settings } from '../db/repositories/index.js';
import config from '../lib/config.js';

function crawlSettings() {
  const s = Settings.get('crawl', {}) || {};
  return {
    smtpProbe: s.smtpProbe ?? config.crawl.smtpProbe,
    timeoutMs: config.crawl.timeoutMs,
  };
}

function searchKeys() {
  const s = Settings.get('search', {}) || {};
  return {
    cse_key: s.cseKey || config.search.googleCseKey || undefined,
    cse_cx: s.cseCx || config.search.googleCseCx || undefined,
    searx_url: s.searxUrl || undefined,
    engines: s.engines || undefined,
  };
}

export async function search(queries, { limit = 8 } = {}) {
  const payload = { queries: Array.isArray(queries) ? queries : [queries], limit, ...searchKeys() };
  return runWorker('search', payload, { timeoutMs: 90000 });
}

export async function extract(urls, { maxChars = 4000 } = {}) {
  const c = crawlSettings();
  return runWorker('extract', {
    urls: Array.isArray(urls) ? urls : [urls],
    max_chars: maxChars,
    timeout: Math.round(c.timeoutMs / 1000),
  }, { timeoutMs: 120000 });
}

export async function verifyEmails(emails, { smtp } = {}) {
  const c = crawlSettings();
  return runWorker('verify_email', {
    emails: Array.isArray(emails) ? emails : [emails],
    smtp: smtp ?? c.smtpProbe,
    disposable: Reference.values('disposable_domain'),
    free: Reference.values('free_provider'),
    role: Reference.values('role_local'),
  }, { timeoutMs: 120000 });
}

export async function parsePhones(phones, { defaultRegion = 'US' } = {}) {
  return runWorker('phone', {
    phones: Array.isArray(phones) ? phones : [phones],
    default_region: defaultRegion,
  }, { timeoutMs: 30000 });
}

export default { search, extract, verifyEmails, parsePhones };
