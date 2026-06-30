// Jeux d'options (bilingues FR/EN) + unités pour les champs riches de Property Overview.
// Référencés par clé `optset` dans la taxonomie (sales-attributes.seed.json) et résolus par
// AttrField. Marché immobilier québécois. Déterministe, sans IA.

export const UNIT_LIN = [{ v: 'pi', l: 'pi' }, { v: 'm', l: 'm' }];
export const UNIT_AREA = [{ v: 'pi2', l: 'pi²' }, { v: 'm2', l: 'm²' }];

const O = (v, fr, en) => ({ v, fr, en });

// Styles architecturaux : 5 populaires en tête, puis ordre alphabétique (FR).
const ARCH = [
  O('contemporain', 'Contemporain', 'Contemporary'),
  O('moderne', 'Moderne', 'Modern'),
  O('cottage', 'Cottage', 'Cottage'),
  O('canadienne', 'Canadienne', 'Canadiana'),
  O('champetre', 'Champêtre', 'Country'),
  O('art_deco', 'Art déco', 'Art Deco'),
  O('cape_cod', 'Cape Cod', 'Cape Cod'),
  O('cathedrale', 'Cathédrale (plafond cathédrale)', 'Cathedral'),
  O('colonial', 'Colonial', 'Colonial'),
  O('craftsman', 'Craftsman', 'Craftsman'),
  O('farmhouse', 'Farmhouse moderne', 'Modern farmhouse'),
  O('georgien', 'Géorgien', 'Georgian'),
  O('industriel', 'Industriel (loft)', 'Industrial (loft)'),
  O('mansarde', 'Mansardé', 'Mansard'),
  O('mediterraneen', 'Méditerranéen', 'Mediterranean'),
  O('neoclassique', 'Néoclassique', 'Neoclassical'),
  O('plain_pied', 'Plain-pied (bungalow)', 'Single-storey (bungalow)'),
  O('ranch', 'Ranch', 'Ranch'),
  O('rustique', 'Rustique', 'Rustic'),
  O('scandinave', 'Scandinave', 'Scandinavian'),
  O('traditionnel', 'Traditionnel', 'Traditional'),
  O('tudor', 'Tudor', 'Tudor'),
  O('victorien', 'Victorien', 'Victorian'),
  O('autre', 'Autre', 'Other'),
];

const FLOORING = [
  O('bois_franc', 'Bois franc', 'Hardwood'), O('bois_ingenierie', "Bois d'ingénierie", 'Engineered wood'),
  O('flottant', 'Plancher flottant (stratifié)', 'Laminate (floating)'), O('vinyle_luxe', 'Vinyle de luxe (LVP)', 'Luxury vinyl (LVP)'),
  O('vinyle', 'Vinyle / Prélart', 'Vinyl / Sheet vinyl'), O('liege', 'Liège', 'Cork'), O('bambou', 'Bambou', 'Bamboo'),
  O('ceramique', 'Céramique', 'Ceramic tile'), O('porcelaine', 'Porcelaine', 'Porcelain tile'), O('ardoise', 'Ardoise', 'Slate'),
  O('marbre', 'Marbre', 'Marble'), O('granit', 'Granit', 'Granite'), O('terrazzo', 'Terrazzo', 'Terrazzo'),
  O('tapis', 'Tapis / Moquette', 'Carpet'), O('linoleum', 'Linoléum', 'Linoleum'), O('epoxy', 'Époxy', 'Epoxy'),
  O('beton_poli', 'Béton poli', 'Polished concrete'), O('beton', 'Béton', 'Concrete'), O('autre', 'Autre', 'Other'),
];

const HEATING = [
  O('fournaise_gaz', 'Fournaise au gaz naturel', 'Natural gas furnace'),
  O('fournaise_electrique', 'Fournaise électrique', 'Electric furnace'),
  O('fournaise_mazout', 'Fournaise au mazout', 'Oil furnace'),
  O('thermopompe_centrale', 'Thermopompe centrale', 'Central heat pump'),
  O('thermopompe_murale', 'Thermopompe murale', 'Wall-mounted heat pump'),
  O('plinthes_elec', 'Calorifères électriques (plinthes)', 'Electric baseboards'),
  O('calorifere_mazout', 'Calorifères au mazout (diesel)', 'Oil heaters'),
  O('plancher_radiant', 'Plancher radiant', 'Radiant floor'),
  O('bouilloire', 'Bouilloire à eau chaude', 'Hot water boiler'),
  O('geothermie', 'Géothermie', 'Geothermal'),
  O('foyer_gaz', 'Foyer au gaz naturel', 'Natural gas fireplace'),
  O('foyer_propane', 'Foyer au propane', 'Propane fireplace'),
  O('foyer_bois', 'Foyer au bois', 'Wood fireplace'),
  O('granules', 'Poêle/foyer à granules', 'Pellet stove/fireplace'),
  O('autre', 'Autre', 'Other'),
];

// Énergie dérivée par système de chauffage (pour heating_energy auto, non éditable).
const SYSTEM_ENERGY = {
  fournaise_gaz: 'gaz_naturel', foyer_gaz: 'gaz_naturel', foyer_propane: 'propane',
  fournaise_electrique: 'electricite', thermopompe_centrale: 'electricite', thermopompe_murale: 'electricite',
  plinthes_elec: 'electricite', plancher_radiant: 'electricite', geothermie: 'electricite',
  fournaise_mazout: 'mazout', calorifere_mazout: 'mazout', foyer_bois: 'bois', granules: 'granules',
};
const ENERGY = {
  electricite: O('electricite', 'Électricité', 'Electricity'), gaz_naturel: O('gaz_naturel', 'Gaz naturel', 'Natural gas'),
  propane: O('propane', 'Propane', 'Propane'), bois: O('bois', 'Bois', 'Wood'), mazout: O('mazout', 'Mazout', 'Oil'),
  granules: O('granules', 'Granules', 'Pellets'),
};

export const OPTION_SETS = {
  arch_style: ARCH,
  flooring: FLOORING,
  heating_system: HEATING,
  services_muni: [
    O('aqueduc', 'Aqueduc municipal', 'Municipal water'), O('egout', 'Égout municipal', 'Municipal sewer'),
    O('puits_artesien', 'Puits artésien', 'Artesian well'), O('puits_surface', 'Puits de surface', 'Surface well'),
    O('fosse_septique', 'Fosse septique', 'Septic tank'), O('champ_epuration', "Champ d'épuration", 'Leaching field'),
    O('puisard', 'Puisard', 'Dry well'),
  ],
  parking_type: [
    O('exterieur', 'Extérieur', 'Outdoor'), O('interieur', 'Intérieur', 'Indoor'), O('les_deux', 'Intérieur + extérieur', 'Indoor + outdoor'),
  ],
  structure: [
    O('charpente', 'Charpente de bois', 'Wood frame'), O('acier', 'Acier', 'Steel'), O('beton', 'Béton', 'Concrete'),
    O('beton_arme', 'Béton armé', 'Reinforced concrete'), O('blocs_beton', 'Blocs de béton', 'Concrete block'),
    O('hybride', 'Hybride (bois-acier)', 'Hybrid (wood-steel)'), O('autre', 'Autre', 'Other'),
  ],
  foundation: [
    O('beton', 'Béton coulé', 'Poured concrete'), O('blocs', 'Blocs de béton', 'Concrete block'),
    O('pieux', 'Pieux / pilotis', 'Piles / pilings'), O('dalle', 'Dalle sur sol', 'Slab on grade'),
    O('bois', 'Bois traité', 'Treated wood'), O('pierre', 'Pierre', 'Stone'), O('na', 'N/A', 'N/A'),
  ],
  ext_cladding: [
    O('pierre', 'Pierre', 'Stone'), O('brique', 'Brique', 'Brick'), O('acier', 'Acier', 'Steel'),
    O('aluminium', 'Aluminium', 'Aluminum'), O('vinyle', 'Vinyle', 'Vinyl'), O('bois', 'Bois', 'Wood'),
    O('fibrociment', 'Fibrociment (CanExel)', 'Fiber cement'), O('stuc', 'Stuc / crépi', 'Stucco'),
    O('composite', 'Composite', 'Composite'), O('beton', 'Béton', 'Concrete'), O('autre', 'Autre', 'Other'),
  ],
  roofing_type: [
    O('plat', 'Toit plat', 'Flat'), O('pente', 'Toit en pente', 'Sloped'), O('deux_versants', 'Deux versants (pignon)', 'Gable'),
    O('quatre_versants', 'Quatre versants (en croupe)', 'Hip'), O('mansarde', 'Mansardé', 'Mansard'),
    O('cathedrale', 'Cathédrale', 'Cathedral'), O('combine', 'Combiné', 'Combined'), O('autre', 'Autre', 'Other'),
  ],
  roofing_material: [
    O('bardeau_asphalte', "Bardeaux d'asphalte", 'Asphalt shingles'), O('elastomere', 'Membrane élastomère', 'Elastomeric membrane'),
    O('tpo', 'Membrane TPO', 'TPO membrane'), O('epdm', 'Membrane EPDM', 'EPDM membrane'),
    O('goudron_gravier', 'Goudron et gravier', 'Tar and gravel'), O('tole', 'Tôle (acier)', 'Metal'),
    O('bardeau_cedre', 'Bardeaux de cèdre', 'Cedar shingles'), O('ardoise', 'Ardoise', 'Slate'), O('autre', 'Autre', 'Other'),
  ],
  windows_types: [
    O('fixes', 'Panneaux fixes', 'Fixed'), O('coulissantes', 'Coulissantes', 'Sliding'), O('battantes', 'Battantes', 'Casement'),
    O('guillotine', 'À guillotine', 'Hung'), O('auvent', 'À auvent', 'Awning'), O('manivelle', 'À manivelle', 'Crank'),
    O('francaises', 'Françaises', 'French'), O('baie', 'Fenêtre en baie', 'Bay'), O('autre', 'Autre', 'Other'),
  ],
  windows_material: [
    O('aluminium', 'Aluminium', 'Aluminum'), O('pvc', 'PVC', 'PVC'), O('hybride', 'Hybride', 'Hybrid'),
    O('bois', 'Bois', 'Wood'), O('acier', 'Acier', 'Steel'), O('fibre_verre', 'Fibre de verre', 'Fiberglass'), O('autre', 'Autre', 'Other'),
  ],
  windows_glass: [
    O('double_thermos', 'Double avec thermos', 'Double glazed (sealed)'),
    O('simple', 'Simple sans thermos', 'Single (no seal)'),
    O('triple_thermos', 'Triple avec thermos', 'Triple glazed'), O('autre', 'Autre', 'Other'),
  ],
  basement: [
    O('complete', 'Complété', 'Finished'), O('non_complete', 'Non complété', 'Unfinished'),
    O('partiel', 'Partiellement complété', 'Partially finished'), O('vide_sanitaire', 'Vide sanitaire', 'Crawl space'),
    O('aucun', 'Aucun (dalle)', 'None (slab)'),
  ],
  stove: [
    O('aucun', 'Aucun', 'None'), O('gaz_naturel', 'Poêle au gaz naturel', 'Natural gas stove'),
    O('propane', 'Poêle au propane', 'Propane stove'), O('electrique', 'Poêle électrique', 'Electric stove'),
    O('bois', 'Poêle à bois', 'Wood stove'), O('granules', 'Poêle à granules', 'Pellet stove'),
  ],
  pool_location: [O('interieur', 'Intérieur', 'Indoor'), O('exterieur', 'Extérieur', 'Outdoor'), O('solarium', 'Solarium', 'Sunroom')],
  pool_type: [O('creusee', 'Creusée', 'Inground'), O('semi_creusee', 'Semi-creusée', 'Semi-inground'), O('hors_terre', 'Hors terre', 'Above ground')],
  cooling_type: [
    O('thermopompe_centrale', 'Thermopompe centrale', 'Central heat pump'),
    O('thermopompe_murale', 'Thermopompe murale', 'Wall-mounted heat pump'),
    O('climatiseur_central', 'Climatiseur central', 'Central air conditioner'),
    O('climatiseur_fenetre', 'Climatiseur de fenêtre', 'Window air conditioner'),
    O('geothermie', 'Géothermie', 'Geothermal'), O('autre', 'Autre', 'Other'),
  ],
  countertops: [
    O('granite', 'Granite', 'Granite'), O('quartz', 'Quartz', 'Quartz'), O('marbre', 'Marbre', 'Marble'),
    O('bois', 'Bois (bloc boucher)', 'Wood (butcher block)'), O('stratifie', 'Stratifié', 'Laminate'),
    O('melamine', 'Mélamine', 'Melamine'), O('beton', 'Béton', 'Concrete'), O('ceramique', 'Céramique', 'Ceramic'),
    O('acier_inox', 'Acier inoxydable', 'Stainless steel'), O('corian', 'Surface solide (Corian)', 'Solid surface (Corian)'),
    O('autre', 'Autre', 'Other'),
  ],
  heating_zone: [
    O('living', 'Espace de vie', 'Living area'), O('garage', 'Garage', 'Garage'), O('sous_sol', 'Sous-sol', 'Basement'),
    O('whole', 'Tout le bâtiment', 'Whole building'), O('other', 'Autre', 'Other'),
  ],
};

export function optionsFor(optset) {
  return OPTION_SETS[optset] || [];
}
export function labelOf(optset, value, lang) {
  if (value == null || value === '') return '';
  const o = (OPTION_SETS[optset] || []).find((x) => x.v === value);
  return o ? (lang === 'en' ? o.en : o.fr) : value;
}
// Énergies de chauffage dérivées d'une liste de systèmes [{zone, systems:[...]}].
export function deriveHeatingEnergy(systemsGroups, lang) {
  const set = new Set();
  for (const g of systemsGroups || []) {
    for (const s of (g && g.systems) || []) { const e = SYSTEM_ENERGY[s]; if (e) set.add(e); }
  }
  return [...set].map((e) => (lang === 'en' ? ENERGY[e].en : ENERGY[e].fr));
}
