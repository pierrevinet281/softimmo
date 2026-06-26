// Moteur financier déterministe pour le Module 1 (Analyse de propriété).
// 100 % calcul (aucun appel IA) : à partir du rent roll (units) et des dépenses,
// dérive revenus bruts → effectifs → RNE, puis les ratios MRB, MRN, TGA, $/porte.
// Fonctions PURES : retournent des données, ne touchent jamais la DB.
//
// Conventions d'entrée (cohérentes avec le schéma) :
//  - units[].rent_monthly  : loyer MENSUEL d'unité
//  - units[].other_income  : revenus accessoires MENSUELS (stationnement, buanderie…)
//  - units[].is_vacant     : 0/1 (vacance réelle constatée)
//  - expenses[].amount + expenses[].period ('annuel' | 'mensuel')
//  - value                 : valeur de référence (prix d'inscription / offre / éval.) — optionnelle.
//                            Sans valeur, MRB/MRN/TGA/$ porte restent null (non calculables).

// ── Paramètres de calcul (défauts éditables, jamais des vérités — voir docs/08) ──
// Taux de vacance structurel par défaut : 0 (on s'appuie d'abord sur la vacance réelle
// du rent roll). Le courtier peut imposer un taux via les paramètres d'analyse.
export const DEFAULT_VACANCY_RATE = 0;
// Seuil d'incohérence du ratio de dépenses : en deçà, on alerte (typique 35-50 %).
export const EXPENSE_RATIO_FLOOR = 0.30;

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const annualize = (amount, period) => num(amount) * (period === 'mensuel' ? 12 : 1);
const ratio = (a, b) => (b ? a / b : null); // null si dénominateur 0/absent (non calculable)

/**
 * Rentabilité d'une propriété (déterministe).
 * @param {object} input
 * @param {Array}  input.units
 * @param {Array}  input.expenses
 * @param {number|null} [input.value]        valeur de référence pour les ratios
 * @param {number} [input.vacancyRate]       taux de vacance structurel (0..1)
 * @returns {object} financials
 */
export function computeProfitability({ units = [], expenses = [], value = null, vacancyRate = DEFAULT_VACANCY_RATE } = {}) {
  const val = value != null && value !== '' ? num(value) : null;
  const vac = Math.min(Math.max(num(vacancyRate), 0), 1);
  const doors = units.length;

  // ── Revenus ──
  let grossRent = 0;        // loyers annualisés (potentiel)
  let otherIncome = 0;      // revenus accessoires annualisés
  let actualVacancyLoss = 0; // perte due aux unités réellement vacantes
  for (const u of units) {
    const annualRent = num(u.rent_monthly) * 12;
    const annualOther = num(u.other_income) * 12;
    grossRent += annualRent;
    otherIncome += annualOther;
    if (Number(u.is_vacant) === 1) actualVacancyLoss += annualRent + annualOther;
  }
  const grossPotentialIncome = grossRent + otherIncome;
  // Vacance structurelle appliquée au revenu encore occupé (évite le double comptage).
  const structuralVacancyLoss = vac * (grossPotentialIncome - actualVacancyLoss);
  const vacancyLoss = actualVacancyLoss + structuralVacancyLoss;
  const effectiveGrossIncome = grossPotentialIncome - vacancyLoss;

  // ── Dépenses d'exploitation ──
  const expenseLines = expenses.map((e) => ({
    id: e.id,
    category: e.category,
    label: e.label || e.category,
    annual: annualize(e.amount, e.period),
  }));
  const operatingExpenses = expenseLines.reduce((s, e) => s + e.annual, 0);

  // ── Résultat net d'exploitation (RNE / NOI) ──
  const netOperatingIncome = effectiveGrossIncome - operatingExpenses;

  // ── Ratios (null tant qu'une valeur de référence n'est pas fournie) ──
  const expenseRatio = ratio(operatingExpenses, effectiveGrossIncome); // OpEx / EGI
  const financials = {
    doors,
    grossRent,
    otherIncome,
    grossPotentialIncome,
    actualVacancyLoss,
    structuralVacancyLoss,
    vacancyLoss,
    vacancyRate: vac,
    effectiveGrossIncome,
    operatingExpenses,
    netOperatingIncome,
    expenseLines,
    expenseRatio,
    value: val,
    // Ratios marché — calculés seulement si `value` est fournie.
    capRate: val ? ratio(netOperatingIncome, val) : null,        // TGA = RNE / valeur
    grossRentMultiplier: val ? ratio(val, grossPotentialIncome) : null, // MRB = valeur / revenus bruts
    netRentMultiplier: val ? ratio(val, netOperatingIncome) : null,     // MRN = valeur / RNE (= 1/TGA)
    pricePerDoor: val && doors ? ratio(val, doors) : null,       // $/porte
    noiPerDoor: doors ? ratio(netOperatingIncome, doors) : null, // RNE par porte
  };
  financials.alerts = profitabilityAlerts(financials);
  return financials;
}

// Contrôles de cohérence sur les chiffres calculés.
function profitabilityAlerts(f) {
  const alerts = [];
  if (f.effectiveGrossIncome > 0 && f.expenseRatio != null && f.expenseRatio < EXPENSE_RATIO_FLOOR) {
    alerts.push({
      level: 'warn',
      code: 'expense_ratio_low',
      message: `Ratio de dépenses de ${(f.expenseRatio * 100).toFixed(1)} % (< ${(EXPENSE_RATIO_FLOOR * 100).toFixed(0)} %). `
        + 'Des dépenses semblent manquantes (taxes, assurances, entretien, gestion, réserve).',
    });
  }
  if (f.netOperatingIncome < 0) {
    alerts.push({ level: 'warn', code: 'noi_negative', message: 'Le RNE est négatif : les dépenses dépassent les revenus effectifs.' });
  }
  if (f.doors > 0 && f.grossPotentialIncome === 0) {
    alerts.push({ level: 'info', code: 'no_rent', message: 'Aucun loyer saisi dans le rent roll — la rentabilité ne peut être calculée.' });
  }
  return alerts;
}

/**
 * Détection déterministe d'anomalies de superficie (Module 1).
 * Compare terrain / empreinte / habitable par bâtiment et la somme des unités.
 * @returns {Array<{level:'warn'|'info', code:string, message:string, building_id?:string}>}
 */
export function detectAreaAnomalies({ property = {}, buildings = [], units = [] } = {}) {
  const anomalies = [];
  const unit = property.area_unit || 'pi2';

  // Cohérence num_buildings déclaré vs bâtiments réellement saisis.
  if (property.num_buildings != null && buildings.length > 0 && Number(property.num_buildings) !== buildings.length) {
    anomalies.push({
      level: 'info',
      code: 'building_count_mismatch',
      message: `La fiche déclare ${property.num_buildings} bâtiment(s) mais ${buildings.length} sont saisis.`,
    });
  }

  for (const b of buildings) {
    const land = num(b.land_area);
    const footprint = num(b.building_area);
    const livable = num(b.livable_area);
    const floorsAbove = Math.max(num(b.floors_above), 1);
    const label = b.label || b.building_type || 'Bâtiment';

    if (!footprint && !livable) {
      anomalies.push({ level: 'info', code: 'area_missing', building_id: b.id, message: `${label} : aucune superficie de bâtiment saisie.` });
    }
    // Empreinte plus grande que le terrain : physiquement impossible.
    if (land && footprint && footprint > land) {
      anomalies.push({
        level: 'warn', code: 'footprint_gt_land', building_id: b.id,
        message: `${label} : empreinte (${footprint} ${unit}) supérieure au terrain (${land} ${unit}).`,
      });
    }
    // Habitable nettement supérieure à empreinte × étages : superficie probablement erronée.
    if (footprint && livable && livable > footprint * floorsAbove * 1.1) {
      anomalies.push({
        level: 'warn', code: 'livable_gt_capacity', building_id: b.id,
        message: `${label} : superficie habitable (${livable} ${unit}) dépasse l'empreinte × étages (${footprint} × ${floorsAbove}). À vérifier.`,
      });
    }
    // Somme des unités du bâtiment vs habitable.
    const buildingUnits = units.filter((u) => u.building_id === b.id);
    const sumUnitArea = buildingUnits.reduce((s, u) => s + num(u.area), 0);
    if (livable && sumUnitArea && sumUnitArea > livable * 1.05) {
      anomalies.push({
        level: 'warn', code: 'units_gt_livable', building_id: b.id,
        message: `${label} : somme des superficies d'unités (${sumUnitArea} ${unit}) supérieure à la superficie habitable (${livable} ${unit}).`,
      });
    }
  }
  return anomalies;
}

export default { computeProfitability, detectAreaAnomalies, DEFAULT_VACANCY_RATE, EXPENSE_RATIO_FLOOR };
