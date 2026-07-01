# Architecture — Softimmo

> Vue d'ensemble technique vivante. Complète (sans remplacer) les specs de conception
> `docs/00`→`12`. Mise à jour au closeout quand l'architecture évolue.

## 1. Pile technique
- **Frontend** : React 18 + Vite, React Router, TanStack Query, icônes Lucide, CSS à tokens
  (`web/src/styles/app.css`, `var(--color-*)`, thème clair/sombre via `data-theme`). i18n
  FR/EN maison (`web/src/i18n/index.jsx`, défaut FR).
- **Backend** : Node ≥ 22 + Express, **`node:sqlite`** (aucune build native), validation zod.
- **Workers Python** (`server/python/`, venv `python/.venv`) : rendu PDF/PPTX (ReportLab,
  python-pptx, Pillow), extraction, recherche/vérif (socle enrichissement).
- **DB** : SQLite `data/softimmo.db`. Migrations idempotentes (schema.sql `CREATE IF NOT EXISTS`
  + `COLUMN_ADDITIONS` dans `db/index.js`). Colonnes `tenant_id` nullables (multi-tenant futur).
- **IA** : optionnelle, jamais au runtime du produit (CLAUDE.md §3) — déterministe d'abord.

## 2. Couches (séparation stricte)
1. **Moteurs purs** (`server/src/engine/*.js`) — calcul/data, sans I/O ni persistance :
   `finance.js`, `acm.js`, `marketingCopy.js`, `offre.js`, `rpaBrochure.js`.
2. **Persistance** (`server/src/db/repositories/*`) — `makeRepo` (factory CRUD générique :
   `create/get/update/delete/list/listBy`, JSON cols, search/sort/filter). Façade `Settings`.
3. **Routes** (`server/src/routes/*`) — Express ; `business.js` monte les entités métier
   (`makeCrudRouter`) + endpoints spécialisés (brochures, offres, profil, assets…).
4. **Workers** (`server/python/*`) appelés via `services/python.js` `runWorker(name, input)`
   (stdin JSON UTF-8 → stdout JSON ; un process court-vécu par appel).
5. **UI** (`web/src/pages/*`) — pages par module ; composants partagés `web/src/components/ui.jsx`.

## 3. Modèle de données (tables clés)
- Métier : `clients`, `properties`, `buildings`, `units`, `expenses`, `transactions`,
  `comparables`, `evaluations`, `market_analyses`, `reports`, `documents`, `property_media`.
  - **Module 2 (Session 40)** — `evaluations` (instantané ACM : opinion, fourchette, prix
    d'inscription, nb comparables, subject/ignored/result JSON) ; `market_analyses` (rapport
    d'analyse de marché JSON + municipality/mrc/region). `comparables` étendu : `ext_cladding,
    windows_material, roofing_type, driveway, kitchen_cabinets, countertops, land_area, storeys,
    basement, basement_finished` (alignés sur le sujet ACM).
  - **Champs étendus (Session 39)** — `properties` : `attributes` (JSON : valeurs d'attributs de
    vente par type), `transaction_type`, `mrc`, `zoning_detail`, `marketing` (JSON par langue).
    `buildings`/`units` : dimensions (`width`/`length` + `width_unit`/`length_unit`/`area_unit`
    pi·m / pi²·m²), `units.floor` (entier ; RDC=0, sous-sols négatifs), `room_function`,
    `ceiling_height`/`ceiling_unit`, `floor_covering`. `clients.kind` ∈ seller|buyer|both|**landlord|tenant**.
- **`documents`** (doc_type='analyse|evaluation|offre|brochure|brochure_variant|…') = **store polyvalent** :
  - `doc_type='brochure'` + `template` + `property_id` + `data.{layout,content,draft}` = surcharge
    de présentation **par propriété** (round-trip brochure). `property_id` NULL = défaut du gabarit
    (modèle unifié). `data.draft` = sync PPTX non approuvé (garde-fou).
  - `doc_type='brochure_variant'` + `template`(=famille) + `data.{name,description,property_types,
    lang,locked,is_base,content,layout,draft}` = **entité de la bibliothèque de brochures**
    (Session 38) : 5 familles seedées comme **originaux verrouillés** ; **Clone** → copie éditable.
  - `doc_type='offre'` + `title`(=nom) + `data.{variant,lang,client_id,property_id,is_template,
    overrides,customization,pptx_content,draft_pptx_content}` = **offre sauvegardée** (Module 3).
- **`broker_assets`** : bibliothèque marketing du courtier (logo, portrait, buste, carte, bio,
  signature, accroche, certificat, hero, autre ; fichier image/PDF + texte). Voir docs/01.
- **`broker_profile`** (clé Settings) : identité + image de marque (`logo`,`banner`,`photo`,
  `theme{band_color,title_color}`) + coordonnées. **`offre_content`** (Settings) : surcharge
  globale du contenu d'offre (par-dessus `offre-content.json`).

## 4. Pipelines de rendu (déterministe, ReportLab / python-pptx)
- **Brochures standard** (`render_brochure.py` + jumeau `render_brochure_pptx.py`) : 5 modèles
  (unifamilial, luxe, rpa*, commercial, industriel), espace PowerPoint 540×720→Lettre.
  **Round-trip granulaire PAR ÉLÉMENT** (Session 39, comme RPA) : chaque élément est une forme
  `STD::<slot>` (texte éditable + position) ou `STDp::<slot>` (position seule). Boîtes par défaut
  centralisées dans **`brochure_slots.py`** (source unique des DEUX moteurs) ; helper `ovr(slot,…)`.
  Ingest `ingest_pptx.py` / `pptx_to_layout.py` capturent texte + position par slot → `data.layout`.
- **Brochure RPA** (`render_rpa_brochure.py`) : format **éditorial 6 pages** (différent),
  data-driven depuis `rpa-brochure-content.json` (+ surcharge propriété/gabarit), photos par rôle
  `rpa_*` → emplacements (`rpaBrochure.js`). *Polices Oswald + Font Awesome dans `assets/fonts/`.*
  - **Jumeau PPTX fidèle** (`render_rpa_brochure_pptx.py` + primitives `rpa_pptx_helpers.py`) :
    **miroir au point près du PDF** (mêmes coordonnées y-bas→EMU, icônes FA en PNG). Méthode de
    l'app ancêtre `rpa_mlt` ; voir mémoire `pptx-twin-mirrors-pdf`.
  - **Round-trip layout-driven** (`ingest_rpa_brochure_pptx.py`) : l'utilisateur déplace/édite des
    éléments dans le PPTX → l'ingest capture **texte + positions** de ≈180 formes nommées ; **les
    deux moteurs** (PDF + PPTX) consultent l'override `data.layout`. Modèle **granulaire** : chaque
    élément suit sa propre boîte. Nommage : `RPA::<slot>` (texte éditable + position) vs
    `RPAp::<slot>` (position seule : logos/formes/textes MAJUSCULES). Helpers `ov/ovc/iov/tov_text/
    tov_para/ovline` (PDF) ; `set_pos`/`POS` (PPTX). Conversion boîte↔ligne-de-base calibrée (`ASC`).
- **Garde-fou de synchronisation** (brochure propriété, gabarit, offre) : un sync PPTX écrit un
  **brouillon** (`data.draft`) ; aperçu (`?draft=1`) → **Approuver** (remplace le live) ou **Rejeter**
  ; **Réinitialiser** au défaut. Le PPTX n'est jamais persisté (temporaire, supprimé après approbation).
- **Bibliothèque de brochures** (Session 38, `BrokerTemplates.jsx` + routes `/brochure/library`,
  `/clone`, `/variants/:id/*`) : cloner pour éditer ; **original verrouillé** non éditable ;
  rendu d'une variante = moteur de sa famille + son snapshot (`data.content/layout`).
- **Offre de services** (`render_offre.py`, **Platypus à flux**) : sections ordonnables,
  thème éditable (couleurs bannière/titres), bannière image optionnelle, contraste auto.
  Jumeau **PPTX** (`render_offre_pptx.py`, 1 diapo/section, formes nommées `OFF::clé::type::partie`)
  + ingestion (`ingest_offre_pptx.py`) = **aller-retour**. `offre.js` : `buildOffreData`,
  `resolveOffreContent`, `applyOfferDiff` (personnalisation par offre → contenu prêt au rendu).

## 4b. Fiche propriété — page d'édition unifiée (Module 1, Session 39)
- **Page unique** `web/src/pages/PropertyEdit.jsx` (`/properties/edit` = création, `/properties/edit/:id`
  = édition) : espace de travail complet de la propriété. La liste `/properties` y mène ; l'ancienne
  page détail `/properties/:id` **redirige** (`PropertyRedirect`). `PropertyDetail.jsx` n'est plus
  routé — il **exporte** ses onglets réutilisés (`ProfitabilityTab`, `ReadOnlyList`, `MarketingTab`,
  `PhotosTab`, `BrochureChooser`, `transactionsConfig`). `Evaluation.jsx` exporte `ComparablesEditor`.
- **Onglets** : Property Overview · Buildings & Units/Rooms · Rent roll · Expenses · Profitability ·
  Transactions · Comparables · Photos · Marketing · Reports.
- **Overview** : champs fixes → colonnes `properties` ; **formulaire dynamique** → `properties.attributes`,
  piloté par la matrice **Attributs Ventes** (`formSchema(type)`). Géo : pays/province (menus
  `lib/geo.js`), ville (combobox `components/CityField.jsx` → `/geo/municipalities`), **région + MRC
  auto** au QC. Zonage = menu (clé) + détail libre.
- **Édition en ligne** (`components/BuildingsUnits.jsx` + exports `RentRoll`, `ExpensesEditor`) :
  bouton Ajouter → création immédiate (défauts), cellules éditables → **PATCH par champ**, poubelle,
  scroll horizontal. `DimCell` = valeur + bascule d'unité. Listes : `lib/roomFunctions.js`
  (fonctions de pièce par type, bilingue) + recouvrements de plancher.
- **Garde-fou non-enregistré** : `main.jsx` migré en **data router** (`createBrowserRouter`) pour
  activer `useBlocker` ; + `beforeunload`. Modales « changer de type » et « quitter sans enregistrer ».
- **Attributs Ventes** (`web/src/pages/SalesAttributes.jsx`, `/properties/attributs`) : matrice
  attribut × 6 types. Taxonomie `db/seeds/sales-attributes.seed.json` + surcharges
  `Settings['sales_attributes_matrix']` ; `lib/salesAttributes.js`
  (`buildMatrix/setCell/resetMatrix/formSchema`) ; endpoints `/sales-attributes`
  (+`/cell`, `/reset`, `/form/:type`).
- **Géo Québec** : `datasources/MUN.xlsx` (MAMH, 1120 munis ; conservé dans le repo) → seed
  `quebec-municipalities.seed.json` (nom, région, MRC) ; `lib/quebecGeo.js` ; endpoints
  `/geo/municipalities`, `/geo/regions`.
- **CSS dark mode** : les menus/popovers custom doivent utiliser `--color-bg-card` /
  `--color-bg-secondary` / `--color-text-primary` (les tokens `--color-surface*` / `--color-text`
  N'EXISTENT PAS → rendu blanc en sombre).

## 4c. Module 2 — Évaluation (ACM refonte) & Analyse de marché (Session 40)
- **ACM** (`engine/acm.js`, `lib/acmParams.js`, seed `acm-params.seed.json`) refondé selon le
  « Tableau des ajustements » (`Statistiques/`) : superficie $/pi² **par niveau** (répartition
  heuristique de la superficie habitable), caractéristiques **% et $ par option** (multi → moyenne),
  accessoires $/quantité, âges (plage neuf↔fin sur durée de vie), date %/mois. `ParamsPanel` = le
  tableau éditable + reset. Sujet ↔ comparables **alignés sur les mêmes clés d'options**. Poste
  **« ignoré »** (œil) → grisé, exclu des totaux/opinion, masqué à l'impression. **Évaluations
  auto-enregistrées** (`evaluations`). Détails : *Pages Technical Documentation/Evaluation.md*.
- **Analyse de marché** (`engine/marketAnalysis.js`, `lib/quebecDemographics.js`,
  `python/market_local.py`, page `web/src/pages/MarketAnalysis.jsx`) : **100 % déterministe, données
  publiques gratuites à usage commercial**. Génération rapide (seeds) + **enrichissement best-effort**
  découplé (worker : géocodage Nominatim, POI Overpass, images/écussons Wikimedia). Scores de secteur
  0-100 depuis OSM, synthèse + impact valeur, 5 graphiques, panneau 3 images/bloc (contour + aérien
  Sentinel-2 + landmark). **Seeds de données** (générés une fois, licence ouverte) :
  `quebec-demographics.seed.json` (MAMH : pop/superficie/gentilé + agrégats MRC/région) et
  `quebec-census.seed.json` (StatCan Recensement 2021 via WDS + Registre des entreprises 33-10 :
  âge, revenu, croissance, emploi, langues, ménages/logement, entreprises/industries). Endpoints
  `/properties/:id/market-analysis` (créer) + `/market-analysis/:id/enrich`. Détails : *Pages
  Technical Documentation/Market Analysis.md* + mémoire `market-analysis-data-sources`.
- **Imagerie libre uniquement** (usage commercial ; attribution affichée si requise) : Sentinel-2
  cloudless & terrain-light **EOX** (CC-BY-4.0), contours & photos **Wikimedia** (allowlist CC0/PD/
  CC-BY/CC-BY-SA ; rejet NC/ND/inconnu), écussons d'autoroute (domaine public). Aucune source à frais.

## 5. Conventions
- Aucune donnée codée en dur (références/contenus → JSON sous `engine/` ou `db/seeds/`).
- Conformité produit non négociable (CLAUDE.md §0.2 ; « opinion ≠ évaluation » ; mentions
  agence+courtier ; Loi 25 ; Loi 96 FR prééminent).
- Périmètre : **seul `SoftImmoDev` est modifiable** (sauf demande explicite d'un lanceur
  dans `..\Scripts`).

## 6. Lancement / exploitation
- Dev : `..\Scripts\Demarrer-Softimmo.bat` (`npm run dev` → API `:8787`, Web `:5180`).
- Arrêt ciblé (ports 8787/5180 seulement) : `..\Scripts\Arreter-Softimmo.bat`.
- Prod : `..\Scripts\Demarrer-Softimmo-PRODUCTION.bat` (`build` + `start`, un seul port `:8787`).
- Install : `..\Scripts\Installation-Initiale.bat` (install + setup:python + migrate + seed).
