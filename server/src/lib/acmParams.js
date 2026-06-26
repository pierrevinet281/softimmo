// Chargement des paramètres ACM : DÉFAUTS depuis le seed JSON, surchargés par l'override
// stocké dans settings (clé `acm_params`). Aucune donnée codée en dur (CLAUDE.md §3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Settings } from '../db/repositories/index.js';
import { parseJson } from '../db/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'db', 'seeds', 'acm-params.seed.json');
const SETTINGS_KEY = 'acm_params';

let _defaults = null;
function defaults() {
  if (_defaults) return _defaults;
  const raw = parseJson(fs.readFileSync(SEED_PATH, 'utf8'), {});
  delete raw._comment;
  _defaults = raw;
  return raw;
}

// Fusion peu profonde + fusion en profondeur des tables imbriquées (inclusions, features,
// age_features) pour permettre des overrides partiels (un seul taux d'option, p. ex.).
function merge(base, over) {
  if (!over || typeof over !== 'object') return { ...base };
  const out = { ...base, ...over };
  if (over.inclusions || base.inclusions) out.inclusions = { ...(base.inclusions || {}), ...(over.inclusions || {}) };
  for (const grp of ['features', 'age_features']) {
    if (!over[grp] && !base[grp]) continue;
    const merged = { ...(base[grp] || {}) };
    for (const [key, cfg] of Object.entries(over[grp] || {})) {
      const b = merged[key] || {};
      merged[key] = { ...b, ...cfg };
      if (cfg.options || b.options) merged[key].options = { ...(b.options || {}), ...(cfg.options || {}) };
    }
    out[grp] = merged;
  }
  return out;
}

// Paramètres effectifs (défauts + override settings), éventuellement surchargés à l'appel.
export function getAcmParams(callOverride) {
  const override = Settings.get(SETTINGS_KEY, null);
  return merge(merge(defaults(), override), callOverride);
}

// Persiste un override (partiel) dans settings ; renvoie les paramètres effectifs.
export function setAcmParams(override) {
  Settings.set(SETTINGS_KEY, override || {});
  return getAcmParams();
}

export function getAcmDefaults() { return defaults(); }

export default { getAcmParams, setAcmParams, getAcmDefaults };
