// Moteur d'analyse de marché local (Module 2 — Analyse de marché). DÉTERMINISTE, sans IA :
// caractérise région administrative / MRC / municipalité / secteur à partir de données publiques.
//
// PHASE 1 (ici) : identification géographique (région/MRC/municipalité depuis le seed Québec) +
// données déjà saisies sur la propriété (zonage, proximité, services). Les indicateurs nécessitant
// une source externe gratuite (Statistique Canada — Recensement 2021 ; OpenStreetMap/Overpass ;
// Données Québec ; SCHL ; APCIQ) sont déclarés avec leur source prévue et le statut « à intégrer »
// (workers Python aux phases suivantes — voir mémoire market-analysis-data-sources).

import { lookupMunicipality, municipalitiesIn } from '../lib/quebecGeo.js';
import { muniDemographics, mrcDemographics, regionDemographics, muniCensus, mrcCensus } from '../lib/quebecDemographics.js';

const SRC = {
  mamh: 'MAMH — Répertoire des municipalités du Québec',
  census: 'Statistique Canada — Recensement 2021 (api.statcan.gc.ca)',
  osm: 'OpenStreetMap / Overpass (ODbL)',
  donneesQc: 'Données Québec (CC-BY 4.0)',
  schl: 'SCHL / CMHC HMIP',
  apciq: 'APCIQ / Centris (niveau RMR/secteur)',
  isq: 'Institut de la statistique du Québec',
};

// Indicateurs socio-économiques (région / MRC / municipalité). Remplis depuis le recensement quand
// disponible (cen = census CSD/CD) ; sinon « à intégrer ». La population vient séparément (MAMH).
function socioIndicators(cen) {
  const emp = cen?.unemployment_rate != null
    ? `Chômage ${cen.unemployment_rate} %${cen.participation_rate != null ? ` · activité ${cen.participation_rate} %` : ''}` : null;
  const growth = cen?.pop_change_pct != null ? `${cen.pop_change_pct > 0 ? '+' : ''}${cen.pop_change_pct} % (2016→2021)` : null;
  let lang = null;
  if (cen?.lang) {
    const l = cen.lang; const tot = (l.fr + l.en + l.both + l.neither) || 1; const p = (x) => Math.round((x / tot) * 100);
    lang = `Bilingue ${p(l.both)} % · français seul. ${p(l.fr)} % · anglais seul. ${p(l.en)} %`;
  }
  return [
    { key: 'demographics', label_fr: 'Démographie (ménages, scolarité)', label_en: 'Demographics (households, education)', value: null, source: SRC.census },
    { key: 'languages', label_fr: 'Langues (connaissance fr/en)', label_en: 'Official languages (knowledge)', value: lang, source: SRC.census },
    { key: 'industries', label_fr: 'Industries / secteurs d’activité', label_en: 'Industries', value: null, source: SRC.census },
    { key: 'economic_index', label_fr: 'Indice d’activité économique', label_en: 'Economic activity index', value: null, source: SRC.isq },
    { key: 'employment', label_fr: 'Marché de l’emploi (chômage / activité)', label_en: 'Labour market (unemployment / participation)', value: emp, source: SRC.census },
    { key: 'vacancy', label_fr: 'Taux d’inoccupation résidentiels', label_en: 'Residential vacancy rate', value: null, source: SRC.schl },
    { key: 'pop_growth', label_fr: 'Croissance de population (2016→2021)', label_en: 'Population change (2016→2021)', value: growth, source: SRC.census },
    { key: 'econ_growth', label_fr: 'Prédictions de croissance économique', label_en: 'Economic growth outlook', value: null, source: SRC.isq },
  ];
}

const item = (label_fr, label_en, value, source) => ({
  label_fr, label_en, value: value ?? null, status: value != null && value !== '' ? 'data' : 'pending', source: source || null,
});

// ── Scores de secteur (0-100) calculés depuis OSM — indicatifs, basés sur la proximité/densité
// des commodités (pas un score propriétaire). Marchabilité façon Local Logic, 100 % gratuit. ──
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function ratingOf(s) {
  if (s >= 80) return { fr: 'Excellent', en: 'Excellent' };
  if (s >= 60) return { fr: 'Très bon', en: 'Very good' };
  if (s >= 40) return { fr: 'Bon', en: 'Good' };
  if (s >= 20) return { fr: 'Moyen', en: 'Fair' };
  return { fr: 'Limité', en: 'Limited' };
}
function dimScore(cat, target) {
  if (!cat) return null;
  const n = cat.count || 0;
  if (!n) return 0;
  const d = cat.nearest?.dist_m;
  const prox = d != null ? clamp((100 * (2500 - d)) / (2500 - 300), 0, 100) : 40;
  const dens = clamp((n / target) * 100, 0, 100);
  return Math.round(0.6 * prox + 0.4 * dens);
}
// Ordre logique : commerces/services quotidiens groupés, puis familles, santé, plein air.
const DIMS = [
  { key: 'errands', fr: 'Épiceries & dépanneurs', en: 'Grocery & convenience', cat: 'groceries', target: 6, w: 0.26 },
  { key: 'pharmacy', fr: 'Pharmacies', en: 'Pharmacies', cat: 'pharmacy', target: 3, w: 0.12 },
  { key: 'gas', fr: 'Stations d’essence', en: 'Gas stations', cat: 'gas', target: 3, w: 0.05 },
  { key: 'dining', fr: 'Restaurants & cafés', en: 'Dining & cafés', cat: 'restaurants', target: 20, w: 0.18 },
  { key: 'schools', fr: 'Écoles & familles', en: 'Schools & families', cat: 'schools', target: 6, w: 0.15 },
  { key: 'childcare', fr: 'Garderies', en: 'Childcare', cat: 'childcare', target: 5, w: 0.05 },
  { key: 'health', fr: 'Santé', en: 'Healthcare', cat: 'hospitals', target: 2, w: 0.07 },
  { key: 'parks', fr: 'Parcs & plein air', en: 'Parks & outdoors', cat: 'parks', target: 10, w: 0.07 },
  { key: 'sports', fr: 'Sports & loisirs', en: 'Sports & recreation', cat: 'sports', target: 6, w: 0.05 },
];

function buildScores(local) {
  if (!local || !local.categories) return { scores: [], walkability: null };
  const scores = [];
  let wsum = 0; let wtot = 0;
  // Connectivité routière (axes majeurs) en tête.
  const roads = local.roads || [];
  if (roads.length) {
    const nearest = roads[0].dist_m;
    const prox = clamp((100 * (6000 - nearest)) / (6000 - 500), 0, 100);
    const dens = clamp((roads.length / 4) * 100, 0, 100);
    const conn = Math.round(0.5 * prox + 0.5 * dens);
    const r = ratingOf(conn);
    scores.push({ key: 'access', label_fr: 'Connectivité routière', label_en: 'Road connectivity', score: conn, rating_fr: r.fr, rating_en: r.en,
      detail_fr: `${roads.length} axe(s) majeur(s) — ${roads[0].name} à ~${roads[0].dist_m} m`, detail_en: `${roads.length} major route(s) — ${roads[0].name} ~${roads[0].dist_m} m` });
  }
  for (const d of DIMS) {
    const s = dimScore(local.categories[d.cat], d.target);
    if (s == null) continue;
    const c = local.categories[d.cat];
    const r = ratingOf(s);
    const detail_fr = c.nearest ? `${c.count} à proximité — ${c.nearest.name} (~${c.nearest.dist_m} m)` : `${c.count} à proximité`;
    const detail_en = c.nearest ? `${c.count} nearby — ${c.nearest.name} (~${c.nearest.dist_m} m)` : `${c.count} nearby`;
    scores.push({ key: d.key, label_fr: d.fr, label_en: d.en, score: s, rating_fr: r.fr, rating_en: r.en, detail_fr, detail_en, count: c.count, top: (c.items || []).slice(0, 5) });
    if (d.w) { wsum += s * d.w; wtot += d.w; }
  }
  return { scores, walkability: wtot ? Math.round(wsum / wtot) : null };
}

function buildOverview(walk, scores, geo) {
  if (walk == null) return null;
  const r = ratingOf(walk);
  const top = [...scores].filter((s) => s.key !== 'access').sort((a, b) => b.score - a.score).slice(0, 2);
  const topFr = top.map((s) => s.label_fr.toLowerCase()).join(' et ');
  const topEn = top.map((s) => s.label_en.toLowerCase()).join(' and ');
  const where = geo.municipality || 'la propriété';
  const summary_fr = `Le secteur de ${where} se distingue surtout par ${topFr}.`;
  const summary_en = `The ${geo.municipality || 'property'} area stands out for ${topEn}.`;
  let vi_fr; let vi_en;
  if (walk >= 70) {
    vi_fr = "Un secteur aussi bien pourvu en services soutient la valeur et la liquidité : il élargit le bassin d'acheteurs et justifie une prime de localisation.";
    vi_en = 'Such a well-serviced area supports value and liquidity: it broadens the buyer pool and justifies a location premium.';
  } else if (walk >= 45) {
    vi_fr = 'Un secteur correctement desservi : la localisation est un atout neutre à légèrement positif sur la valeur.';
    vi_en = 'A reasonably serviced area: location is a neutral-to-slightly-positive factor on value.';
  } else {
    vi_fr = "Secteur moins dense en services : la valeur repose davantage sur les qualités propres du bien (terrain, superficie, état) que sur la localisation piétonne.";
    vi_en = 'A less amenity-dense area: value relies more on the property itself (lot, size, condition) than on walkable location.';
  }
  return { walkability: walk, rating_fr: r.fr, rating_en: r.en, summary_fr, summary_en, value_impact_fr: vi_fr, value_impact_en: vi_en };
}

/**
 * Construit le squelette d'analyse de marché pour une propriété.
 * @param {{property:object, attrs?:object}} input
 * @returns {object} rapport structuré (JSON) prêt à persister et à rendre.
 */
export function buildMarketAnalysis({ property = {}, attrs = {}, local = null } = {}) {
  const city = property.city || attrs.sector || '';
  const muni = lookupMunicipality(city);
  const region = property.region || muni?.region || null;
  const mrc = property.mrc || muni?.mrc || null;

  // POI OSM (couche locale) → libellé « N à proximité — plus proche : X (~Y m) ».
  const poi = (catKey, label_fr, label_en) => {
    const c = local?.categories?.[catKey];
    if (!c) return item(label_fr, label_en, null, SRC.osm);
    const near = c.nearest ? ` — plus proche : ${c.nearest.name} (~${c.nearest.dist_m} m)` : '';
    return { label_fr, label_en, value: `${c.count} à proximité${near}`, status: 'data', source: SRC.osm };
  };
  const roadAccess = () => {
    if (local?.roads?.length) {
      const v = local.roads.map((r) => `${r.name} (${r.type}, ~${r.dist_m} m)`).join(' ; ');
      return { label_fr: 'Accès routiers (autoroutes/axes)', label_en: 'Road access (highways/arteries)', value: v, status: 'data', source: SRC.osm };
    }
    return item('Accès routiers (autoroutes/axes)', 'Road access (highways/arteries)', attrs.proximity || attrs.highway_access || null, SRC.osm);
  };

  const inMrc = mrc ? municipalitiesIn({ mrc }).map((m) => m.name) : [];
  const inRegion = region ? municipalitiesIn({ region }).map((m) => m.name) : [];

  const geoList = (names) => (names.length ? `${names.length} municipalité(s) : ${names.slice(0, 25).join(', ')}${names.length > 25 ? '…' : ''}` : null);

  // Démographie MAMH (population/superficie/gentilé + agrégats MRC/région).
  const demMuni = muniDemographics(muni?.name || city);
  const demMrc = mrcDemographics(mrc);
  const demReg = regionDemographics(region);
  const cenMuni = muniCensus(muni?.name || city);
  const cenMrc = mrcCensus(mrc);
  const fmtPop = (p) => (p != null ? `${Number(p).toLocaleString('fr-CA')} hab.` : null);
  const fmtMoney = (v) => (v != null ? `${Number(v).toLocaleString('fr-CA')} $` : null);
  const fmtAge = (v) => (v != null ? `${v} ans` : null);
  const density = (demMuni && demMuni.pop && demMuni.area) ? Math.round(demMuni.pop / demMuni.area) : null;

  const sections = [
    {
      key: 'region', label_fr: 'Région administrative', label_en: 'Administrative region',
      items: [
        item('Emplacement géographique', 'Geographic location', region, SRC.donneesQc),
        item('Population (région)', 'Population (region)', fmtPop(demReg?.pop), SRC.mamh),
        item('Nombre de municipalités', 'Number of municipalities', demReg?.n_munis ?? null, SRC.mamh),
        item('Nombre de MRC', 'Number of MRCs', demReg?.n_mrc ?? null, SRC.mamh),
        item('Principales municipalités', 'Main municipalities', geoList(inRegion), SRC.donneesQc),
        ...socioIndicators(null).map((s) => item(s.label_fr, s.label_en, s.value, s.source)),
      ],
    },
    {
      key: 'mrc', label_fr: 'MRC', label_en: 'Regional county municipality (MRC)',
      items: [
        item('Emplacement géographique', 'Geographic location', mrc, SRC.donneesQc),
        item('Population (MRC)', 'Population (MRC)', fmtPop(demMrc?.pop), SRC.mamh),
        item('Âge médian', 'Median age', fmtAge(cenMrc?.median_age), SRC.census),
        item('Revenu médian des ménages', 'Median household income', fmtMoney(cenMrc?.median_hh_income), SRC.census),
        item('Nombre de municipalités', 'Number of municipalities', demMrc?.n_munis ?? null, SRC.mamh),
        item('Municipalités de la MRC', 'Municipalities in the MRC', geoList(inMrc), SRC.donneesQc),
        ...socioIndicators(cenMrc).map((s) => item(s.label_fr, s.label_en, s.value, s.source)),
        item('Autres données caractérisant la MRC', 'Other MRC characteristics', null, SRC.isq),
      ],
    },
    {
      key: 'municipality', label_fr: 'Municipalité', label_en: 'Municipality',
      items: [
        item('Nom', 'Name', muni?.name || city || null, SRC.donneesQc),
        item('Population', 'Population', fmtPop(demMuni?.pop), SRC.mamh),
        item('Superficie', 'Land area', demMuni?.area != null ? `${demMuni.area} km²` : null, SRC.mamh),
        item('Densité', 'Density', density != null ? `${density.toLocaleString('fr-CA')} hab./km²` : null, SRC.mamh),
        item('Gentilé', 'Demonym', demMuni?.gentile || null, SRC.mamh),
        item('Âge médian', 'Median age', fmtAge(cenMuni?.median_age), SRC.census),
        item('Revenu médian des ménages', 'Median household income', fmtMoney(cenMuni?.median_hh_income), SRC.census),
        item('Nombre d’entreprises', 'Number of businesses', null, SRC.donneesQc),
        item('Principales entreprises', 'Main businesses', null, SRC.osm),
        ...socioIndicators(cenMuni).map((s) => item(s.label_fr, s.label_en, s.value, s.source)),
        item('Statistiques de marché (prix médian, ventes, délais)', 'Market stats (median price, sales, DOM)', null, SRC.apciq),
      ],
    },
    {
      key: 'secteur', label_fr: 'Secteur (proximité)', label_en: 'Neighbourhood (proximity)',
      items: [
        poi('hospitals', 'Hôpitaux / cliniques à proximité', 'Nearby hospitals / clinics'),
        poi('schools', 'Universités / CÉGEP / écoles', 'Universities / colleges / schools'),
        poi('childcare', 'Garderies / CPE à proximité', 'Nearby childcare'),
        poi('groceries', 'Épiceries à proximité', 'Nearby grocery stores'),
        poi('restaurants', 'Restaurants / cafés à proximité', 'Nearby restaurants / cafés'),
        poi('sports', 'Centres sportifs à proximité', 'Nearby sports facilities'),
        poi('parks', 'Parcs / espaces verts', 'Parks / green space'),
      ],
    },
    {
      key: 'access', label_fr: 'Accès routiers & services', label_en: 'Road access & services',
      items: [
        roadAccess(),
        item('Zonage', 'Zoning', property.zoning_detail || attrs.zoning || null, null),
        item('Services municipaux', 'Municipal services', Array.isArray(attrs.services_muni) ? attrs.services_muni.join(', ') : (attrs.services_muni || null), null),
      ],
    },
  ];

  // Ordre de présentation : du plus local au plus large (secteur → accès → municipalité → MRC → région).
  const SECTION_ORDER = ['secteur', 'access', 'municipality', 'mrc', 'region'];
  sections.sort((a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key));

  const dataCount = sections.reduce((s, sec) => s + sec.items.filter((i) => i.status === 'data').length, 0);
  const pendingCount = sections.reduce((s, sec) => s + sec.items.filter((i) => i.status === 'pending').length, 0);

  const geoObj = {
    municipality: muni?.name || city || null, mrc, region,
    lat: local?.lat ?? null, lon: local?.lon ?? null, display_name: local?.display_name || null,
    radius_m: local?.radius_m ?? null,
    population: demMuni?.pop ?? null, density, area_km2: demMuni?.area ?? null, gentile: demMuni?.gentile ?? null,
    median_age: cenMuni?.median_age ?? null, median_hh_income: cenMuni?.median_hh_income ?? null,
  };
  const { scores, walkability } = buildScores(local);
  const overview = buildOverview(walkability, scores, geoObj);

  return {
    version: 2,
    title: `Analyse de marché — ${muni?.name || city || property.name || 'propriété'}`,
    geo: geoObj,
    overview,            // synthèse + impact sur la valeur (null si pas de couche locale)
    scores,              // scores de secteur 0-100 (marchabilité, connectivité, services…)
    walkability,
    poi: local?.categories || null,   // commodités structurées (grille visuelle)
    roads: local?.roads || null,      // axes routiers (+ écusson `sign` si autoroute)
    images: local?.images || null,    // photos ville/région (Wikipédia, avec licence/crédit)
    charts: {                          // distributions recensement (municipalité) pour graphiques
      age: cenMuni?.age_buckets || null,
      income: cenMuni?.income_brackets || null,
      lang: cenMuni?.lang ? [
        { label: 'Français seul.', count: cenMuni.lang.fr },
        { label: 'Bilingue', count: cenMuni.lang.both },
        { label: 'Anglais seul.', count: cenMuni.lang.en },
        { label: 'Ni l’un/l’autre', count: cenMuni.lang.neither },
      ] : null,
    },
    sections,            // grille détaillée (région/MRC/municipalité/secteur/accès)
    summary: { data_points: dataCount, pending_points: pendingCount, local: !!local },
    sources: SRC,
  };
}

export default { buildMarketAnalysis };
