// Central configuration loader. Reads .env (if present) then process.env, with sane
// defaults so the app runs out-of-the-box for a single local user.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// repo root = server/src/lib -> ../../../
const ROOT = path.resolve(__dirname, '../../../');

dotenv.config({ path: path.join(ROOT, '.env') });

const bool = (v, d = false) =>
  v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
const int = (v, d) => (v === undefined || v === '' ? d : parseInt(v, 10));

const defaultPython = process.platform === 'win32'
  ? 'python/.venv/Scripts/python.exe'
  : 'python/.venv/bin/python';

export const config = {
  root: ROOT,
  port: int(process.env.PORT, 8787),
  host: process.env.HOST || '127.0.0.1',
  env: process.env.NODE_ENV || 'development',

  dbPath: path.resolve(ROOT, process.env.DB_PATH || './data/softimmo.db'),
  pythonBin: path.resolve(ROOT, process.env.PYTHON_BIN || defaultPython),
  pythonDir: path.join(ROOT, 'server', 'python'),

  crawl: {
    concurrency: int(process.env.CRAWL_CONCURRENCY, 4),
    perDomainDelayMs: int(process.env.CRAWL_PER_DOMAIN_DELAY_MS, 1500),
    timeoutMs: int(process.env.CRAWL_TIMEOUT_MS, 15000),
    userAgent: process.env.CRAWL_USER_AGENT || 'SoftimmoBot/0.1 (+local research tool)',
    respectRobots: bool(process.env.RESPECT_ROBOTS, false),
    smtpProbe: bool(process.env.SMTP_PROBE_ENABLED, false),
  },

  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-opus-4-8',
    enabled: bool(process.env.AI_ENABLED, false),
    maxTokens: int(process.env.AI_MAX_TOKENS, 1024),
  },

  search: {
    googleCseKey: process.env.GOOGLE_CSE_KEY || '',
    googleCseCx: process.env.GOOGLE_CSE_CX || '',
  },
};

// Ensure data dir exists.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export default config;
