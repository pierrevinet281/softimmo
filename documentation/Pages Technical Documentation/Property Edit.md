# Page — Fiche propriété (édition unifiée)

`web/src/pages/PropertyEdit.jsx` · routes `/properties/edit` (création) et `/properties/edit/:id`
(édition). **Espace de travail unique** d'une propriété (remplace l'ancien dialogue de création et
l'ancienne page détail `/properties/:id`, qui **redirige** désormais ici via `PropertyRedirect`).
Accès : menu **Propriétés → Ajouter / Éditer**, bouton **+ Nouvelle propriété**, ou clic sur le nom
dans la liste `/properties`.

## Onglets
1. **Property Overview** — identité + caractérisation.
2. **Buildings & Units/Rooms** — bâtiments et unités/pièces (édition en ligne).
3. **Rent roll** — unités, vue locative (édition en ligne).
4. **Expenses** — dépenses (édition en ligne).
5. **Profitability** — rentabilité (lecture, `ProfitabilityTab`).
6. **Transactions** — `EntityTable` (`transactionsConfig`).
7. **Comparables** — import PDF (matrice) + ajout manuel (`ComparablesEditor`, réutilisé d'`/evaluation`).
8. **Évaluations** (S40) — table des opinions de valeur enregistrées (`EvaluationsTab` ; auto-
   enregistrées au *Calculer* d'`/evaluation`) ; ouvrir/supprimer.
9. **Market Analysis** (S40) — analyse de marché du secteur (`MarketAnalysisPanel`, réutilisé de
   `/market-analysis`). Voir *Market Analysis.md*.
10. **Photos** — téléversement + tag par **pièce** (`PhotosTab`).
11. **Marketing** — annonces éditables + sauvegardables (`MarketingTab`).
12. **Reports** — lecture seule (`ReadOnlyList`). *À rendre éditable (issue #53).*

En-tête : boutons **Évaluer** (`/evaluation`), **Market Analysis** (`/market-analysis`), **Brochure**.

Les onglets 5–10 réutilisent des composants **exportés de `PropertyDetail.jsx`** (et
`ComparablesEditor` de `Evaluation.jsx`). En mode édition, le `bundle` (`/properties/:id/bundle`)
alimente ces onglets ; le formulaire Overview est initialisé **une seule fois** par propriété
(les refetch des onglets enfants n'écrasent pas les saisies non enregistrées).

## Property Overview
- **Champs fixes** (→ colonnes `properties`) dans l'ordre : Nom · Client (+ **Nouveau client**
  à la volée, `components/ClientModal.jsx`) · **Type de transaction** (vendeur/acheteur/locateur/
  locataire) · **Numéros de lot** · MLS/Centris · Statut · **Pays** (menu) · **Province/État** (menu :
  provinces CA ou États US) · **Ville** (combobox de recherche, `components/CityField.jsx`) ·
  **Région** + **MRC** (associées automatiquement à la municipalité au QC, lecture seule ; libres
  hors QC) · Adresse · Code postal · **Zonage** (menu simple) · **Zonage détaillé / code**.
- **Type de propriété** (menu = types de la matrice). À la sélection → **formulaire dynamique**
  des catégories/champs « Sélectionnés » pour ce type dans *Attributs Ventes* (`/sales-attributes/
  form/:type`), valeurs stockées dans `properties.attributes` (JSON). Exclus du dynamique (déjà
  champs fixes) : `address`, `sector`, `genre_detail`, `zoning`, `lot_number`.
- **Géo** : `lib/geo.js` (COUNTRIES, provinces CA/US, ZONING_OPTIONS) ; combobox →
  `GET /geo/municipalities?q=` ; sélection renvoie `{name, region, mrc}`.
- **Garde-fous non-enregistré** : `useBlocker` (data router) + `beforeunload` ; modales « quitter
  sans enregistrer » et « changer de type » (perte des attributs saisis).
- **Bouton Brochure** (`BrochureChooser`) dans l'en-tête.

## Édition en ligne (Buildings/Units, Rent roll, Expenses)
`components/BuildingsUnits.jsx` (défaut = onglet 2 ; exports `RentRoll`, `ExpensesEditor`).
- **Ajouter** = création immédiate d'une ligne (POST avec défauts) ; **cellules éditables** →
  `PATCH /<entity>/:id` par champ (texte/nombre au blur, menus/bascules au changement) ;
  **poubelle** pour supprimer ; **scroll horizontal**.
- **Bâtiment** : Adresse (pré-remplie de la propriété), Largeur/Longueur (bascule pi/m),
  Superficie (pi²/m² → `building_area`), Nombre d'étages (`floors_total`).
- **Unité/pièce** : Immeuble, **Étage** (menu SS10→RDC→99 ; entier, RDC=0), **Fonction**
  (`lib/roomFunctions.js`, options selon le type), Largeur/Longueur/Superficie/Hauteur de plafond
  (bascules d'unité), **Recouvrement de plancher** (menu). `Rent roll` édite la même table `units`
  (vue locative : type, chambres, sdb, loyer, bail, occupant, vacant…).
- ⚠️ La *Fonction* (onglet Buildings) écrit `room_function` + `label` (PAS `unit_type`, réservé au
  « Type » du Rent roll).

## Données / endpoints
- Colonnes `properties.{attributes, transaction_type, mrc, zoning_detail, marketing}` ;
  `buildings.{address, width, length, width_unit, length_unit, area_unit}` ;
  `units.{floor, room_function, width, length, width_unit, length_unit, area_unit, ceiling_height,
  ceiling_unit, floor_covering}`.
- CRUD via `makeCrudRouter` (`/properties`, `/buildings`, `/units`, `/expenses`, `/comparables`).
- `/geo/municipalities`, `/geo/regions` ; `/sales-attributes/form/:type` ;
  `/properties/:id/comparables/import-matrix` ; `/properties/:id/marketing-copy`.

## À faire (issue #53)
Alimenter la **brochure** avec ces nouvelles données ; onglet Reports éditable ; ville hors-QC ;
nettoyage du code mort de `PropertyDetail.jsx`.
