// Per-domain polite rate limiting + global concurrency gate for outbound crawling.
import config from '../lib/config.js';

const lastHit = new Map(); // domain -> timestamp ms

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'unknown'; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait until it's polite to hit this URL's domain again.
export async function waitForDomain(url, perDomainDelayMs = config.crawl.perDomainDelayMs) {
  const d = domainOf(url);
  const now = Date.now();
  const last = lastHit.get(d) || 0;
  const wait = Math.max(0, last + perDomainDelayMs - now);
  if (wait > 0) await sleep(wait);
  lastHit.set(d, Date.now());
}

// Simple concurrency limiter (semaphore).
export function createLimiter(max = config.crawl.concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => { active -= 1; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

export default { waitForDomain, createLimiter };
