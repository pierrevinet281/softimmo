// Référentiels géo + zonage pour la page propriété (déterministe, sans IA).
export const COUNTRIES = [
  { v: 'CA', fr: 'Canada', en: 'Canada' },
  { v: 'US', fr: 'États-Unis', en: 'United States' },
];

export const CA_PROVINCES = [
  { v: 'QC', l: 'Québec' }, { v: 'ON', l: 'Ontario' }, { v: 'AB', l: 'Alberta' },
  { v: 'BC', l: 'Colombie-Britannique' }, { v: 'MB', l: 'Manitoba' }, { v: 'NB', l: 'Nouveau-Brunswick' },
  { v: 'NL', l: 'Terre-Neuve-et-Labrador' }, { v: 'NS', l: 'Nouvelle-Écosse' },
  { v: 'PE', l: 'Île-du-Prince-Édouard' }, { v: 'SK', l: 'Saskatchewan' },
  { v: 'NT', l: 'Territoires du Nord-Ouest' }, { v: 'NU', l: 'Nunavut' }, { v: 'YT', l: 'Yukon' },
];

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([v, l]) => ({ v, l }));

export function provincesFor(country) {
  return country === 'US' ? US_STATES : CA_PROVINCES;
}

// Zonage « simple » (catégories reconnues au Québec). La valeur stockée = clé ; complément
// précis (code municipal) saisi dans le 2e champ (zoning_detail).
export const ZONING_OPTIONS = [
  { v: 'residentiel', fr: 'Résidentiel', en: 'Residential' },
  { v: 'commercial', fr: 'Commercial', en: 'Commercial' },
  { v: 'industriel', fr: 'Industriel', en: 'Industrial' },
  { v: 'agricole', fr: 'Agricole (Zone verte)', en: 'Agricultural (Green zone)' },
  { v: 'public', fr: 'Public / Institutionnel', en: 'Public / Institutional' },
  { v: 'villegiature', fr: 'Villégiature', en: 'Resort' },
  { v: 'mixte', fr: 'Mixte ou Utilitaire', en: 'Mixed or Utility' },
  { v: 'conservation', fr: 'Conservation / Récréation', en: 'Conservation / Recreation' },
  { v: 'forestier', fr: 'Forestier', en: 'Forestry' },
  { v: 'autre', fr: 'Autre', en: 'Other' },
];
