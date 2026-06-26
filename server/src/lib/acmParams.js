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

// Fusion peu profonde + fusion dédiée de la table `inclusions`.
function merge(base, over) {
  if (!over || typeof over !== 'object') return { ...base };
  const out = { ...base, ...over };
  if (over.inclusions || base.inclusions) out.inclusions = { ...(base.inclusions || {}), ...(over.inclusions || {}) };
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
