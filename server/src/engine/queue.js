// In-process, SQLite-backed job queue. Jobs + items are persisted so progress
// survives restarts. A single async loop pulls queued items and processes them by
// type. No external broker (no Redis) → zero infra cost.
import { Jobs, Contacts, Companies, Activity } from '../db/repositories/index.js';
import { enrichContact, enrichCompany } from './waterfall.js';
import { discoverContact, discoverCompanies } from './discover.js';
import { applyContactResult, applyCompanyResult } from './apply.js';
import { verifyEmails, parsePhones } from './workers.js';
import { gradeContact } from './scoring.js';
import logger from '../lib/logger.js';

let running = false;
const liveJobs = new Set(); // job ids currently being processed

export function enqueue(type, params = {}, items = []) {
  const job = Jobs.create({ type, params, total: items.length });
  for (const it of items) {
    Jobs.addItem({ job_id: job.id, entity_type: it.entity_type || null, entity_id: it.entity_id || null, input: it.input || {} });
  }
  Activity.log({ kind: 'job', summary: `Queued ${type} job (${items.length} items)`, meta: { job_id: job.id, type } });
  tick();
  return job;
}

// ── item processors ────────────────────────────────────────────────────
async function processEnrich(item, params) {
  if (item.entity_type === 'company') {
    const company = Companies.get(item.entity_id);
    if (!company) throw new Error('company not found');
    const result = await enrichCompany(company, params);
    applyCompanyResult(company, result, { overwrite: params.overwrite });
    return { log: result.log, confidence: result.confidence };
  }
  const contact = Contacts.get(item.entity_id);
  if (!contact) throw new Error('contact not found');
  const result = await enrichContact(contact, params);
  applyContactResult(contact, result, { overwrite: params.overwrite });
  return { log: result.log, confidence: result.confidence };
}

async function processVerify(item, params) {
  const contact = Contacts.get(item.entity_id);
  if (!contact) throw new Error('contact not found');
  const log = [];
  const patch = {};
  if (contact.email) {
    const vr = await verifyEmails([contact.email], { smtp: params.smtp });
    const r = vr.results?.[0];
    patch.email_status = r?.status || 'unknown';
    log.push(`email ${contact.email} -> ${patch.email_status} (${r?.reason || ''})`);
  } else { log.push('no email to verify'); }
  if (contact.phone) {
    const pr = await parsePhones([{ value: contact.phone, region: params.region || 'US' }]);
    const p = pr.results?.[0];
    if (p?.valid) { patch.phone = p.e164; patch.phone_type = p.type; log.push(`phone -> ${p.e164} (${p.type})`); }
    else log.push(`phone invalid: ${contact.phone}`);
  }
  const merged = { ...contact, ...patch };
  patch.grade = gradeContact(merged);
  if (merged.status !== 'new') patch.status = 'verified';
  Contacts.update(contact.id, patch);
  return { log };
}

async function processDiscover(item, params) {
  if (params.mode === 'company') {
    const created = await discoverCompanies(item.input, params);
    return { log: created.log, created: created.ids };
  }
  const created = await discoverContact(item.input, params);
  return { log: created.log, created: created.id ? [created.id] : [] };
}

const PROCESSORS = { enrich: processEnrich, verify: processVerify, discover: processDiscover };

// ── worker loop ────────────────────────────────────────────────────────
async function runJob(job) {
  if (liveJobs.has(job.id)) return;
  liveJobs.add(job.id);
  Jobs.update(job.id, { status: 'running', started_at: new Date().toISOString() });
  const processor = PROCESSORS[job.type];
  try {
    if (!processor) throw new Error(`unknown job type: ${job.type}`);
    let item;
    // Always re-read params (settings may differ) and process sequentially to stay polite.
    while ((item = Jobs.nextQueuedItem(job.id))) {
      const fresh = Jobs.get(job.id);
      if (fresh.status === 'paused' || fresh.status === 'canceled') break;
      Jobs.updateItem(item.id, { status: 'running', attempts: (item.attempts || 0) + 1 });
      try {
        const out = await processor(item, job.params || {});
        Jobs.updateItem(item.id, { status: 'done', result: out, log: (out.log || []).join('\n') });
      } catch (e) {
        Jobs.updateItem(item.id, { status: 'error', log: String(e.message), result: { error: e.message } });
        logger.warn(`job ${job.id} item ${item.id} failed:`, e.message);
      }
      Jobs.recomputeProgress(job.id);
    }
    const finalJob = Jobs.get(job.id);
    if (finalJob.status !== 'paused' && finalJob.status !== 'canceled') {
      Jobs.update(job.id, { status: 'done', finished_at: new Date().toISOString(), progress: 1 });
      Activity.log({ kind: 'job', summary: `Finished ${job.type} job`, meta: { job_id: job.id, succeeded: finalJob.succeeded, failed: finalJob.failed } });
    }
  } catch (e) {
    Jobs.update(job.id, { status: 'error', error: e.message, finished_at: new Date().toISOString() });
    logger.error(`job ${job.id} failed:`, e.message);
  } finally {
    liveJobs.delete(job.id);
  }
}

// Process all resumable jobs, one at a time globally (keeps load + politeness sane).
export async function tick() {
  if (running) return;
  running = true;
  try {
    let jobs = Jobs.resumable();
    while (jobs.length) {
      for (const job of jobs) {
        if (job.status === 'queued' || job.status === 'running') await runJob(job);
      }
      jobs = Jobs.resumable().filter((j) => !liveJobs.has(j.id));
    }
  } finally {
    running = false;
  }
}

export function startQueue() {
  logger.info('Job queue started.');
  tick(); // resume anything left over from a previous run
}

export default { enqueue, tick, startQueue };
