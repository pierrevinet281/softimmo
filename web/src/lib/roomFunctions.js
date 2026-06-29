// Fonctions de pièce/unité par groupe de type de propriété (FR/EN). La valeur stockée = `key`
// (stable) ; l'affichage suit la langue. Sert au menu déroulant « Fonction » de l'onglet
// Bâtiments & unités/pièces, adapté au type de propriété.

const RESIDENTIAL = [
  { key: 'cuisine', fr: 'Cuisine', en: 'Kitchen' },
  { key: 'salle_a_diner', fr: 'Salle à dîner', en: 'Dining room' },
  { key: 'salon', fr: 'Salon', en: 'Living room' },
  { key: 'salle_familiale', fr: 'Salle familiale', en: 'Family room' },
  { key: 'chambre', fr: 'Chambre', en: 'Bedroom' },
  { key: 'chambre_principale', fr: 'Chambre principale', en: 'Primary bedroom' },
  { key: 'salle_de_bain', fr: 'Salle de bain', en: 'Bathroom' },
  { key: 'salle_eau', fr: "Salle d'eau", en: 'Powder room' },
  { key: 'bureau', fr: 'Bureau', en: 'Office' },
  { key: 'buanderie', fr: 'Buanderie', en: 'Laundry room' },
  { key: 'vestibule', fr: 'Vestibule', en: 'Foyer' },
  { key: 'lobby', fr: "Hall d'entrée", en: 'Lobby' },
  { key: 'corridor', fr: 'Corridor', en: 'Hallway' },
  { key: 'rangement', fr: 'Rangement', en: 'Storage' },
  { key: 'garde_robe', fr: 'Garde-robe', en: 'Closet' },
  { key: 'walk_in', fr: 'Walk-in', en: 'Walk-in closet' },
  { key: 'sous_sol', fr: 'Sous-sol', en: 'Basement' },
  { key: 'garage', fr: 'Garage', en: 'Garage' },
  { key: 'atelier', fr: 'Atelier', en: 'Workshop' },
  { key: 'mezzanine', fr: 'Mezzanine', en: 'Mezzanine' },
  { key: 'solarium', fr: 'Solarium', en: 'Sunroom' },
  { key: 'veranda', fr: 'Véranda', en: 'Veranda' },
  { key: 'salle_de_jeux', fr: 'Salle de jeux', en: 'Rec room' },
  { key: 'cellier', fr: 'Cellier', en: 'Cellar' },
  { key: 'balcon', fr: 'Balcon', en: 'Balcony' },
  { key: 'terrasse', fr: 'Terrasse', en: 'Terrace' },
  { key: 'autre', fr: 'Autre', en: 'Other' },
];

const COMMERCIAL = [
  { key: 'aire_vente', fr: 'Aire de vente', en: 'Sales floor' },
  { key: 'bureau', fr: 'Bureau', en: 'Office' },
  { key: 'salle_reunion', fr: 'Salle de réunion', en: 'Meeting room' },
  { key: 'reception', fr: 'Réception', en: 'Reception' },
  { key: 'lobby', fr: "Hall d'entrée", en: 'Lobby' },
  { key: 'reserve', fr: 'Entrepôt / Réserve', en: 'Storage / Stockroom' },
  { key: 'cuisine', fr: 'Cuisine', en: 'Kitchen' },
  { key: 'cafeteria', fr: 'Cafétéria', en: 'Cafeteria' },
  { key: 'salle_de_bain', fr: 'Salle de bain', en: 'Restroom' },
  { key: 'local_technique', fr: 'Local technique', en: 'Utility room' },
  { key: 'vestiaire', fr: 'Vestiaire', en: 'Locker room' },
  { key: 'atelier', fr: 'Atelier', en: 'Workshop' },
  { key: 'mezzanine', fr: 'Mezzanine', en: 'Mezzanine' },
  { key: 'autre', fr: 'Autre', en: 'Other' },
];

const INDUSTRIEL = [
  { key: 'entrepot', fr: 'Entrepôt', en: 'Warehouse' },
  { key: 'aire_production', fr: 'Aire de production', en: 'Production area' },
  { key: 'bureau', fr: 'Bureau', en: 'Office' },
  { key: 'quai', fr: 'Quai de chargement', en: 'Loading dock' },
  { key: 'salle_mecanique', fr: 'Salle mécanique / électrique', en: 'Mechanical / electrical room' },
  { key: 'entreposage', fr: 'Entreposage', en: 'Storage' },
  { key: 'laboratoire', fr: 'Laboratoire', en: 'Laboratory' },
  { key: 'salle_de_bain', fr: 'Salle de bain / Vestiaire', en: 'Restroom / Locker' },
  { key: 'mezzanine', fr: 'Mezzanine', en: 'Mezzanine' },
  { key: 'atelier', fr: 'Atelier', en: 'Workshop' },
  { key: 'autre', fr: 'Autre', en: 'Other' },
];

export function functionsForGenre(genre) {
  if (genre === 'commercial') return COMMERCIAL;
  if (genre === 'industriel') return INDUSTRIEL;
  return RESIDENTIAL; // condo, unifamilial, multi, rpa, défaut
}

// Libellé d'une fonction (toutes catégories confondues) par clé, selon la langue.
const ALL = [...RESIDENTIAL, ...COMMERCIAL, ...INDUSTRIEL];
export function functionLabel(key, lang) {
  if (!key) return '';
  const f = ALL.find((o) => o.key === key);
  return f ? (lang === 'en' ? f.en : f.fr) : key;
}
