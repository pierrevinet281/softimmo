// Import (CSV/XLSX upload with column mapping) and Export (CSV/XLSX/JSON).
import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { stringify } from 'csv-stringify/sync';
import { wrap, badRequest } from '../lib/errors.js';
import { Contacts, Companies, Activity } from '../db/repositories/index.js';
import { contactCompleteness, companyCompleteness, gradeContact, gradeCompany } from '../engine/scoring.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const r = Router();

function parseWorkbook(buffer, filename = '') {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return rows;
}

const CONTACT_FIELDS = [
  'first_name', 'last_name', 'full_name', 'title', 'company_name', 'company_id',
  'email', 'phone', 'extension', 'mobile',
  'linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok', 'whatsapp',
  'reddit', 'wechat', 'telegram', 'threads',
  'location', 'country', 'notes',
];
const COMPANY_FIELDS = [
  'name', 'domain', 'website', 'industry', 'sic_code', 'naics_code', 'size',
  'address', 'city', 'state', 'postal_code', 'country', 'phone',
  'linkedin', 'facebook', 'instagram', 'youtube', 'twitter',
  'description', 'notes',
];

// Guess a mapping from source columns to target fields by fuzzy name match.
function autoMap(columns, fields) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map = {};
  for (const f of fields) {
    const fn = norm(f);
    const hit = columns.find((c) => {
      const cn = norm(c);
      return cn === fn || cn.includes(fn) || fn.includes(cn)
        || (f === 'full_name' && (cn.includes('name') || cn.includes('contact')))
        || (f === 'company_name' && cn.includes('company'))
        || (f === 'linkedin' && cn.includes('linkedin'));
    });
    if (hit) map[f] = hit;
  }
  return map;
}

// POST /api/import/preview — file -> columns + sample + suggested mapping
r.post('/import/preview', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw badRequest('No file uploaded');
  const rows = parseWorkbook(req.file.buffer, req.file.originalname);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const entity = (req.query.entity === 'companies') ? 'companies' : 'contacts';
  const fields = entity === 'companies' ? COMPANY_FIELDS : CONTACT_FIELDS;
  res.json({ columns, total: rows.length, sample: rows.slice(0, 5), suggestedMapping: autoMap(columns, fields), fields });
}));

// POST /api/import — file + mapping(JSON string) + entity -> insert
r.post('/import', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw badRequest('No file uploaded');
  const entity = (req.body.entity === 'companies') ? 'companies' : 'contacts';
  let mapping = {};
  try { mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {}; }
  catch { throw badRequest('mapping must be valid JSON'); }

  const rows = parseWorkbook(req.file.buffer, req.file.originalname);
  const fields = entity === 'companies' ? COMPANY_FIELDS : CONTACT_FIELDS;
  if (!Object.keys(mapping).length) mapping = autoMap(rows.length ? Object.keys(rows[0]) : [], fields);

  let created = 0; let skipped = 0;
  for (const row of rows) {
    const rec = {};
    for (const [field, col] of Object.entries(mapping)) {
      if (!col) continue;
      const v = row[col];
      if (v !== undefined && v !== '') rec[field] = String(v).trim();
    }
    try {
      if (entity === 'companies') {
        if (!rec.name) { skipped += 1; continue; }
        const c = Companies.create({ ...rec, source: 'import', status: 'new' });
        Companies.update(c.id, { completeness: companyCompleteness(c), grade: gradeCompany(c) });
      } else {
        if (!rec.full_name && !rec.first_name && !rec.email && !rec.company_name) { skipped += 1; continue; }
        // A mapped company_id must reference a real company (FK enforced); drop if not.
        if (rec.company_id && !Companies.get(rec.company_id)) rec.company_id = null;
        const c = Contacts.create({ ...rec, source: 'import', status: 'new' });
        Contacts.update(c.id, { completeness: contactCompleteness(c), grade: gradeContact(c) });
      }
      created += 1;
    } catch (e) {
      // Never let one bad row abort the whole import.
      skipped += 1;
    }
  }
  Activity.log({ kind: 'import', summary: `Imported ${created} ${entity} (${skipped} skipped)`, meta: { file: req.file.originalname } });
  res.json({ created, skipped, total: rows.length });
}));

// GET /api/export?entity=contacts&format=csv&q=&status=
r.get('/export', wrap(async (req, res) => {
  const entity = (req.query.entity === 'companies') ? 'companies' : 'contacts';
  const format = req.query.format || 'csv';
  const repo = entity === 'companies' ? Companies : Contacts;
  const { rows } = repo.list({ q: req.query.q, status: req.query.status, limit: 100000, offset: 0 });

  const flat = rows.map((row) => {
    const o = { ...row };
    if (o.socials && typeof o.socials === 'object') o.socials = JSON.stringify(o.socials);
    return o;
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `softimmo-${entity}-${stamp}`;

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${base}.json"`);
    return res.json(flat);
  }
  if (format === 'xlsx') {
    const ws = xlsx.utils.json_to_sheet(flat);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, entity);
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    return res.send(buf);
  }
  // default CSV
  const csv = stringify(flat, { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
  res.send(csv);
}));

export default r;
