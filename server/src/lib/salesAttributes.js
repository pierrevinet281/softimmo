// Attributs de vente (Module 1/4) : taxonomie (seed) + matrice d'applicabilité par type.
//
// La taxonomie (catégories ordonnées + attributs ordonnés par importance, bilingues) vit dans
// `db/seeds/sales-attributes.seed.json`. L'admin bascule l'applicabilité d'un attribut pour un
// type via la page « Attributs Ventes » ; ces SURCHARGES (sparses) sont stockées dans
// Settings['sales_attributes_matrix'] = { <attr>: { <type>: bool } }. La matrice EFFECTIVE =
// défaut du seed (attribut.types) sauf surcharge. Sert ensuite à générer le formulaire par type,
// puis la brochure. Déterministe, sans IA.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'db', 'seeds', 'sales-attributes.seed.json');
const OVERRIDE_KEY = 'sales_attributes_matrix';

let _tax = null;
function taxonomy() {
  if (!_tax) _tax = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  return _tax;
}

function overrides(Settings) {
  return Settings.get(OVERRIDE_KEY, {}) || {};
}

/** Matrice effective : types (colonnes) + catégories ordonnées + attributs ordonnés, chacun avec
 *  `enabled` = { <type>: bool } (défaut du seed fusionné avec la surcharge admin). */
export function buildMatrix(Settings) {
  const tax = taxonomy();
  const ov = overrides(Settings);
  const typeKeys = tax.types.map((t) => t.key);
  const attributes = tax.attributes.map((a) => {
    const def = new Set(a.types || []);
    const enabled = {};
    for (const tk of typeKeys) {
      const o = ov[a.key] ? ov[a.key][tk] : undefined;
      enabled[tk] = o === undefined ? def.has(tk) : !!o;
    }
    return {
      key: a.key, category: a.category, label_fr: a.label_fr, label_en: a.label_en,
      input: a.input || 'text', unit: a.unit || null, enabled,
      // Champs de présentation enrichis (rendu du formulaire) : voir lib/attrOptions (front).
      optset: a.optset || null, group: a.group || null, computed: a.computed || null, sync: a.sync || null,
    };
  });
  return { types: tax.types, categories: tax.categories, attributes };
}

/** Bascule l'applicabilité d'un attribut pour un type (persiste la surcharge). */
export function setCell(Settings, attr, type, value) {
  const tax = taxonomy();
  if (!tax.attributes.some((a) => a.key === attr)) throw new Error(`Attribut inconnu : ${attr}`);
  if (!tax.types.some((t) => t.key === type)) throw new Error(`Type inconnu : ${type}`);
  const ov = overrides(Settings);
  if (!ov[attr]) ov[attr] = {};
  ov[attr][type] = !!value;
  Settings.set(OVERRIDE_KEY, ov);
  return true;
}

/** Efface toutes les surcharges → retour aux défauts du seed. */
export function resetMatrix(Settings) {
  Settings.set(OVERRIDE_KEY, {});
  return true;
}

/** Schéma de formulaire pour un type : catégories non vides, attributs activés, ordonnés. */
export function formSchema(Settings, type) {
  const m = buildMatrix(Settings);
  if (!m.types.some((t) => t.key === type)) return null;
  const categories = m.categories
    .map((c) => ({
      key: c.key, label_fr: c.label_fr, label_en: c.label_en,
      attributes: m.attributes
        .filter((a) => a.category === c.key && a.enabled[type])
        .map((a) => ({ key: a.key, label_fr: a.label_fr, label_en: a.label_en, input: a.input, unit: a.unit, optset: a.optset, group: a.group, computed: a.computed, sync: a.sync })),
    }))
    .filter((c) => c.attributes.length);
  return { type, categories };
}
