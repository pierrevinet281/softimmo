# Page — Analyse de marché (`/market-analysis`)

Module 2. Caractérisation du secteur (région administrative / MRC / municipalité / voisinage) à
partir de **données publiques gratuites, à usage commercial** (déterministe, sans IA au runtime).
Inspiré de Local Logic / EVALO.ai. Accès : item **« Analyse de marché »** du menu (bloc *Analyse &
Évaluation*), bouton **Market Analysis** sur la fiche propriété (entre Évaluer et Brochure), et
onglet **Market Analysis** de `/properties/edit`.

## Flux
1. **Génération (rapide, sans réseau)** — `POST /properties/:id/market-analysis` → `buildMarketAnalysis`
   (identification géo depuis les seeds + démographie/recensement/entreprises en base) → enregistre
   un `market_analyses` (instantané JSON). Réponse immédiate.
2. **Enrichissement (best-effort, réseau)** — `POST /market-analysis/:id/enrich` → worker Python
   `market_local.py` (géocodage + OSM + images) → met à jour le rapport. Déclenché en arrière-plan
   par le frontend après la génération. Un échec réseau/quota ne bloque rien (rapport de base
   conservé).

## Moteur — `server/src/engine/marketAnalysis.js` (pur, déterministe)
- **Identification** : `lookupMunicipality` (seed `quebec-municipalities`) → région + MRC.
- **Démographie/recensement** (via `lib/quebecDemographics.js`) : population/superficie/densité/
  gentilé (MAMH), âge médian + courbe d'âge, revenu médian + tranches, croissance 2016→2021,
  chômage/activité, langues, ménages + type de logement, nombre d'entreprises + top secteurs,
  densité d'entreprises (proxy « indice d'activité économique »). Muni (CSD) et MRC (CD).
- **Scores de secteur (0-100)** : `buildScores(local)` depuis les POI OSM (proximité + densité) —
  9 dimensions (épiceries&dépanneurs, pharmacies, essence, restos, écoles, garderies, santé, parcs,
  sports) + connectivité routière ; indice de marchabilité composite.
- **Synthèse + impact sur la valeur** : `buildOverview` (bilingue).
- **Sortie** `report` : `{ version, title, geo{lat/lon/pop/density/…}, overview, scores, walkability,
  poi, roads, images{municipality,mrc,region:{map,photo}}, charts{age,income,lang,dwelling,industries},
  sections[secteur,access,municipality,mrc,region], summary{data_points,pending_points}, sources }`.
- **Ordre des blocs** : secteur → accès → municipalité → MRC → région (trié aussi côté frontend).

## Worker — `server/python/market_local.py` (best-effort, sans clé)
- **Géocodage** : Nominatim (repli progressif adresse→ville→ville+région, `countrycodes=ca`).
- **POI** : Overpass (ODbL) — top 5 nommés + décompte + plus proche par catégorie ; axes routiers.
- **Écussons d'autoroute** : Wikimedia Commons `Quebec Autoroute {N}.svg` (domaine public).
- **Images par entité** : `entity_photo` (photo landmark raster, article Wikipédia) + carte de
  contour (`Quebec MRC {nom} location map.svg`, `{région} in Quebec.svg`). Filtre licence STRICT
  (`_imginfo`) : CC0 / domaine public / CC-BY / CC-BY-SA ; rejet NC/ND/inconnu.
- **Découplage** : géocodage + images tournent même si Overpass échoue (504/quota) → POI vides.

## Sources de données (seeds générés une fois — voir mémoire `market-analysis-data-sources`)
- `quebec-demographics.seed.json` — **MAMH** (`datasources/MUN.xlsx`) : population, superficie,
  gentilé par municipalité + agrégats MRC/région. Aires MRC/région écartées (TNO faussent la somme).
- `quebec-census.seed.json` — **StatCan Recensement 2021** (WDS `getFullTableDownloadCSV`, licence
  ouverte) : âge (98-10-0022), revenu ménages (98-10-0057), tranches revenu particuliers
  (98-10-0473), croissance pop. (98-10-0004), emploi (98-10-0485), langues (98-10-0225), ménages+
  logement (98-10-0041) ; + **Registre des entreprises** (Business Counts 33-10-…) : nb d'entreprises
  + top secteurs NAICS. Clés = nom normalisé (sans accents), CSD (muni) et CD (MRC).

## Imagerie (frontend) — toutes libres, usage commercial (attribution affichée si requise)
- **Vue aérienne** : Sentinel-2 cloudless (EOX/Copernicus, WMS, CC-BY-4.0).
- **Carte** : contour Wikimedia (CC-BY-SA) ou Terrain-light EOX (CC-BY-4.0) en repli.
- **Photo landmark** : Wikipédia/Commons (allowlist stricte).
- Panneau latéral par bloc = **[carte contour] + [aérien] + [landmark]** empilés, largeur **fixe
  300 px**, alternance gauche/droite ; contenu en `minmax(0,1fr)` (anti-débordement).

## Frontend — `web/src/pages/MarketAnalysis.jsx`
Page (sélecteur de propriété) + `MarketAnalysisPanel` (réutilisé dans l'onglet fiche) + rendu du
rapport (hero jauge marchabilité + chips ; synthèse ; blocs ordonnés ; tuiles de voisinage avec
top-5 **cliquables vers Google Maps par coordonnées** ; connectivité + écussons ; **5 graphiques**
`MiniBars` ; panneau 3 images/bloc). i18n `ma.*`. CSS `.ma-*` dans `app.css`.

## DB
Tables `evaluations` et `market_analyses` (idempotentes, `schema.sql`) + repos + entrées `ENTITIES`
(CRUD auto) + ajout au bundle propriété.

## Restant (issue #53)
Carte animée 3D (Google Aerial View — clé requise) ; rapport PDF 3-4 pages ; inoccupation SCHL
(niveau RMR) ; scolarité/immigration/ethnies (tables croisées >100 Mo → worker à la demande) ;
prévisions économiques (ISQ) ; stats de marché prix/ventes (MLS verrouillé).
