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

// Une inclusion peut être un tableau de clés ou un objet {clé: truthy}.
function hasIncl(inclusions, key) {
  if (!inclusions) return false;
  if (Array.isArray(inclusions)) return inclusions.includes(key);
  return !!inclusions[key];
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
export function adjustComparable(subject, comp, params, asOf) {
  const lines = [];
  const c = normComp(comp);
  const cost = n(params.construction_cost_per_sqft) ?? 0;
  const ageRate = n(params.age_adjustment_per_year) ?? 0;
  const apprec = n(params.monthly_appreciation_pct) ?? 0;

  // 1) Superficie habitable : (sujet − comp) × coût de construction.
  const subjArea = n(subject.living_area);
  if (subjArea != null && c.livingArea != null && cost) {
    const delta = subjArea - c.livingArea;
    const amount = delta * cost;
    lines.push({
      key: 'living_area', label: 'Superficie habitable',
      subject: subjArea, comp: c.livingArea, delta, unit: 'pi2', rate: cost, amount,
      explanation: `Le sujet fait ${subjArea} pi² contre ${c.livingArea} pi² pour le comparable `
        + `(écart ${delta > 0 ? '+' : ''}${delta} pi²) ; à ${cost} $/pi², on ${amount >= 0 ? 'ajoute' : 'retranche'} `
        + `${Math.abs(amount).toLocaleString('fr-CA')} $ pour le ramener au sujet.`,
    });
  }

  // 2) Inclusions : pour chaque élément où sujet ≠ comparable, ± valeur marché.
  const inclPrices = params.inclusions || {};
  for (const [key, priceRaw] of Object.entries(inclPrices)) {
    const price = n(priceRaw);
    if (!price) continue;
    const sHas = hasIncl(subject.inclusions, key);
    const cHas = hasIncl(c.inclusions, key);
    if (sHas === cHas) continue;
    const delta = (sHas ? 1 : 0) - (cHas ? 1 : 0); // +1 si le sujet l'a en plus, −1 sinon
    const amount = delta * price;
    lines.push({
      key: `incl_${key}`, label: prettyIncl(key),
      subject: sHas ? 'oui' : 'non', comp: cHas ? 'oui' : 'non', delta, unit: '', rate: price, amount,
      explanation: sHas
        ? `Le sujet possède « ${prettyIncl(key)} », pas le comparable : on ajoute ${price.toLocaleString('fr-CA')} $.`
        : `Le comparable possède « ${prettyIncl(key)} », pas le sujet : on retranche ${price.toLocaleString('fr-CA')} $.`,
    });
  }

  // 3) Âge du bâtiment : (âge comp − âge sujet) × ajustement/an.
  const asOfYear = new Date(asOf).getFullYear();
  const subjYear = n(subject.year_built);
  if (subjYear != null && c.yearBuilt != null && ageRate) {
    const subjAge = asOfYear - subjYear;
    const compAge = asOfYear - c.yearBuilt;
    const delta = compAge - subjAge; // comp plus vieux → positif → on remonte le comp
    const amount = delta * ageRate;
    if (delta !== 0) {
      lines.push({
        key: 'age', label: 'Âge du bâtiment',
        subject: subjAge, comp: compAge, delta, unit: 'an', rate: ageRate, amount,
        explanation: `Le comparable a ${Math.abs(delta)} an(s) de ${delta > 0 ? 'plus' : 'moins'} que le sujet ; `
          + `à ${ageRate.toLocaleString('fr-CA')} $/an, on ${amount >= 0 ? 'ajoute' : 'retranche'} `
          + `${Math.abs(amount).toLocaleString('fr-CA')} $.`,
      });
    }
  }

  // 4) Date de vente : appréciation du marché entre la vente et la date d'analyse.
  const months = monthsBetween(c.saleDate, asOf);
  if (months != null && months > 0 && apprec && c.soldPrice != null) {
    const amount = c.soldPrice * apprec * months;
    lines.push({
      key: 'sale_date', label: 'Date de vente',
      subject: asOf, comp: c.saleDate, delta: round(months, 0.1), unit: 'mois', rate: apprec, amount,
      explanation: `Vendu il y a ${months.toFixed(1)} mois ; à ${(apprec * 100).toFixed(2)} %/mois d'appréciation, `
        + `on ajoute ${Math.round(amount).toLocaleString('fr-CA')} $ pour l'amener à aujourd'hui.`,
    });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const adjustedPrice = (c.soldPrice ?? 0) + total;
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
export function computeAcm({ subject = {}, comparables = [], params = {}, asOf } = {}) {
  const today = asOf || new Date().toISOString().slice(0, 10);
  const warnings = [];
  const outLow = n(params.outlier_low) ?? 0.5;
  const outHigh = n(params.outlier_high) ?? 1.5;

  // ── Comparables VENDUS → ajustements ──
  const soldRaw = comparables.filter((c) => (c.kind || 'sold') === 'sold');
  const sold = soldRaw.map((c) => {
    const nc = normComp(c);
    const { lines, total, adjustedPrice } = adjustComparable(subject, c, params, today);
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
