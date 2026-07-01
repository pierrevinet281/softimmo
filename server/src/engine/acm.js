// Moteur ACM (Analyse Comparative de Marché) — cœur du Module 2 (Évaluation).
// 100 % DÉTERMINISTE, sans IA (CLAUDE.md §3, docs/12). Fonctions PURES : retournent des
// données, ne touchent ni la DB ni le réseau. Les paramètres d'ajustement sont des DÉFAUTS
// ÉDITABLES (jamais des vérités) fournis par l'appelant (seed acm-params + override settings).
//
// Principe : on ajuste le prix VENDU de chaque comparable pour le rendre comparable au SUJET,
// chaque ajustement étant chiffré ET expliqué (grille ventilée — docs/12 §2.1). Le prix de
// vente attendu = moyenne pondérée des prix ajustés. Le prix d'inscription en découle via le
// ratio APCIQ « prix de vente / prix inscrit ». L'éval. foncière ne sert que de corroboration.

const n = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const round = (v, step = 1) => (v == null ? null : Math.round(v / step) * step);

// Mois (fractionnaires) entre deux dates 'YYYY-MM-DD'. null si l'une manque/est invalide.
function monthsBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const a = new Date(fromStr); const b = new Date(toStr);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
}

// Quantité d'une inclusion. Accepte un objet {clé: qté} (forme courante), un objet
// {clé: true} (qté 1), ou un tableau de clés (qté 1 par présence) — rétrocompatible.
function inclQty(inclusions, key) {
  if (!inclusions) return 0;
  if (Array.isArray(inclusions)) return inclusions.includes(key) ? 1 : 0;
  const v = inclusions[key];
  if (v === true) return 1;
  return Number(v) || 0;
}

// Libellé lisible à partir d'une clé d'inclusion (déterministe, sans catalogue codé en dur).
function prettyIncl(key) {
  const s = String(key).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Normalise un comparable (tolère les anciens champs `price`/`area`).
function normComp(c) {
  return {
    ...c,
    soldPrice: n(c.sold_price) ?? n(c.price),
    listPrice: n(c.list_price) ?? n(c.price),
    livingArea: n(c.livable_area) ?? n(c.area),
    yearBuilt: n(c.year_built),
    saleDate: c.sale_date || c.date || null,
    weight: n(c.weight) ?? 1,
    inclusions: c.inclusions || null,
  };
}

/**
 * Construit la ventilation d'ajustements explicable d'UN comparable vendu vs le sujet.
 * @returns {{lines:Array, total:number, adjustedPrice:number}}
 */
const asArr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '') : (v == null || v === '' ? [] : [v]));
const pick = (o, ...keys) => { for (const k of keys) { const v = o[k]; if (v != null && v !== '') return v; } return undefined; };
// Moyenne des valeurs d'option présentes (éléments compétitifs multiples → moyenne, pas somme).
function avgOpt(value, opts) {
  const vals = asArr(value).map((k) => n(opts[k])).filter((x) => x != null);
  if (!vals.length) return null;
  return vals.reduce((s, x) => s + x, 0) / vals.length;
}
// Nb d'étages hors-sol d'après le style/le nb d'étages ; défaut bungalow (1) si inconnu.
function aboveLevels(style, storeys) {
  const s = n(storeys);
  if (s) return Math.max(1, Math.round(s));
  if (style && /etage|cottage|deux|paliers|2/i.test(String(style))) return 2;
  return 1;
}
// Répartition de la superficie habitable par niveau (RDC / étages / sous-sol) selon le nb de niveaux.
function floorAreas(total, above, hasBasement) {
  const t = n(total);
  if (t == null) return null;
  const lvls = above + (hasBasement ? 1 : 0);
  const share = lvls > 0 ? t / lvls : 0;
  return { rdc: share, etage: share * Math.max(0, above - 1), sous_sol: hasBasement ? share : 0, lvls, above, hasBasement };
}
const truthyBsmt = (v) => !(v === 0 || v === false || v === '' || v == null || /^(non|no|aucun|false|0)$/i.test(String(v)));

export function adjustComparable(subject, comp, params, asOf, ignored) {
  const lines = [];
  const c = normComp(comp);
  const price = c.soldPrice ?? 0;
  const A = params.area || {};
  const AG = params.age || {};
  const apprec = n(params.monthly_appreciation_pct) ?? 0;
  const add = (key, label, o) => lines.push({ key, label, ...o });

  // 1) Superficie — terrain + construction par niveau (RDC / étages / sous-sol). La superficie
  // habitable est répartie par niveau ; pour un comparable sans détail, hypothèse documentée.
  const subjAbove = Math.max(1, Math.round(n(subject.floors_above) || n(subject.num_storeys) || (truthyBsmt(subject.has_basement) ? 1 : 1)));
  const subjBsmt = truthyBsmt(subject.has_basement);
  const sF = floorAreas(subject.living_area, subjAbove, subjBsmt);
  const cAbove = aboveLevels(pick(c, 'style', 'arch_style'), pick(c, 'storeys', 'num_storeys', 'floors_above'));
  const cBsmtKnown = c.basement !== undefined && c.basement !== null && c.basement !== '';
  const cBsmt = cBsmtKnown ? truthyBsmt(c.basement) : true; // défaut : bungalow + sous-sol (÷2)
  const cF = floorAreas(c.livingArea, cAbove, cBsmt);
  const splitNote = `Comparable réparti sur ${cF ? cF.lvls : '?'} niveau(x) `
    + `(${cAbove > 1 ? 'à étages' : 'plain-pied'}${cBsmt ? ' + sous-sol' : ''}${cBsmtKnown ? '' : ', hypothèse par défaut bungalow + sous-sol'}).`;
  // Terrain
  const sLand = n(subject.land_area); const cLand = n(c.land_area);
  if (sLand != null && cLand != null && n(A.land_per_sqft) && sLand !== cLand) {
    const amount = (sLand - cLand) * A.land_per_sqft;
    add('land', 'Terrain', { subject: sLand, comp: cLand, delta: sLand - cLand, unit: 'pi2', rate: A.land_per_sqft, amount,
      explanation: `Terrain : ${sLand} pi² (sujet) vs ${cLand} pi² ; à ${A.land_per_sqft} $/pi², on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $.` });
  }
  if (sF && cF) {
    const rows = [['constr_rdc', 'rdc', A.constr_rdc_per_sqft, 'Construction — RDC'],
      ['constr_etage', 'etage', A.constr_etage_per_sqft, 'Construction — étages'],
      ['constr_sous_sol', 'sous_sol', A.constr_sous_sol_per_sqft, 'Construction — sous-sol']];
    for (const [key, f, rateRaw, label] of rows) {
      const rate = n(rateRaw); const delta = sF[f] - cF[f];
      if (!rate || Math.round(delta) === 0) continue;
      const amount = delta * rate;
      add(key, label, { subject: Math.round(sF[f]), comp: Math.round(cF[f]), delta: Math.round(delta), unit: 'pi2', rate, amount,
        explanation: `${label} : ${Math.round(sF[f])} pi² (sujet) vs ${Math.round(cF[f])} pi² ; à ${rate} $/pi², on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $. ${splitNote}` });
    }
  }

  // Note de construction standard assumée (donnée catégorielle absente → option de référence à 0).
  const stdNote = (sRaw, cRaw) => (cRaw == null ? ' (comparable : construction standard assumée)' : (sRaw == null ? ' (sujet : construction standard assumée)' : ''));

  // 2) Caractéristiques % (option → valeur ; multi → MOYENNE) : (moy. sujet − moy. comp) × prix.
  // Donnée absente d'un côté = construction standard (référence à 0) pour comptabiliser la prime de l'autre.
  for (const [key, cfg] of Object.entries(params.features_pct || {})) {
    const attr = cfg.attr || key; const opts = cfg.options || {};
    const sRaw = avgOpt(subject[attr], opts); const cRaw = avgOpt(pick(c, attr) ?? c[key], opts);
    if (sRaw == null && cRaw == null) continue;
    const sPct = sRaw == null ? 0 : sRaw; const cPct = cRaw == null ? 0 : cRaw;
    if (sPct === cPct) continue;
    const delta = sPct - cPct; const amount = delta * price;
    add(`featpct_${key}`, cfg.label_fr || key, { subject: `${(sPct * 100).toFixed(1)} %`, comp: `${(cPct * 100).toFixed(1)} %`, delta, unit: '%', rate: delta, amount,
      explanation: `${cfg.label_fr || key} : ${(sPct * 100).toFixed(1)} % (sujet) vs ${(cPct * 100).toFixed(1)} % (comparable) — moyenne des éléments sélectionnés ; on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $.${stdNote(sRaw, cRaw)}` });
  }

  // 3) Caractéristiques $ (option → $ contributif ; multi → MOYENNE) : (moy. sujet − moy. comp).
  for (const [key, cfg] of Object.entries(params.features_dollar || {})) {
    const attr = cfg.attr || key; const opts = cfg.options || {};
    const sRaw = avgOpt(subject[attr], opts); const cRaw = avgOpt(pick(c, attr) ?? c[key], opts);
    if (sRaw == null && cRaw == null) continue;
    const sVal = sRaw == null ? 0 : sRaw; const cVal = cRaw == null ? 0 : cRaw;
    if (sVal === cVal) continue;
    const amount = sVal - cVal;
    add(`featdol_${key}`, cfg.label_fr || key, { subject: `${Math.round(sVal).toLocaleString('fr-CA')} $`, comp: `${Math.round(cVal).toLocaleString('fr-CA')} $`, delta: amount, unit: '$', rate: 1, amount,
      explanation: `${cfg.label_fr || key} : ${Math.round(sVal).toLocaleString('fr-CA')} $ (sujet) vs ${Math.round(cVal).toLocaleString('fr-CA')} $ (comparable) — moyenne ; on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $.${stdNote(sRaw, cRaw)}` });
  }

  // 4) Accessoires ($ par quantité ; sous_sol_fini = $/pi² de sous-sol fini). (qté sujet − qté comp) × prix.
  const labels = params.inclusions_labels || {};
  for (const [key, priceRaw] of Object.entries(params.inclusions || {})) {
    const unitPrice = n(priceRaw);
    if (!unitPrice) continue;
    const label = labels[key] || prettyIncl(key);
    if (key === 'sous_sol_fini') {
      const sArea = (subject.basement === 'complete' || truthyBsmt(subject.basement_finished)) && sF ? sF.sous_sol : 0;
      const cArea = (cBsmt && truthyBsmt(pick(c, 'basement_finished'))) && cF ? cF.sous_sol : 0;
      const delta = sArea - cArea;
      if (Math.round(delta) === 0) continue;
      const amount = delta * unitPrice;
      add('incl_sous_sol_fini', label, { subject: Math.round(sArea), comp: Math.round(cArea), delta: Math.round(delta), unit: 'pi2', rate: unitPrice, amount,
        explanation: `${label} : ${Math.round(sArea)} pi² (sujet) vs ${Math.round(cArea)} pi² ; à ${unitPrice} $/pi², on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $.` });
      continue;
    }
    const sQty = inclQty(subject.inclusions, key); const cQty = inclQty(c.inclusions, key);
    if (sQty === cQty) continue;
    const delta = sQty - cQty; const amount = delta * unitPrice;
    add(`incl_${key}`, label, { subject: sQty, comp: cQty, delta, unit: '', rate: unitPrice, amount,
      explanation: `« ${label} » : ${sQty} (sujet) vs ${cQty} (comparable) ; à ${unitPrice.toLocaleString('fr-CA')} $/unité, on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(amount).toLocaleString('fr-CA')} $.` });
  }

  // 5) Âge construction (% par année) : (âge comp − âge sujet) × %/an × prix.
  const asOfYear = new Date(asOf).getFullYear();
  const subjYear = n(subject.year_built); const cYear = c.yearBuilt;
  const cpy = n(AG.construction_pct_per_year);
  if (subjYear != null && cYear != null && cpy && price) {
    const delta = (asOfYear - cYear) - (asOfYear - subjYear); // = subjYear - cYear ; comp plus vieux → +
    if (delta !== 0) {
      const amount = delta * cpy * price;
      add('age_construction', 'Âge — construction', { subject: asOfYear - subjYear, comp: asOfYear - cYear, delta, unit: 'an', rate: cpy, amount,
        explanation: `Construction : le comparable a ${Math.abs(delta)} an(s) de ${delta > 0 ? 'plus' : 'moins'} ; à ${(cpy * 100).toFixed(2)} %/an, on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $.` });
    }
  }
  // 5b) Âge fenêtres / toiture : plage neuf↔fin de vie répartie sur la durée de vie.
  const ageRange = [
    ['windows_age', 'Âge — fenêtres', n(AG.windows_range_pct), n(AG.windows_lifespan)],
    ['roof_age', 'Âge — toiture', n(AG.roof_range_pct), n(AG.roof_lifespan)],
  ];
  for (const [field, label, rangePct, life] of ageRange) {
    const sAge = n(subject[field]); const cAge = n(c[field]);
    if (!rangePct || !life || sAge == null || cAge == null || price === 0) continue;
    let frac = (cAge - sAge) / life; frac = Math.max(-1, Math.min(1, frac));
    if (frac === 0) continue;
    const amount = frac * rangePct * price;
    add(`agef_${field}`, label, { subject: sAge, comp: cAge, delta: cAge - sAge, unit: 'an', rate: rangePct, amount,
      explanation: `${label} : ${Math.abs(cAge - sAge)} an(s) d'écart sur une durée de vie de ${life} ans ; plage neuf↔fin ${(rangePct * 100).toFixed(1)} % ; on ${amount >= 0 ? 'ajoute' : 'retranche'} ${Math.abs(Math.round(amount)).toLocaleString('fr-CA')} $.` });
  }

  // 6) Date de vente : appréciation du marché entre la vente et la date d'analyse.
  const months = monthsBetween(c.saleDate, asOf);
  if (months != null && months > 0 && apprec && price) {
    const amount = price * apprec * months;
    add('sale_date', 'Date de vente', { subject: asOf, comp: c.saleDate, delta: round(months, 0.1), unit: 'mois', rate: apprec, amount,
      explanation: `Vendu il y a ${months.toFixed(1)} mois ; à ${(apprec * 100).toFixed(2)} %/mois, on ajoute ${Math.round(amount).toLocaleString('fr-CA')} $.` });
  }

  // Postes « ignorés » par le courtier : conservés (affichage grisé) mais exclus du total/prix ajusté.
  const ig = ignored instanceof Set ? ignored : new Set(ignored || []);
  for (const l of lines) l.ignored = ig.has(l.key);
  const total = lines.reduce((s, l) => s + (l.ignored ? 0 : l.amount), 0);
  const adjustedPrice = price + total;
  return { lines, total, adjustedPrice };
}

/**
 * ACM complète.
 * @param {object} input
 * @param {object} input.subject       { living_area, year_built, inclusions, municipal_assessment }
 * @param {Array}  input.comparables   tous genres (sold|active|expired)
 * @param {object} input.params        paramètres d'ajustement (défauts éditables)
 * @param {string} [input.asOf]        date d'analyse 'YYYY-MM-DD' (défaut : aujourd'hui)
 */
export function computeAcm({ subject = {}, comparables = [], params = {}, asOf, ignored } = {}) {
  const today = asOf || new Date().toISOString().slice(0, 10);
  const warnings = [];
  const outLow = n(params.outlier_low) ?? 0.5;
  const outHigh = n(params.outlier_high) ?? 1.5;

  // ── Comparables VENDUS → ajustements ──
  const soldRaw = comparables.filter((c) => (c.kind || 'sold') === 'sold');
  const sold = soldRaw.map((c) => {
    const nc = normComp(c);
    const { lines, total, adjustedPrice } = adjustComparable(subject, c, params, today, ignored);
    // Garde-fou APCIQ : exclure une transaction hors [50 %–150 %] du dernier prix inscrit.
    let excluded = false; let excludeReason = null;
    if (nc.listPrice && nc.soldPrice) {
      const r = nc.soldPrice / nc.listPrice;
      if (r < outLow || r > outHigh) {
        excluded = true;
        excludeReason = `Prix vendu à ${(r * 100).toFixed(0)} % du prix inscrit (hors ${outLow * 100}–${outHigh * 100} %).`;
      }
    }
    return {
      id: c.id, address: c.address, city: c.city, centris_no: c.centris_no,
      soldPrice: nc.soldPrice, listPrice: nc.listPrice, saleDate: nc.saleDate,
      weight: nc.weight, adjustments: lines, adjustmentsTotal: total, adjustedPrice,
      excluded, excludeReason,
    };
  });

  const included = sold.filter((s) => !s.excluded && s.adjustedPrice != null);
  for (const s of sold.filter((s) => s.excluded)) {
    warnings.push({ level: 'warn', code: 'outlier_excluded', message: `Comparable exclu (${s.address || s.id}) : ${s.excludeReason}` });
  }

  // ── Prix de vente attendu = moyenne pondérée des prix ajustés ──
  let expected = { point: null, low: null, high: null };
  if (included.length) {
    const wSum = included.reduce((s, x) => s + (x.weight || 1), 0);
    const point = included.reduce((s, x) => s + x.adjustedPrice * (x.weight || 1), 0) / (wSum || 1);
    const prices = included.map((x) => x.adjustedPrice);
    expected = { point, low: Math.min(...prices), high: Math.max(...prices) };
  }
  const minTx = n(params.min_transactions) ?? 3;
  if (included.length > 0 && included.length < minTx) {
    warnings.push({ level: 'warn', code: 'few_transactions', message: `Seulement ${included.length} comparable(s) retenu(s) (< ${minTx}). Prudence — résultat moins fiable (avertissement APCIQ).` });
  }
  if (included.length === 0) {
    warnings.push({ level: 'info', code: 'no_sold', message: 'Aucun comparable vendu retenu : ajoutez des ventes pour calculer un prix attendu.' });
  }

  // ── Prix d'inscription proposé (ratio APCIQ prix de vente / prix inscrit) ──
  const ratioSaleList = n(params.sale_to_list_ratio);
  const listingPrice = expected.point != null && ratioSaleList ? expected.point / ratioSaleList : null;

  // ── Corroboration (NE détermine PAS le prix) ──
  const corroboration = { municipal: null, expiredCap: null, activeCompetition: null };

  const ratioAssess = n(params.sale_to_assessment_ratio);
  const subjAssess = n(subject.municipal_assessment);
  if (subjAssess && ratioAssess && expected.point != null) {
    const estimated = subjAssess * ratioAssess;
    const gap = (expected.point - estimated) / expected.point;
    const threshold = n(params.assessment_gap_threshold) ?? 0.15;
    const flag = Math.abs(gap) > threshold;
    corroboration.municipal = { assessment: subjAssess, ratio: ratioAssess, estimated, gap, flag };
    if (flag) {
      warnings.push({ level: 'warn', code: 'assessment_gap', message: `Écart de ${(gap * 100).toFixed(0)} % entre le prix ACM et l'estimation par éval. foncière — à investiguer (soutien seulement, ne fixe pas le prix).` });
    }
  }

  const expired = comparables.filter((c) => c.kind === 'expired').map(normComp);
  const expiredPrices = expired.map((c) => c.listPrice ?? c.soldPrice).filter((v) => v != null);
  if (expiredPrices.length) {
    corroboration.expiredCap = { avg: expiredPrices.reduce((s, v) => s + v, 0) / expiredPrices.length, n: expiredPrices.length };
  }

  const active = comparables.filter((c) => c.kind === 'active').map(normComp);
  const activePrices = active.map((c) => c.listPrice).filter((v) => v != null);
  if (activePrices.length) {
    corroboration.activeCompetition = { avg: activePrices.reduce((s, v) => s + v, 0) / activePrices.length, n: activePrices.length };
  }

  return {
    asOf: today,
    sold,
    includedCount: included.length,
    expected,
    listingPrice,
    corroboration,
    warnings,
  };
}

export default { computeAcm, adjustComparable };
