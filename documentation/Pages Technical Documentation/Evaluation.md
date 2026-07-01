# Page — Évaluation / ACM (`/evaluation`)

Module 2. Opinion de la valeur marchande par **Analyse Comparative de Marché** (100 % déterministe,
sans IA). Le **Sujet** est une copie du *Property Overview* pré-remplie depuis la propriété ; on
ajuste le prix vendu de chaque **comparable** vers le sujet, chaque ajustement chiffré + expliqué.

## Moteur — `server/src/engine/acm.js`
`adjustComparable(subject, comp, params, asOf, ignored)` produit une grille ventilée ; `computeAcm`
agrège (moyenne pondérée des prix ajustés → opinion ; prix d'inscription via ratio APCIQ ;
corroboration foncière). Refondé selon le **« Tableau des ajustements »** (`Statistiques/`), structure
`params` :
- **area** ($/pi²) : terrain + construction **par niveau** (RDC/étages/sous-sol). La superficie
  habitable est **répartie par niveau** avec heuristique : comparable à étages + sous-sol ÷3 ;
  bungalow + sous-sol ÷2 ; inconnu → ÷2 (bungalow + sous-sol). Hypothèse écrite au compte rendu.
- **features_pct** (fondation, toiture, revêtement, fenêtres, planchers) : % par option ; **éléments
  compétitifs multiples → MOYENNE** ; ajustement = (moy. sujet − moy. comp) × prix.
- **features_dollar** (entrée, armoires, comptoirs) : $ contributif par option (moyenne si multi).
- **inclusions** ($ par quantité ; `sous_sol_fini` = $/pi²) : (qté sujet − qté comp) × prix.
- **age** : construction %/an ; fenêtres/toiture = **plage neuf↔fin de vie** sur une durée de vie.
- **date** : appréciation %/mois. **Conservés** : `sale_to_list_ratio`, `sale_to_assessment_ratio`, APCIQ.
- **Donnée catégorielle absente au comparable = « construction standard assumée »** (option de
  référence à 0) pour comptabiliser la prime du sujet ; noté au compte rendu.

## Paramètres — `lib/acmParams.js` + seed `acm-params.seed.json`
Défauts éditables (admin) + override `Settings['acm_params']` (fusion profonde). `ParamsPanel` rend
**le tableau** (Superficie $/pi², Âge, Date, Caractéristiques % et $, Accessoires $) avec champs
$/% éditables + **« Réinitialiser aux défauts »** (vide l'override). APCIQ (StatsRatios) conservé.

## Sujet & comparables alignés
`buildSubject()` mappe tous les attributs de l'aperçu → sujet (superficie habitable + terrain,
étages, fondation, revêtement, fenêtres, planchers, toiture, entrée, armoires, comptoirs, âges,
inclusions dérivées via `deriveIncl`). Les **comparables** portent les **mêmes clés/options**
(`buildFeatureFields` depuis `features_pct/dollar`) + colonnes `ext_cladding, windows_material,
roofing_type, driveway, kitchen_cabinets, countertops, land_area, storeys, basement,
basement_finished`. Import Matrix PDF : superficie de terrain → `land_area`.

## Grille — « ignorer » des postes (`AdjustmentGrid`)
Icône **œil** devant chaque poste + œil « tout sélectionner » : un poste ignoré est **grisé** à
l'écran, **exclu** du total/prix ajusté/opinion (recalcul serveur — `computeAcm({… ignored})`), et
**masqué à l'impression** (`@media print`). État par propriété ; la bascule recalcule.

## Évaluations enregistrées
Le bouton **Calculer** envoie `save:true` → l'API enregistre un instantané dans la table
`evaluations` (opinion, fourchette, prix d'inscription, nb comparables, sujet, ignored, résultat).
Les bascules « ignorer » recalculent avec `save:false` (pas de doublon). Onglet **Évaluations** de
`/properties/edit` (table + ouvrir/supprimer).

## Fichiers
`web/src/pages/Evaluation.jsx` (page + `ParamsPanel`, `AdjustmentGrid`, `ComparablesEditor` exporté,
`buildSubject`, `deriveIncl`), `engine/acm.js`, `lib/acmParams.js`, `routes/business.js`
(`/acm`, `/acm/params`, import-matrix), `db` (tables `evaluations`, colonnes comparables),
`web/src/lib/attrOptions.js` (optsets driveway/kitchen_cabinets…). i18n `ev.*`.
