// Builder de données pour la brochure RPA (format éditorial rpa_mlt — render_rpa_brochure.py).
// Déterministe, sans IA. Fusionne : contenu par défaut (rpa-brochure-content.json) + surcharge
// par propriété (texte) + photos téléversées affectées aux emplacements (slots) + courtier.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'rpa-brochure-content.json'), 'utf-8'));

export const RPA_LANGS = ['fr'];

// Emplacements d'images de la brochure RPA (rôles de property_media → slot du gabarit).
// Le formulaire (phase 1b) permettra d'affecter chaque photo ; ici on mappe par rôle.
export const RPA_IMAGE_SLOTS = [
  { slot: 'cover.hero', role: 'rpa_cover' },
  { slot: 'comfort.wide_image', role: 'rpa_comfort' },
  { slot: 'security.panel_image', role: 'rpa_security' },
  { slot: 'amenities.gallery.0.image', role: 'rpa_gallery1' },
  { slot: 'amenities.gallery.1.image', role: 'rpa_gallery2' },
  { slot: 'amenities.gallery.2.image', role: 'rpa_gallery3' },
  { slot: 'amenities.gallery.3.image', role: 'rpa_gallery4' },
  { slot: 'amenities.gallery.4.image', role: 'rpa_gallery5' },
  { slot: 'amenities.gallery.5.image', role: 'rpa_gallery6' },
  { slot: 'life.events.0.image', role: 'rpa_event1' },
  { slot: 'life.events.1.image', role: 'rpa_event2' },
  { slot: 'life.events.2.image', role: 'rpa_event3' },
  { slot: 'contact.hero', role: 'rpa_contact' },
];

const asset = (...p) => path.join(config.pythonDir, 'assets', ...p);

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
// Fusion profonde : la surcharge gagne ; les tableaux sont remplacés (pas concaténés).
function deepMerge(base, over) {
  if (!isObj(base)) return over === undefined ? base : over;
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

// Affecte une valeur à un chemin pointé (ex. "amenities.gallery.2.image"), créant au besoin.
function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === undefined || cur[k] === null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Construit le payload `data` pour render_rpa_brochure.
 * @param {object} opts
 * @param {object} opts.broker   profil courtier (Settings.broker_profile)
 * @param {string} [opts.lang]   fr (par défaut)
 * @param {object} [opts.contentOverride]  surcharge texte (documents.data.content)
 * @param {object} [opts.images] map { slot: chemin } (ou via media par rôle, voir buildFromMedia)
 */
export function buildRpaData({ broker = {}, lang = 'fr', contentOverride = null, images = null } = {}) {
  const L = RPA_LANGS.includes(lang) ? lang : 'fr';
  const content = deepMerge(DEFAULTS[L] || {}, contentOverride || {});
  if (images) {
    for (const [slot, p] of Object.entries(images)) {
      if (p) setPath(content, slot, p);
    }
  }
  const title_line = [broker.title, broker.subtitle].filter(Boolean).join(' ');
  return {
    lang: L,
    template: 'rpa',
    broker: { ...broker, title_line },
    assets: {
      agency_logo_white: asset('unifamilial', 'exp_logo_white.png'),
      agency_logo_black: asset('unifamilial', 'exp_logo_black.png'),
      broker_hero: broker.hero_path || asset('unifamilial', 'superpierre.png'),
      company_logo: asset('rpa', 'company_logo.png'),
      qr: broker.qr_path || null,
    },
    content,
  };
}

// Affecte les photos téléversées (property_media) aux emplacements de la brochure, par rôle.
export function imagesFromMedia(media = []) {
  const byRole = {};
  for (const m of media) {
    if (m.role && m.file_path && !byRole[m.role]) byRole[m.role] = m.file_path;
  }
  const out = {};
  for (const { slot, role } of RPA_IMAGE_SLOTS) {
    if (byRole[role]) out[slot] = byRole[role];
  }
  // Repli pratique : si pas de photo de couverture dédiée, utiliser une photo « hero » générique.
  if (!out['cover.hero'] && byRole.hero) out['cover.hero'] = byRole.hero;
  if (!out['contact.hero'] && byRole.hero) out['contact.hero'] = byRole.hero;
  return out;
}

export default buildRpaData;
