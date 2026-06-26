// Formatage déterministe (fr-CA). Aucune dépendance, aucun appel réseau.
const CAD = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const CAD2 = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 });

export const money = (v, cents = false) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : (cents ? CAD2 : CAD).format(Number(v)));
export const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : NUM.format(Number(v)));
export const num1 = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : NUM1.format(Number(v)));
export const pct = (v, digits = 1) => (v == null || Number.isNaN(Number(v)) ? '—' : `${(Number(v) * 100).toFixed(digits)} %`);
export const mult = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `${NUM1.format(Number(v))}×`);
