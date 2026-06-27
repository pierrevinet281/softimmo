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
  PropertyMedia, BrokerAssets,
} from '../db/repositories/index.js';
import { computeProfitability, detectAreaAnomalies } from '../engine/finance.js';
import { computeAcm } from '../engine/acm.js';
import { buildMarketingCopy } from '../engine/marketingCopy.js';
import { buildOffreData, OFFRE_VARIANTS, OFFRE_LANGS, resolveOffreContent, applyOfferDiff } from '../engine/offre.js';
import { buildRpaData, imagesFromMedia } from '../engine/rpaBrochure.js';
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
  { path: 'broker-assets', repo: BrokerAssets, type: 'broker_asset', labelField: 'name',     required: ['name'] },
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
  const BROCHURE_TEMPLATES = ['unifamilial', 'luxe', 'rpa', 'commercial', 'industriel'];

  // Présentation PERSONNALISÉE d'une propriété (surcharge layout propre à cette propriété,
  // sans incidence sur le modèle). Stockée dans `documents` (doc_type='brochure').
  const getPresentation = (pid, tpl) =>
    (Documents.listBy('property_id', pid) || []).find((doc) => doc.doc_type === 'brochure' && doc.template === tpl) || null;
  const CONTENT_FIELDS = ['title', 'city', 'summary_line', 'address', 'mls', 'headline', 'description', 'price_text', 'rooms'];
  function brochureRenderData(bundle, template) {
    const data = { ...buildBrochureData(bundle), template };
    const pres = getPresentation(bundle.property.id, template);
    if (pres && pres.data) {
      const c = pres.data.content;  // surcharge CONTENU (texte + images édités dans le PPTX)
      if (c) {
        for (const k of CONTENT_FIELDS) if (c[k] !== undefined && c[k] !== null && c[k] !== '') data[k] = c[k];
        if (c.images) data.images = { ...(data.images || {}), ...c.images };           // photo + carte remplacées
        if (c.interior) data.interior = c.interior;                                     // intérieurs (positionnel)
        if (c.broker_photo) data.broker = { ...(data.broker || {}), photo: c.broker_photo };
      }
      if (pres.data.layout) data.layout = pres.data.layout;  // surcharge DISPOSITION
    }
    return data;
  }
  parent.get('/properties/:id/brochure.pdf', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const template = String(req.query.template || 'unifamilial');
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
    if (template === 'rpa') {
      // RPA : format éditorial distinct (render_rpa_brochure) — défauts + surcharge propriété + photos.
      const pres = getPresentation(pid, 'rpa');
      const data = buildRpaData({
        broker: defaultBroker(),
        contentOverride: pres?.data?.content || null,
        images: imagesFromMedia(bundle.media),
      });
      await runWorker('render_rpa_brochure', { data, out }, { timeoutMs: 60000 });
    } else {
      await runWorker('render_brochure', { data: brochureRenderData(bundle, template), out }, { timeoutMs: 60000 });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="brochure-${pid}.pdf"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }));

  // Jumeau PowerPoint éditable (mêmes coordonnées que le PDF — round-trip, docs/09).
  parent.get('/properties/:id/brochure.pptx', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const template = String(req.query.template || 'unifamilial');
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
    await runWorker('render_brochure_pptx', { data: brochureRenderData(bundle, template), out }, { timeoutMs: 60000 });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="brochure-${pid}.pptx"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }));

  // ── Annonces texte (Module 4 — déterministe, sans IA) : Kijiji, FB, Marketplace, IG, X, LinkedIn ──
  const defaultBroker = () => Settings.get('broker_profile', null) || {
    name: 'Pierre Vinet', title: 'Courtier Immobilier', subtitle: 'Résidentiel et Commercial',
    agency: 'eXp Agence Immobilière', company: 'Immobilier Pierre Vinet Inc.', phone: '514.651.7437',
    email: 'pierre.vinet@exprealty.com', web: 'www.pierrevinet.com',
  };
  parent.get('/properties/:id/marketing-copy', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const pid = property.id;
    const bundle = {
      property, broker: defaultBroker(),
      buildings: Buildings.listBy('property_id', pid),
      units: Units.listBy('property_id', pid),
      transactions: Transactions.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
    };
    res.json(buildMarketingCopy(bundle, { lang: req.query.lang, emoji: req.query.emoji === 'true' }));
  }));

  // ── Mise en page des modèles de brochure (round-trip PowerPoint, docs/09) ──
  // Le courtier édite un gabarit PPTX puis le téléverse : on en extrait les positions
  // (pptx_to_layout) vers server/python/layouts/<template>.json, lu ensuite par les moteurs.
  const layoutPath = (tpl) => path.join(config.pythonDir, 'layouts', `${tpl}.json`);

  parent.get('/brochure/templates/:template/layout', wrap(async (req, res) => {
    const tpl = String(req.params.template);
    if (!BROCHURE_TEMPLATES.includes(tpl)) throw badRequest(`Modèle inconnu : ${tpl}`);
    const p = layoutPath(tpl);
    if (!fs.existsSync(p)) return res.json({ customized: false, roles: [] });
    let roles = [];
    try { roles = Object.keys(JSON.parse(fs.readFileSync(p, 'utf-8'))); } catch { /* ignore */ }
    res.json({ customized: true, roles });
  }));

  parent.post('/brochure/templates/:template/layout', upload.single('file'), wrap(async (req, res) => {
    const tpl = String(req.params.template);
    if (!BROCHURE_TEMPLATES.includes(tpl)) throw badRequest(`Modèle inconnu : ${tpl}`);
    if (!req.file) throw badRequest('Aucun fichier PowerPoint téléversé');
    if (!/\.pptx$/i.test(req.file.originalname || '')) throw badRequest('Le fichier doit être un .pptx');
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `tpl-${tpl}-${Date.now()}.pptx`);
    fs.writeFileSync(tmp, req.file.buffer);
    try {
      const out = await runWorker('pptx_to_layout', { pptx: tmp, out: layoutPath(tpl) }, { timeoutMs: 60000 });
      res.status(201).json({ customized: true, roles: out.roles || [] });
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }));

  parent.delete('/brochure/templates/:template/layout', wrap(async (req, res) => {
    const tpl = String(req.params.template);
    if (!BROCHURE_TEMPLATES.includes(tpl)) throw badRequest(`Modèle inconnu : ${tpl}`);
    try { fs.unlinkSync(layoutPath(tpl)); } catch { /* déjà absent */ }
    res.status(204).end();
  }));

  // ── Présentation personnalisée d'UNE propriété (round-trip niveau propriété) ──
  // Synchroniser le PPTX édité d'une propriété → surcharge layout propre à cette propriété
  // (n'affecte PAS le modèle). Le PDF/PPTX de cette propriété en hérite à la prochaine génération.
  parent.get('/properties/:id/brochure/:template/presentation', wrap(async (req, res) => {
    if (!Properties.get(req.params.id)) throw notFound('property introuvable');
    const pres = getPresentation(req.params.id, String(req.params.template));
    const d = (pres && pres.data) || {};
    const roles = [...Object.keys(d.layout || {}), ...Object.keys(d.content || {})];
    res.json({ customized: !!(d.layout || d.content), roles: [...new Set(roles)] });
  }));

  parent.post('/properties/:id/brochure/:template/sync', upload.single('file'), wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const tpl = String(req.params.template);
    if (!BROCHURE_TEMPLATES.includes(tpl)) throw badRequest(`Modèle inconnu : ${tpl}`);
    if (!req.file) throw badRequest('Aucun fichier PowerPoint téléversé');
    if (!/\.pptx$/i.test(req.file.originalname || '')) throw badRequest('Le fichier doit être un .pptx');
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `pres-${property.id}-${tpl}-${Date.now()}.pptx`);
    fs.writeFileSync(tmp, req.file.buffer);
    const imagesDir = path.join(config.root, 'data', 'uploads', 'properties', property.id, `synced-${tpl}`);
    try {
      const out = await runWorker('ingest_pptx', { pptx: tmp, images_dir: imagesDir }, { timeoutMs: 60000 }); // layout + contenu + images
      const existing = getPresentation(property.id, tpl);
      const data = { ...((existing && existing.data) || {}), layout: out.layout || {}, content: out.content || {} };
      if (existing) Documents.update(existing.id, { data });
      else Documents.create({ property_id: property.id, template: tpl, doc_type: 'brochure', title: `Présentation ${tpl}`, format: 'pptx', status: 'final', data });
      res.status(201).json({ customized: true, roles: out.roles || [] });
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }));

  parent.delete('/properties/:id/brochure/:template/presentation', wrap(async (req, res) => {
    if (!Properties.get(req.params.id)) throw notFound('property introuvable');
    const tpl = String(req.params.template);
    const pres = getPresentation(req.params.id, tpl);
    if (pres) Documents.delete(pres.id);
    try { fs.rmSync(path.join(config.root, 'data', 'uploads', 'properties', req.params.id, `synced-${tpl}`), { recursive: true, force: true }); } catch { /* ignore */ }
    res.status(204).end();
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

  // ── Module 3 : Offre de services (PDF déterministe, ReportLab — render_offre) ──
  // Profil courtier partagé (broker_profile) + contenu éditable (offre_content, bilingue).
  const offreAsset = (...p) => path.join(config.pythonDir, 'assets', ...p);
  const offreBroker = () => Settings.get('broker_profile', null) || {
    name: 'Pierre Vinet', title: 'Courtier immobilier', subtitle: 'résidentiel et commercial',
    agency: 'eXp Agence Immobilière', company: 'Immobilier Pierre Vinet Inc.',
    phone: '514.651.7437', email: 'pierre.vinet@exprealty.com', web: 'www.pierrevinet.com',
  };
  const propertyLine = (p) => p
    ? [p.address, p.city, p.province ? `(${p.province})` : null].filter(Boolean).join(', ')
    : null;

  // Premier fichier d'un asset du courtier (bibliothèque Assets courtier) d'un type donné.
  const firstAssetFile = (...types) => {
    for (const ty of types) {
      const rows = BrokerAssets.listBy('asset_type', ty) || [];
      const a = rows.find((r) => r.file_path && fs.existsSync(r.file_path));
      if (a) return a.file_path;
    }
    return null;
  };
  const existsPath = (p) => (p && fs.existsSync(p) ? p : null);

  function offreDataFromReq(src) {
    const variant = OFFRE_VARIANTS.includes(src.variant) ? src.variant : 'vendeur';
    const lang = OFFRE_LANGS.includes(src.lang) ? src.lang : 'fr';
    const client = src.client_id ? Clients.get(src.client_id) : null;
    const property = src.property_id ? Properties.get(src.property_id) : null;
    const broker = offreBroker();
    // Logo / photo / bannière : branding du Profil d'abord, sinon bibliothèque Assets courtier,
    // sinon valeur par défaut. (Un chemin enregistré mais introuvable est ignoré.)
    const logo = existsPath(broker.logo) || firstAssetFile('logo') || offreAsset('unifamilial', 'exp_logo_white.png');
    const photo = existsPath(broker.photo) || firstAssetFile('portrait', 'buste') || offreAsset('broker', 'portrait.png');
    const banner = existsPath(broker.banner) || firstAssetFile('banner') || null;
    return buildOffreData({
      variant, lang, broker,
      settingsContent: Settings.get('offre_content', null),
      client: client ? { name: client.full_name } : (src.client_name ? { name: src.client_name } : null),
      property: property ? { line: propertyLine(property) } : (src.property_line ? { line: src.property_line } : null),
      logo,
      broker_photo: photo,
      banner_image: banner,
      theme: broker.theme || null,   // { band_color, title_color } (Profil du courtier)
      overrides: src.overrides || null,
      dateIso: src.date_iso || new Date().toISOString().slice(0, 10),
      dateText: src.date || null,
    });
  }

  async function streamOffrePdf(res, data, label) {
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `offre-${label}-${Date.now()}.pdf`);
    await runWorker('render_offre', { data, out }, { timeoutMs: 60000 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="offre-${label}.pdf"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }

  // Aperçu / téléchargement (paramètres simples en query) — ouverture directe dans un onglet.
  parent.get('/offre.pdf', wrap(async (req, res) => {
    const data = offreDataFromReq(req.query || {});
    await streamOffrePdf(res, data, data.variant);
  }));

  // Génération avec surcharges ponctuelles (intro, honoraires, témoignages…) dans le corps.
  parent.post('/offre.pdf', wrap(async (req, res) => {
    const data = offreDataFromReq(req.body || {});
    await streamOffrePdf(res, data, data.variant);
  }));

  // Configuration éditable de l'offre : profil courtier + contenu (defaults + surcharges).
  parent.get('/offre/config', wrap(async (req, res) => {
    const broker = offreBroker();
    res.json({
      variants: OFFRE_VARIANTS,
      langs: OFFRE_LANGS,
      broker,
      content: Settings.get('offre_content', null),  // null = on utilise les défauts intégrés
      resolved: resolveOffreContent(Settings.get('offre_content', null)),  // défauts + surcharge (édition)
      images: {
        logo: broker.logo ? '/broker/profile/image/logo/raw' : null,
        banner: broker.banner ? '/broker/profile/image/banner/raw' : null,
        photo: broker.photo ? '/broker/profile/image/photo/raw' : null,
      },
    });
  }));

  parent.put('/offre/config', wrap(async (req, res) => {
    const body = req.body || {};
    if (body.broker !== undefined) {
      // Préserver les chemins d'images (gérés par les endpoints d'upload, pas par le formulaire).
      const cur = Settings.get('broker_profile', {}) || {};
      const next = { ...body.broker };
      for (const k of ['logo', 'banner', 'photo']) {
        if (next[k] === undefined && cur[k]) next[k] = cur[k];
      }
      Settings.set('broker_profile', next);
    }
    if (body.content !== undefined) Settings.set('offre_content', body.content);
    res.json({ broker: offreBroker(), content: Settings.get('offre_content', null) });
  }));

  // ── Offres sauvegardées (entités) — stockées dans `documents` (doc_type='offre') ──
  // Une offre nommée = variante + langue + client/propriété + surcharges + (futur) personnalisation.
  // `data.is_template` la fait apparaître dans l'onglet Gabarits.
  const offreOut = (d) => ({
    id: d.id, name: d.title, client_id: d.client_id, property_id: d.property_id,
    lang: d.lang, client_type: d.template || null,
    created_at: d.created_at, updated_at: d.updated_at, ...(d.data || {}),
  });
  const offreDocFields = (b) => ({
    title: (b.name || '').trim() || 'Offre sans nom',
    client_id: b.client_id || null, property_id: b.property_id || null, lang: b.lang || 'fr',
    template: b.client_type || null,
    data: {
      offer_name: (b.name || '').trim(), variant: b.variant || 'vendeur', lang: b.lang || 'fr',
      client_id: b.client_id || null, property_id: b.property_id || null, client_type: b.client_type || null,
      opportunity: b.opportunity || null, date_iso: b.date_iso || null,
      is_template: !!b.is_template, overrides: b.overrides || null, customization: b.customization || null,
    },
  });

  parent.get('/offres', wrap(async (req, res) => {
    const r = Documents.list({ doc_type: 'offre', q: req.query.q, limit: 500, sort: 'updated_at', dir: 'desc' });
    let rows = r.rows.map(offreOut);
    if (req.query.templates === '1' || req.query.templates === 'true') rows = rows.filter((o) => o.is_template);
    else if (req.query.templates === '0') rows = rows.filter((o) => !o.is_template);
    res.json({ rows, total: rows.length });
  }));
  parent.post('/offres', wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.name.trim()) throw badRequest('name requis');
    const doc = Documents.create({ doc_type: 'offre', ...offreDocFields(b) });
    Activity.log({ kind: 'create', entity_type: 'offre', entity_id: doc.id, summary: `Offre « ${doc.title} »` });
    res.status(201).json(offreOut(doc));
  }));
  parent.get('/offres/:id', wrap(async (req, res) => {
    const d = Documents.get(req.params.id);
    if (!d || d.doc_type !== 'offre') throw notFound('offre introuvable');
    res.json(offreOut(d));
  }));
  parent.put('/offres/:id', wrap(async (req, res) => {
    const d = Documents.get(req.params.id);
    if (!d || d.doc_type !== 'offre') throw notFound('offre introuvable');
    const upd = Documents.update(req.params.id, offreDocFields(req.body || {}));
    res.json(offreOut(upd));
  }));
  parent.delete('/offres/:id', wrap(async (req, res) => {
    const d = Documents.get(req.params.id);
    if (!d || d.doc_type !== 'offre') throw notFound('offre introuvable');
    Documents.delete(req.params.id);
    res.json({ ok: true });
  }));

  // Données de rendu d'une offre SAUVEGARDÉE (PDF ou PPTX) : applique le contenu issu du
  // jumeau PPTX synchronisé (prioritaire) sinon la personnalisation (ordre/inclusion/assets).
  function offerRenderData(d) {
    const o = offreOut(d);
    const variant = OFFRE_VARIANTS.includes(o.variant) ? o.variant : 'vendeur';
    const lang = OFFRE_LANGS.includes(o.lang) ? o.lang : 'fr';
    const langs = lang === 'bi' ? ['fr', 'en'] : [lang];
    const broker = offreBroker();
    const logo = existsPath(broker.logo) || firstAssetFile('logo') || offreAsset('unifamilial', 'exp_logo_white.png');
    const photo = existsPath(broker.photo) || firstAssetFile('portrait', 'buste') || offreAsset('broker', 'portrait.png');
    const banner = existsPath(broker.banner) || firstAssetFile('banner') || null;
    const resolveAsset = (a) => {
      if (a && a.asset_id) { const x = BrokerAssets.get(a.asset_id); return x && existsPath(x.file_path); }
      switch (a && a.kind) {
        case 'logo': return logo;
        case 'banner': return banner || logo;
        case 'portrait': return photo;
        case 'buste': return firstAssetFile('buste') || photo;
        case 'photo': return firstAssetFile('autre', 'hero') || photo;
        default: return null;
      }
    };
    const global = resolveOffreContent(Settings.get('offre_content', null));
    const contentOverride = {};
    for (const l of langs) {
      contentOverride[l] = o.pptx_content?.[l] || applyOfferDiff(global[l]?.[variant] || {}, o.customization?.[l], resolveAsset);
    }
    const client = o.client_id ? Clients.get(o.client_id) : null;
    const property = o.property_id ? Properties.get(o.property_id) : null;
    return buildOffreData({
      variant, lang, broker, settingsContent: Settings.get('offre_content', null),
      client: client ? { name: client.full_name } : null,
      property: property ? { line: propertyLine(property) } : null,
      logo, broker_photo: photo, banner_image: banner, theme: broker.theme || null,
      contentOverride,
      dateIso: o.date_iso || new Date().toISOString().slice(0, 10),
    });
  }

  const getOffre = (id) => { const d = Documents.get(id); if (!d || d.doc_type !== 'offre') throw notFound('offre introuvable'); return d; };

  // PDF d'une offre sauvegardée.
  parent.get('/offres/:id/pdf', wrap(async (req, res) => {
    const d = getOffre(req.params.id);
    await streamOffrePdf(res, offerRenderData(d), offreOut(d).name || 'offre');
  }));

  // Jumeau PPTX éditable d'une offre (aller-retour).
  parent.get('/offres/:id/pptx', wrap(async (req, res) => {
    const d = getOffre(req.params.id);
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `offre-${d.id}-${Date.now()}.pptx`);
    await runWorker('render_offre_pptx', { data: offerRenderData(d), out }, { timeoutMs: 60000 });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="offre-${(offreOut(d).name || 'offre').replace(/[^\w.-]+/g, '_')}.pptx"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }));

  // Synchronisation : le PPTX édité est ré-ingéré → contenu de l'offre + PDF mis à jour.
  parent.post('/offres/:id/pptx/sync', upload.single('file'), wrap(async (req, res) => {
    const d = getOffre(req.params.id);
    if (!req.file) throw badRequest('Aucun fichier PPTX téléversé');
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `offre-sync-${d.id}-${Date.now()}.pptx`);
    fs.writeFileSync(tmp, req.file.buffer);
    const imagesDir = path.join(dir, `offre-${d.id}-imgs`);
    try {
      const out = await runWorker('ingest_offre_pptx', { pptx: tmp, images_dir: imagesDir }, { timeoutMs: 60000 });
      const o = offreOut(d);
      const l0 = (o.lang === 'en') ? 'en' : 'fr';   // le PPTX porte une seule langue (bi → fr)
      const data = { ...(d.data || {}) };
      data.pptx_content = { ...(data.pptx_content || {}), [l0]: out.content };
      data.pptx_synced_at = new Date().toISOString();
      Documents.update(d.id, { data });
      res.json(offreOut(Documents.get(d.id)));
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }));

  // Images de marque du courtier (logo, bannière de fond, portrait). Stockées dans broker_profile.
  const BROKER_IMG_KINDS = ['logo', 'banner', 'photo'];
  parent.post('/broker/profile/image/:kind', upload.single('file'), wrap(async (req, res) => {
    const kind = String(req.params.kind);
    if (!BROKER_IMG_KINDS.includes(kind)) throw badRequest(`Type d'image inconnu : ${kind}`);
    if (!req.file || !String(req.file.mimetype || '').startsWith('image/')) throw badRequest('Image requise');
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `broker_${kind}_${Date.now()}${EXT[req.file.mimetype] || '.img'}`);
    fs.writeFileSync(dest, req.file.buffer);
    const broker = Settings.get('broker_profile', {}) || {};
    try { if (broker[kind] && broker[kind] !== dest) fs.unlinkSync(broker[kind]); } catch { /* ignore */ }
    broker[kind] = dest;
    Settings.set('broker_profile', broker);
    res.json({ kind, url: `/broker/profile/image/${kind}/raw?t=${Date.now()}` });
  }));

  parent.delete('/broker/profile/image/:kind', wrap(async (req, res) => {
    const kind = String(req.params.kind);
    if (!BROKER_IMG_KINDS.includes(kind)) throw badRequest(`Type d'image inconnu : ${kind}`);
    const broker = Settings.get('broker_profile', {}) || {};
    try { if (broker[kind]) fs.unlinkSync(broker[kind]); } catch { /* ignore */ }
    broker[kind] = null;
    Settings.set('broker_profile', broker);
    res.json({ ok: true });
  }));

  parent.get('/broker/profile/image/:kind/raw', wrap(async (req, res) => {
    const kind = String(req.params.kind);
    if (!BROKER_IMG_KINDS.includes(kind)) throw notFound('image introuvable');
    const broker = Settings.get('broker_profile', {}) || {};
    const p = broker[kind];
    if (!p || !fs.existsSync(p)) throw notFound('image introuvable');
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.sendFile(p, (err) => { if (err && !res.headersSent) res.status(500).end(); });
  }));

  // ── Assets du courtier : fichier (image/PDF) attaché à un asset ──
  const ASSET_EXT = { ...EXT, 'application/pdf': '.pdf', 'image/svg+xml': '.svg' };
  parent.post('/broker-assets/:id/file', upload.single('file'), wrap(async (req, res) => {
    const a = BrokerAssets.get(req.params.id);
    if (!a) throw notFound('asset introuvable');
    if (!req.file) throw badRequest('Aucun fichier téléversé');
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/') && mime !== 'application/pdf') throw badRequest('Format non supporté (image ou PDF)');
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `asset_${a.id}_${Date.now()}${ASSET_EXT[mime] || '.bin'}`);
    fs.writeFileSync(dest, req.file.buffer);
    try { if (a.file_path && a.file_path !== dest) fs.unlinkSync(a.file_path); } catch { /* ignore */ }
    const updated = BrokerAssets.update(a.id, { file_path: dest, filename: req.file.originalname || null, mime });
    res.json(updated);
  }));

  parent.delete('/broker-assets/:id/file', wrap(async (req, res) => {
    const a = BrokerAssets.get(req.params.id);
    if (!a) throw notFound('asset introuvable');
    try { if (a.file_path) fs.unlinkSync(a.file_path); } catch { /* ignore */ }
    res.json(BrokerAssets.update(a.id, { file_path: null, filename: null, mime: null }));
  }));

  parent.get('/broker-assets/:id/raw', wrap(async (req, res) => {
    const a = BrokerAssets.get(req.params.id);
    if (!a || !a.file_path || !fs.existsSync(a.file_path)) throw notFound('fichier introuvable');
    if (a.mime) res.setHeader('Content-Type', a.mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.sendFile(a.file_path, (err) => { if (err && !res.headersSent) res.status(500).end(); });
  }));

  // ── Aperçu des GABARITS de brochure (sans propriété) : rendu d'un exemple déterministe ──
  // Permet à l'onglet « Gabarits › Brochures » de prévisualiser/télécharger chaque modèle.
  function sampleBrochureData(template) {
    return {
      template,
      broker: offreBroker(),
      images: { hero: null, map: null },
      interior: [],
      listing_url: null,
      title: 'Maison à vendre',
      city: 'Blainville (Québec)',
      summary_line: '4 chambres + 2 salles de bain (2 400 pi²)',
      address: '123, RUE DES ÉRABLES, BLAINVILLE (QUÉBEC) J7C 0A0',
      mls: '10000000',
      price: 749000,
      specs_left: [
        ['Type de propriété', 'Unifamiliale'], ['Année de construction', 2008],
        ['Nombre de pièces', 9], ['Nombre de chambres', 4], ['Nombre salles de bain', 2],
      ],
      specs_right: [
        ['Surface habitable', '2 400 pc'], ['Surface du terrain', '6 500 pc'],
        ['Structure', 'Ossature de bois'], ['Revêtement', 'Brique et fibrociment'], ['Zonage', 'Résidentiel'],
      ],
      headline: 'Exemple de brochure — modèle',
      description: 'Ceci est un exemple servant à visualiser le modèle de brochure. Les photos, le texte et les caractéristiques seront remplacés par les données réelles de la propriété lors de la génération.',
      rooms: [
        ["Hall d'entrée", 'RDC', '2,1 x 1,8 m'], ['Salon', 'RDC', '4,5 x 4,0 m'],
        ['Cuisine', 'RDC', '3,6 x 4,2 m'], ['Chambre principale', 'Étage', '4,0 x 3,8 m'],
      ],
    };
  }
  async function streamBrochureSample(res, template, fmt) {
    if (!BROCHURE_TEMPLATES.includes(template)) throw badRequest(`Modèle inconnu : ${template}`);
    const dir = path.join(config.root, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `gabarit-${template}-${Date.now()}.${fmt}`);
    if (template === 'rpa' && fmt === 'pdf') {
      // Aperçu du gabarit RPA (format éditorial) à partir des défauts (réserves d'images élégantes).
      await runWorker('render_rpa_brochure', { data: buildRpaData({ broker: defaultBroker() }), out }, { timeoutMs: 60000 });
    } else {
      const worker = fmt === 'pptx' ? 'render_brochure_pptx' : 'render_brochure';
      await runWorker(worker, { data: sampleBrochureData(template), out }, { timeoutMs: 60000 });
    }
    res.setHeader('Content-Type', fmt === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/pdf');
    res.setHeader('Content-Disposition', `${fmt === 'pptx' ? 'attachment' : 'inline'}; filename="gabarit-${template}.${fmt}"`);
    res.sendFile(out, (err) => { try { fs.unlinkSync(out); } catch { /* ignore */ } if (err && !res.headersSent) res.status(500).end(); });
  }
  parent.get('/brochure/templates/:template/sample.pdf', wrap(async (req, res) => {
    await streamBrochureSample(res, String(req.params.template), 'pdf');
  }));
  parent.get('/brochure/templates/:template/sample.pptx', wrap(async (req, res) => {
    await streamBrochureSample(res, String(req.params.template), 'pptx');
  }));

  return parent;
}
