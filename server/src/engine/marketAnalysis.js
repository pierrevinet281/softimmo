// Moteur d'analyse de marché local (Module 2 — Analyse de marché). DÉTERMINISTE, sans IA :
// caractérise région administrative / MRC / municipalité / secteur à partir de données publiques.
//
// PHASE 1 (ici) : identification géographique (région/MRC/municipalité depuis le seed Québec) +
// données déjà saisies sur la propriété (zonage, proximité, services). Les indicateurs nécessitant
// une source externe gratuite (Statistique Canada — Recensement 2021 ; OpenStreetMap/Overpass ;
// Données Québec ; SCHL ; APCIQ) sont déclarés avec leur source prévue et le statut « à intégrer »
// (workers Python aux phases suivantes — voir mémoire market-analysis-data-sources).

import { lookupMunicipality, municipalitiesIn } from '../lib/quebecGeo.js';

const SRC = {
  census: 'Statistique Canada — Recensement 2021 (api.statcan.gc.ca)',
  osm: 'OpenStreetMap / Overpass (ODbL)',
  donneesQc: 'Données Québec (CC-BY 4.0)',
  schl: 'SCHL / CMHC HMIP',
  apciq: 'APCIQ / Centris (niveau RMR/secteur)',
  isq: 'Institut de la statistique du Québec',
};

// Indicateurs socio-économiques communs (région / MRC / municipalité). value=null → à intégrer.
function socioIndicators() {
  return [
    { key: 'population', label_fr: 'Population', label_en: 'Population', source: SRC.census },
    { key: 'demographics', label_fr: 'Démographie (âge, ménages, scolarité, langues)', label_en: 'Demographics', source: SRC.census },
    { key: 'industries', label_fr: 'Industries / secteurs d’activité', label_en: 'Industries', source: SRC.census },
    { key: 'economic_index', label_fr: 'Indice d’activité économique', label_en: 'Economic activity index', source: SRC.isq },
    { key: 'employment', label_fr: 'Marché de l’emploi (taux d’emploi/chômage)', label_en: 'Labour market', source: SRC.isq },
    { key: 'vacancy', label_fr: 'Taux d’inoccupation résidentiels', label_en: 'Residential vacancy rate', source: SRC.schl },
    { key: 'pop_growth', label_fr: 'Prédictions de croissance de population', label_en: 'Population growth outlook', source: SRC.isq },
    { key: 'econ_growth', label_fr: 'Prédictions de croissance économique', label_en: 'Economic growth outlook', source: SRC.isq },
  ];
}

const item = (label_fr, label_en, value, source) => ({
  label_fr, label_en, value: value ?? null, status: value != null && value !== '' ? 'data' : 'pending', source: source || null,
});

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

  const sections = [
    {
      key: 'region', label_fr: 'Région administrative', label_en: 'Administrative region',
      items: [
        item('Emplacement géographique', 'Geographic location', region, SRC.donneesQc),
        item('Principales municipalités', 'Main municipalities', geoList(inRegion), SRC.donneesQc),
        ...socioIndicators().map((s) => item(s.label_fr, s.label_en, null, s.source)),
      ],
    },
    {
      key: 'mrc', label_fr: 'MRC', label_en: 'Regional county municipality (MRC)',
      items: [
        item('Emplacement géographique', 'Geographic location', mrc, SRC.donneesQc),
        item('Municipalités de la MRC', 'Municipalities in the MRC', geoList(inMrc), SRC.donneesQc),
        ...socioIndicators().map((s) => item(s.label_fr, s.label_en, null, s.source)),
        item('Autres données caractérisant la MRC', 'Other MRC characteristics', null, SRC.isq),
      ],
    },
    {
      key: 'municipality', label_fr: 'Municipalité', label_en: 'Municipality',
      items: [
        item('Nom', 'Name', muni?.name || city || null, SRC.donneesQc),
        item('Nombre d’entreprises', 'Number of businesses', null, SRC.donneesQc),
        item('Principales entreprises', 'Main businesses', null, SRC.osm),
        ...socioIndicators().map((s) => item(s.label_fr, s.label_en, null, s.source)),
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

  const dataCount = sections.reduce((s, sec) => s + sec.items.filter((i) => i.status === 'data').length, 0);
  const pendingCount = sections.reduce((s, sec) => s + sec.items.filter((i) => i.status === 'pending').length, 0);

  return {
    version: 1,
    title: `Analyse de marché — ${muni?.name || city || property.name || 'propriété'}`,
    geo: {
      municipality: muni?.name || city || null, mrc, region,
      lat: local?.lat ?? null, lon: local?.lon ?? null, display_name: local?.display_name || null,
      radius_m: local?.radius_m ?? null,
    },
    sections,
    summary: { data_points: dataCount, pending_points: pendingCount, local: !!local },
    sources: SRC,
  };
}

export default { buildMarketAnalysis };
