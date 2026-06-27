// Mounts CRUD routes for all Softimmo business entities + a property "bundle" endpoint
// that returns a property with all its children (for the Module 1 analysis view).
import { Router } from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { wrap, notFound, badRequest } from '../lib/errors.js';
import { runWorker } from '../services/python.js';
import config from '../lib/config.js';
import { makeCrudRouter } from './_crud.js';
import {
  Clients, Properties, Buildings, Units, Expenses, Transactions, Comparables, Reports, Documents, Activity, Settings,
  PropertyMedia,
} from '../db/repositories/index.js';
import { computeProfitability, detectAreaAnomalies } from '../engine/finance.js';
import { computeAcm } from '../engine/acm.js';
import { getAcmParams, setAcmParams, getAcmDefaults } from '../lib/acmParams.js';

// Permissive schemas: every field optional + passthrough. Required-on-create is enforced
// by the factory. Enum/type tightening can be layered later without breaking inputs.
const anyObj = z.object({}).passthrough();

const ENTITIES = [
  { path: 'clients',      repo: Clients,      type: 'client',      labelField: 'full_name', required: ['full_name'] },
  { path: 'properties',   repo: Properties,   type: 'property',    labelField: 'name',      required: [] },
  { path: 'buildings',    repo: Buildings,    type: 'building',    labelField: 'label',     required: ['property_id'] },
  { path: 'units',        repo: Units,        type: 'unit',        labelField: 'label',     required: ['property_id'] },
  { path: 'expenses',     repo: Expenses,     type: 'expense',     labelField: 'label',     required: ['property_id', 'category'] },
  { path: 'transactions', repo: Transactions, type: 'transaction', labelField: 'status',    required: ['property_id'] },
  { path: 'comparables',  repo: Comparables,  type: 'comparable',  labelField: 'address',   required: ['property_id'] },
  { path: 'reports',      repo: Reports,      type: 'report',      labelField: 'title',     required: ['property_id'] },
  { path: 'documents',    repo: Documents,    type: 'document',    labelField: 'title',     required: ['doc_type'] },
];

export default function mountBusiness(parent = Router()) {
  for (const e of ENTITIES) {
    parent.use(`/${e.path}`, makeCrudRouter({
      repo: e.repo, entityType: e.type, schema: anyObj,
      requiredOnCreate: e.required, labelField: e.labelField,
    }));
  }

  // Aggregate: a property with all its related records (Module 1 — Analyse de propriété).
  parent.get('/properties/:id/bundle', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const pid = property.id;
    res.json({
      property,
      client: property.client_id ? Clients.get(property.client_id) : null,
      buildings: Buildings.listBy('property_id', pid),
      units: Units.listBy('property_id', pid),
      expenses: Expenses.listBy('property_id', pid),
      transactions: Transactions.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      comparables: Comparables.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      reports: Reports.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      documents: Documents.listBy('property_id', pid, { sort: 'updated_at', dir: 'desc' }),
    });
  }));

  // Analyse financière déterministe (Module 1) : rentabilité + anomalies de superficie.
  // `value` (référence pour MRB/MRN/TGA/$ porte) : query ?value= sinon repli sur le prix
  // de la transaction active la plus récente (en_vigueur|inscription). `vacancy` = taux 0..1.
  parent.get('/properties/:id/analysis', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const pid = property.id;
    const buildings = Buildings.listBy('property_id', pid);
    const units = Units.listBy('property_id', pid);
    const expenses = Expenses.listBy('property_id', pid);
    const transactions = Transactions.listBy('property_id', pid, { sort: 'date', dir: 'desc' });

    let value = req.query.value !== undefined && req.query.value !== '' ? Number(req.query.value) : null;
    let valueSource = value != null ? 'manuel' : null;
    if (value == null) {
      const active = transactions.find((t) => ['en_vigueur', 'inscription'].includes(t.status) && t.price);
      if (active) { value = Number(active.price); valueSource = 'transaction active'; }
    }
    const vacancyRate = req.query.vacancy !== undefined && req.query.vacancy !== '' ? Number(req.query.vacancy) : undefined;

    const financials = computeProfitability({ units, expenses, value, vacancyRate });
    const anomalies = detectAreaAnomalies({ property, buildings, units });
    res.json({ property_id: pid, value, valueSource, financials, anomalies });
  }));

  // ── ACM / Évaluation (Module 2) ──
  // Paramètres d'ajustement (défauts éditables) : seed + override settings.
  parent.get('/acm/params', wrap(async (req, res) => {
    res.json({ params: getAcmParams(), defaults: getAcmDefaults() });
  }));
  parent.put('/acm/params', wrap(async (req, res) => {
    res.json({ params: setAcmParams(req.body || {}) });
  }));

  // Calcule l'ACM d'une propriété à partir de ses comparables enregistrés.
  // Body (optionnel) : { subject, params, asOf }. Le sujet est dérivé de la propriété + ses
  // bâtiments si non fourni. Déterministe, sans IA.
  parent.post('/properties/:id/acm', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const pid = property.id;
    const buildings = Buildings.listBy('property_id', pid);
    const comparables = Comparables.listBy('property_id', pid, { sort: 'sale_date', dir: 'desc' });

    const body = req.body || {};
    const params = getAcmParams(body.params);
    // Sujet : valeurs explicites du body sinon dérivées de la propriété et de ses bâtiments.
    const livableSum = buildings.reduce((s, b) => s + (Number(b.livable_area) || 0), 0) || null;
    const firstYear = buildings.find((b) => b.year_built)?.year_built ?? null;
    const subject = {
      living_area: livableSum,
      year_built: firstYear,
      inclusions: null,
      municipal_assessment: property.municipal_assessment ?? null,
      ...(body.subject || {}),
    };

    const result = computeAcm({ subject, comparables, params, asOf: body.asOf });
    res.json({ property_id: pid, subject, params, ...result });
  }));

  // Import d'un PDF Matrix « 4 par page courtier » → extraction (worker Python pdfplumber)
  // → création des comparables (déterministe, validation humaine ensuite dans le tableau).
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
  parent.post('/properties/:id/comparables/import-matrix', upload.single('file'), wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    if (!req.file) throw badRequest('Aucun fichier téléversé');

    const tmp = path.join(os.tmpdir(), `matrix-${Date.now()}-${Math.round(Math.random() * 1e6)}.pdf`);
    fs.writeFileSync(tmp, req.file.buffer);
    let extracted;
    try {
      const out = await runWorker('acm_matrix', { path: tmp }, { timeoutMs: 60000 });
      extracted = out.comparables || [];
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
    }

    const created = [];
    for (const c of extracted) {
      const { original_price, postal_code, ...rest } = c; // colonnes non présentes sur comparables
      created.push(Comparables.create({ ...rest, property_id: property.id, seller_redacted: 1 }));
    }
    Activity.log({ kind: 'import', entity_type: 'comparable', entity_id: property.id, summary: `Import Matrix : ${created.length} comparable(s)` });
    res.status(201).json({ count: created.length, comparables: created });
  }));

  // ── Module 4 : brochure PDF (moteur render/, ReportLab, déterministe) ──
  const GENRE_LABEL = {
    unifamilial: 'Maison à vendre', condo: 'Condo à vendre', plex: 'Plex à vendre',
    multi: 'Multi-logements à vendre', commercial: 'Commercial à vendre',
    industriel: 'Industriel à vendre', terrain: 'Terrain à vendre', rpa: 'RPA à vendre', autre: 'À vendre',
  };
  const fmtArea = (v) => (v != null && v !== '' ? `${Number(v).toLocaleString('fr-CA', { maximumFractionDigits: 2 })} pc` : '');

  function buildBrochureData(bundle) {
    const p = bundle.property;
    const b = (bundle.buildings || [])[0] || {};
    const units = bundle.units || [];
    const beds = units.reduce((s, u) => s + (Number(u.bedrooms) || 0), 0) || null;
    const baths = units.reduce((s, u) => s + (Number(u.bathrooms) || 0), 0) || null;
    const tx = (bundle.transactions || []).find((t) => ['inscription', 'en_vigueur'].includes(t.status) && t.price);
    const broker = Settings.get('broker_profile', null) || {
      name: 'Pierre Vinet', title: 'Courtier Immobilier', subtitle: 'Résidentiel et Commercial',
      agency: 'eXp Agence Immobilière', company: 'Immobilier Pierre Vinet Inc.', phone: '514.651.7437',
      email: 'pierre.vinet@exprealty.com', web: 'www.pierrevinet.com',
    };
    const cityProv = [p.city, p.province].filter(Boolean).join(' (') + (p.province ? ')' : '');
    const summary = [beds ? `${beds} chambres` : null, baths ? `${baths} salles de bain` : null]
      .filter(Boolean).join(' + ') + (b.livable_area ? ` (${Math.round(b.livable_area)} pi²)` : '');
    // Photos téléversées → images de la brochure (rôles hero/map/interior ; gallery en repli).
    const media = bundle.media || [];
    const byRole = (r) => media.filter((m) => m.role === r).map((m) => m.file_path).filter(Boolean);
    const gallery = byRole('gallery');
    const hero = byRole('hero')[0] || gallery[0] || null;
    const map = byRole('map')[0] || null;
    const interior = [...byRole('interior'), ...gallery.filter((g) => g !== hero)].slice(0, 3);
    return {
      images: { hero, map },
      interior,
      listing_url: p.brochure_qr_url || null,
      title: GENRE_LABEL[p.genre] || GENRE_LABEL.autre,
      city: cityProv,
      summary_line: summary,
      address: [p.address, p.city, p.province, p.postal_code].filter(Boolean).join(', ').toUpperCase(),
      mls: p.mls_number || '',
      price: tx ? Number(tx.price) : null,
      specs_left: [
        ['Type de propriété', GENRE_LABEL[p.genre]?.replace(' à vendre', '') || p.genre],
        ['Année de construction', b.year_built || ''],
        ['Nombre de pièces', units.length || ''],
        ['Nombre de chambres', beds || ''],
        ['Nombre salles de bain', baths || ''],
      ],
      specs_right: [
        ['Surface habitable', fmtArea(b.livable_area)],
        ['Surface du terrain', fmtArea(b.land_area)],
        ['Structure', b.structure || ''],
        ['Revêtement', b.exterior_cladding || ''],
        ['Zonage', p.zoning || ''],
      ],
      broker,
      headline: p.name || (GENRE_LABEL[p.genre] || ''),
      description: p.summary || '',
      rooms: units.map((u) => [u.label || u.unit_type || '—', '', u.area ? `${u.area} pi²` : '']),
    };
  }

  // Modèles de brochure disponibles (le courtier DOIT en choisir un — voir UI).
  const BROCHURE_TEMPLATES = ['unifamilial', 'luxe'];
  parent.get('/properties/:id/brochure.pdf', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const template = String(req.query.template || 'unifamilial');
    if (template === 'rpa') throw badRequest('Le modèle « Résidence pour aînés » arrive bientôt.');
    if (!BROCHURE_TEMPLATES.includes(template)) throw badRequest(`Modèle inconnu : ${template}`);
    const pid = property.id;
    const bundle = {
      property,
      buildings: Buildings.listBy('property_id', pid),
      units: Units.listBy('property_id', pid),
      transactions: Transactions.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      media: PropertyMedia.listBy('property_id', pid, { sort: 'position', dir: 'asc' }),
    };
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `brochure-${pid}-${Date.now()}.pdf`);
    await runWorker('render_brochure', { data: { ...buildBrochureData(bundle), template }, out }, { timeoutMs: 60000 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="brochure-${pid}.pdf"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }));

  // Jumeau PowerPoint éditable (mêmes coordonnées que le PDF — round-trip, docs/09).
  parent.get('/properties/:id/brochure.pptx', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const template = String(req.query.template || 'unifamilial');
    if (template === 'rpa') throw badRequest('Le modèle « Résidence pour aînés » arrive bientôt.');
    if (!BROCHURE_TEMPLATES.includes(template)) throw badRequest(`Modèle inconnu : ${template}`);
    const pid = property.id;
    const bundle = {
      property,
      buildings: Buildings.listBy('property_id', pid),
      units: Units.listBy('property_id', pid),
      transactions: Transactions.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      media: PropertyMedia.listBy('property_id', pid, { sort: 'position', dir: 'asc' }),
    };
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `brochure-${pid}-${Date.now()}.pptx`);
    await runWorker('render_brochure_pptx', { data: { ...buildBrochureData(bundle), template }, out }, { timeoutMs: 60000 });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="brochure-${pid}.pptx"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }));

  // ── Photos de propriété (téléversement + rôles pour la brochure) ──
  const PHOTO_ROLES = ['hero', 'map', 'interior', 'gallery'];
  const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  const mediaOut = (m) => ({ ...m, url: `/properties/${m.property_id}/photos/${m.id}/raw` });

  parent.get('/properties/:id/photos', wrap(async (req, res) => {
    if (!Properties.get(req.params.id)) throw notFound('property introuvable');
    res.json(PropertyMedia.listBy('property_id', req.params.id, { sort: 'position', dir: 'asc' }).map(mediaOut));
  }));

  parent.post('/properties/:id/photos', upload.array('files', 30), wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const files = req.files || [];
    if (!files.length) throw badRequest('Aucune image téléversée');
    const role = PHOTO_ROLES.includes(req.body?.role) ? req.body.role : 'gallery';
    const dir = path.join(config.root, 'data', 'uploads', 'properties', property.id);
    fs.mkdirSync(dir, { recursive: true });
    const base = PropertyMedia.listBy('property_id', property.id).length;
    const created = [];
    files.forEach((f, i) => {
      if (!String(f.mimetype || '').startsWith('image/')) return;
      const id = `media_${Date.now()}_${i}`;
      const dest = path.join(dir, `${id}${EXT[f.mimetype] || '.img'}`);
      fs.writeFileSync(dest, f.buffer);
      created.push(PropertyMedia.create({
        id, property_id: property.id, role, position: base + i, file_path: dest,
        filename: f.originalname || null, mime: f.mimetype || null,
      }));
    });
    if (!created.length) throw badRequest('Format non supporté (images uniquement)');
    res.status(201).json(created.map(mediaOut));
  }));

  parent.patch('/properties/:id/photos/:mediaId', wrap(async (req, res) => {
    const m = PropertyMedia.get(req.params.mediaId);
    if (!m || m.property_id !== req.params.id) throw notFound('photo introuvable');
    const patch = {};
    if (req.body?.role !== undefined) {
      if (!PHOTO_ROLES.includes(req.body.role)) throw badRequest(`Rôle inconnu : ${req.body.role}`);
      patch.role = req.body.role;
    }
    if (req.body?.position !== undefined) patch.position = Number(req.body.position) || 0;
    res.json(mediaOut(PropertyMedia.update(req.params.mediaId, patch)));
  }));

  parent.delete('/properties/:id/photos/:mediaId', wrap(async (req, res) => {
    const m = PropertyMedia.get(req.params.mediaId);
    if (!m || m.property_id !== req.params.id) throw notFound('photo introuvable');
    try { if (m.file_path) fs.unlinkSync(m.file_path); } catch { /* ignore */ }
    PropertyMedia.delete(req.params.mediaId);
    res.status(204).end();
  }));

  parent.get('/properties/:id/photos/:mediaId/raw', wrap(async (req, res) => {
    const m = PropertyMedia.get(req.params.mediaId);
    if (!m || m.property_id !== req.params.id || !m.file_path || !fs.existsSync(m.file_path)) throw notFound('photo introuvable');
    if (m.mime) res.setHeader('Content-Type', m.mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.sendFile(m.file_path, (err) => { if (err && !res.headersSent) res.status(500).end(); });
  }));

  // ── Stats APCIQ (ratios vente/inscrit & vente/éval) ──
  // Le PDF « STATS_MUNGENRE » couvre toutes les régions pour une période : il est conservé
  // et réutilisable pour plusieurs propriétés. Le courtier peut : utiliser le fichier en
  // mémoire, en téléverser un nouveau, ou saisir les ratios manuellement.
  const STATS_KEY = 'acm_stats_file';
  parent.get('/acm/stats/file', wrap(async (req, res) => {
    const f = Settings.get(STATS_KEY, null);
    res.json(f ? { filename: f.filename, uploaded_at: f.uploaded_at } : null);
  }));
  parent.post('/acm/stats/upload', upload.single('file'), wrap(async (req, res) => {
    if (!req.file) throw badRequest('Aucun fichier téléversé');
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `acm-stats-${Date.now()}.pdf`);
    fs.writeFileSync(dest, req.file.buffer);
    const info = { path: dest, filename: req.file.originalname, uploaded_at: new Date().toISOString() };
    Settings.set(STATS_KEY, info);
    res.status(201).json({ filename: info.filename, uploaded_at: info.uploaded_at });
  }));
  parent.post('/acm/stats/lookup', wrap(async (req, res) => {
    const f = Settings.get(STATS_KEY, null);
    if (!f?.path || !fs.existsSync(f.path)) throw badRequest('Aucun fichier de statistiques en mémoire. Téléversez-en un.');
    const { municipality, genre } = req.body || {};
    if (!municipality) throw badRequest('municipality requis');
    const out = await runWorker('acm_stats', { path: f.path, municipality, genre: genre || 'unifamilial' }, { timeoutMs: 60000 });
    res.json(out);
  }));

  return parent;
}
