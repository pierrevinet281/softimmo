// Module 3 — Offre de services : construction des données de rendu (déterministe, sans IA).
//
// Le contenu par défaut (bilingue) vit dans offre-content.json. Le courtier peut le
// surcharger globalement via Settings('offre_content') ; chaque génération peut en plus
// fournir des surcharges ponctuelles (intro, honoraires, témoignages, client, propriété).
//
// Conformité (CLAUDE.md §0.2) : bilingue FR prééminent ; mentions agence + courtier (gérées
// par le moteur PDF) ; « opinion de la valeur marchande » (jamais « évaluation ») dans le
// contenu par défaut. Garde-fou : on bloque les titres « spécialiste » prohibés.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, 'offre-content.json');

let _defaults = null;
function loadDefaults() {
  if (_defaults) return _defaults;
  _defaults = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8'));
  return _defaults;
}

export const OFFRE_VARIANTS = ['vendeur', 'acheteur'];
export const OFFRE_LANGS = ['fr', 'en', 'bi'];

// Désignations prohibées (LCI / r.1 publicité) — on neutralise « spécialiste ».
function sanitizeBroker(broker) {
  const b = { ...(broker || {}) };
  for (const k of ['title', 'subtitle']) {
    if (b[k] && /sp[ée]cialiste/i.test(String(b[k]))) {
      b[k] = String(b[k]).replace(/sp[ée]cialiste/gi, 'courtier').replace(/\s+/g, ' ').trim();
    }
  }
  return b;
}

function deepMergeVariant(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v;
    else if (typeof v === 'object') out[k] = deepMergeVariant(base?.[k] || {}, v);
    else out[k] = v;
  }
  return out;
}

// Résout le contenu d'une variante pour une langue : défaut JSON → surcharge Settings →
// surcharges ponctuelles de la requête (intro/fees/testimonials...).
function resolveVariant(lang, variant, settingsOverride, reqOverride) {
  const def = loadDefaults()[lang]?.[variant] || {};
  let v = JSON.parse(JSON.stringify(def));
  v = deepMergeVariant(v, settingsOverride?.[lang]?.[variant]);
  if (reqOverride) v = deepMergeVariant(v, reqOverride);
  return v;
}

const DEFAULT_BROKER = {
  name: 'Pierre Vinet', title: 'Courtier immobilier', subtitle: 'résidentiel et commercial',
  agency: 'eXp Agence Immobilière', company: 'Immobilier Pierre Vinet Inc.',
  phone: '514.651.7437', email: 'pierre.vinet@exprealty.com', web: 'www.pierrevinet.com',
};

/**
 * Construit le payload pour le worker render_offre.
 * @param {object} opts
 *  - variant: 'vendeur'|'acheteur'
 *  - lang: 'fr'|'en'|'bi'
 *  - broker: profil courtier (Settings.broker_profile)
 *  - settingsContent: Settings('offre_content') (surcharges globales par langue/variante)
 *  - client: { name } | property: { line }
 *  - logo, broker_photo: chemins d'images
 *  - overrides: { intro, fees, testimonials, next_steps } surcharges ponctuelles (par variante, non bilingue)
 *  - dateIso: 'YYYY-MM-DD'
 */
export function buildOffreData(opts = {}) {
  const variant = OFFRE_VARIANTS.includes(opts.variant) ? opts.variant : 'vendeur';
  const lang = OFFRE_LANGS.includes(opts.lang) ? opts.lang : 'fr';
  const langs = lang === 'bi' ? ['fr', 'en'] : [lang];
  const broker = sanitizeBroker(opts.broker || DEFAULT_BROKER);

  // Surcharges ponctuelles (mêmes valeurs pour FR et EN — le courtier édite le texte au besoin).
  const ro = {};
  if (opts.overrides?.services_intro) ro.services = { intro: opts.overrides.services_intro };
  if (opts.overrides?.fees_body || opts.overrides?.fees_note) {
    ro.fees = {};
    if (opts.overrides.fees_body) ro.fees.body = opts.overrides.fees_body;
    if (opts.overrides.fees_note) ro.fees.note = opts.overrides.fees_note;
  }
  if (Array.isArray(opts.overrides?.testimonials)) ro.testimonials = { items: opts.overrides.testimonials };
  if (opts.overrides?.next_steps_body) ro.next_steps = { body: opts.overrides.next_steps_body };

  const content = {};
  for (const l of langs) {
    content[l] = resolveVariant(l, variant, opts.settingsContent, Object.keys(ro).length ? ro : null);
    // Surcharge par offre (personnalisation : ordre/inclusion/assets déjà appliqués, prêt au rendu).
    if (opts.contentOverride && opts.contentOverride[l]) content[l] = opts.contentOverride[l];
  }

  return {
    langs, variant, broker,
    logo: opts.logo || null,
    broker_photo: opts.broker_photo || broker.photo || null,
    banner_image: opts.banner_image || null,
    theme: opts.theme || null,            // { band_color, title_color }
    client_name: opts.client?.name || null,
    property_line: opts.property?.line || null,
    date_iso: opts.dateIso || null,
    date: opts.dateText || null,
    content,
  };
}

// Applique la PERSONNALISATION d'une offre (diff) au contenu global d'une variante/langue,
// produisant un contenu prêt au rendu : ordre + masquage des sections, inclusion/ordre des
// éléments, et sections « asset » (image insérée). `resolveAsset(a)` renvoie le chemin image.
//   diff = { order:[key...], hidden:{key:true}, items:{key:{order:[i...], excluded:{i:true}}},
//            assets:{key:{kind, asset_id, caption}} }
export function applyOfferDiff(base, diff, resolveAsset) {
  base = base || {};
  if (!diff || !Array.isArray(diff.order) || !diff.order.length) return base;
  const out = { doc_title: base.doc_title, subtitle: base.subtitle };
  const sections = [];
  for (const key of diff.order) {
    const hidden = !!(diff.hidden && diff.hidden[key]);
    if (diff.assets && diff.assets[key]) {
      const a = diff.assets[key];
      out[key] = { kind: 'asset', image: resolveAsset ? resolveAsset(a) : null, caption: a.caption || '' };
      sections.push({ key, custom: true, kind: 'asset', hidden });
    } else if (base[key]) {
      const sec = JSON.parse(JSON.stringify(base[key]));
      const it = diff.items && diff.items[key];
      if (it && Array.isArray(sec.items)) {
        const ord = (Array.isArray(it.order) && it.order.length) ? it.order : sec.items.map((_, i) => i);
        sec.items = ord.filter((i) => !(it.excluded && it.excluded[i])).map((i) => sec.items[i]).filter((x) => x !== undefined);
      }
      out[key] = sec;
      const isCustom = !!(sec.kind && ['text', 'list', 'groups'].includes(sec.kind));
      sections.push({ key, hidden, custom: isCustom, kind: sec.kind });
    }
  }
  out.sections = sections;
  return out;
}

// Contenu EFFECTIF (défauts + surcharge Settings) pour l'éditeur « Profil du courtier ».
// Renvoie { fr: { vendeur, acheteur }, en: { vendeur, acheteur } }.
export function resolveOffreContent(settingsContent) {
  const out = {};
  for (const lang of ['fr', 'en']) {
    out[lang] = {};
    for (const variant of OFFRE_VARIANTS) {
      out[lang][variant] = resolveVariant(lang, variant, settingsContent, null);
    }
  }
  return out;
}

export default buildOffreData;
