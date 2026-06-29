// Municipalités du Québec → région administrative (lecture du seed). Sert au champ Ville
// (combobox de recherche) et à l'association automatique de la région dans la page propriété.
// Remplacer le seed par la liste officielle complète (MAMH) étend la couverture sans toucher au code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'db', 'seeds', 'quebec-municipalities.seed.json');

let _data = null;
function data() {
  if (!_data) {
    const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
    const munis = (raw.municipalities || []).map(([name, region]) => ({ name, region }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    _data = { regions: raw.regions || [], municipalities: munis };
  }
  return _data;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Recherche de municipalités (préfixe priorisé, puis sous-chaîne). Limite à `limit`. */
export function searchMunicipalities(q, limit = 40) {
  const all = data().municipalities;
  const term = norm(q).trim();
  if (!term) return all.slice(0, limit);
  const starts = []; const contains = [];
  for (const m of all) {
    const n = norm(m.name);
    if (n.startsWith(term)) starts.push(m);
    else if (n.includes(term)) contains.push(m);
  }
  return [...starts, ...contains].slice(0, limit);
}

export function regions() {
  return data().regions;
}
