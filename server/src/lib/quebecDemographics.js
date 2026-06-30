// Démographie Québec (MAMH — Répertoire des municipalités : population, superficie, gentilé).
// Agrégats MRC/région = somme des municipalités. Lecture du seed quebec-demographics.seed.json
// (généré une fois depuis Datasources/MUN.xlsx). Déterministe, hors-ligne. Pas de donnée codée en dur.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'db', 'seeds', 'quebec-demographics.seed.json');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

let _d = null;
function data() {
  if (!_d) { const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8')); _d = { municipalities: raw.municipalities || {}, mrc: raw.mrc || {}, region: raw.region || {} }; }
  return _d;
}

export function muniDemographics(name) { return name ? (data().municipalities[norm(name)] || null) : null; }
export function mrcDemographics(name) { return name ? (data().mrc[norm(name)] || null) : null; }
export function regionDemographics(name) { return name ? (data().region[norm(name)] || null) : null; }

export default { muniDemographics, mrcDemographics, regionDemographics };
