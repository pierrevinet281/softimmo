// Seed: loads ALL data from JSON seed files into the DB (no hardcoded data in code).
//   - seeds/reference.seed.json   → reference_data (engine lists)
//   - seeds/marketplace.seed.json → providers (marketplace catalog)
//   - seeds/demo.seed.json        → demo companies/contacts (only with --demo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, getDb } from './index.js';
import { Providers, Companies, Contacts, Settings, Reference } from './repositories/index.js';
import { contactCompleteness, companyCompleteness, gradeContact, gradeCompany } from '../engine/scoring.js';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = path.join(__dirname, 'seeds');
const readSeed = (name) => JSON.parse(fs.readFileSync(path.join(SEEDS, name), 'utf8'));

export function seedReference() {
  const data = readSeed('reference.seed.json');
  let n = 0;
  for (const [category, items] of Object.entries(data)) {
    Reference.upsertMany(category, items);
    n += items.length;
  }
  logger.ok(`Seeded ${n} reference rows across ${Object.keys(data).length} categories.`);
}

export function seedProviders() {
  const list = readSeed('marketplace.seed.json');
  for (const p of list) Providers.upsert(p);
  logger.ok(`Seeded ${list.length} marketplace providers.`);
}

export function seedDefaults() {
  if (Settings.get('ai') == null) Settings.set('ai', { enabled: false, model: 'claude-opus-4-8', maxTokens: 1024 });
  if (Settings.get('crawl') == null) Settings.set('crawl', { concurrency: 4, perDomainDelayMs: 1500, respectRobots: false, smtpProbe: false });
  if (Settings.get('theme') == null) Settings.set('theme', 'light');
}

export function seedDemo() {
  const db = getDb();
  if (db.prepare('SELECT COUNT(*) n FROM companies').get().n > 0) {
    logger.info('Demo skip: data already present.');
    return;
  }
  const data = readSeed('demo.seed.json');
  const byRef = {};
  for (const c of data.companies || []) {
    const { ref, ...fields } = c;
    const created = Companies.create(fields);
    Companies.update(created.id, { completeness: companyCompleteness(created), grade: gradeCompany(created) });
    if (ref) byRef[ref] = created;
  }
  for (const ct of data.contacts || []) {
    const { company_ref, ...fields } = ct;
    const company = company_ref ? byRef[company_ref] : null;
    const created = Contacts.create({ ...fields, company_id: company?.id ?? null, company_name: company?.name ?? fields.company_name ?? null });
    Contacts.update(created.id, { completeness: contactCompleteness(created), grade: gradeContact(created) });
  }
  logger.ok(`Seeded demo: ${(data.companies || []).length} companies, ${(data.contacts || []).length} contacts.`);
}

export function runSeed({ demo = false } = {}) {
  migrate();
  seedReference();
  seedProviders();
  seedDefaults();
  if (demo) seedDemo();
}

if (process.argv[1]?.endsWith('seed.js')) {
  runSeed({ demo: process.argv.includes('--demo') });
  process.exit(0);
}
