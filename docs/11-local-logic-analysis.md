# 11 — Analyse Local Logic : payer ou reproduire gratuitement ?

> Étude (2026-06-25) pour décider si le module Évaluation doit s'abonner à Local Logic
> (locallogic.co) ou reproduire ses données via des sources gratuites. Complète `docs/08`
> (sources QC) et `docs/10` (module Évaluation). Confiance variable : plusieurs pages LL et
> comparateurs étaient bloqués en lecture directe — points tarifaires = tiers, non officiels.

## Verdict

- **Reproductible gratuitement à ~70 %, surtout à Montréal.** Démographie, écoles/garderies,
  POI (décomptes), proxys marche/vélo/transit, parcs/verdure, criminalité (Montréal),
  limites de quartiers : **gratuit et réutilisable commercialement**.
- **Non reproductible gratuitement** : (1) **prix de vente récents / médiane de revente /
  délai au niveau adresse-quartier** (MLS non ouvert au Canada → Registre foncier ~1,00 $→
  **1,50 $/doc dès 2026-04-01**, ou JLR payant) ; (2) **méthodologie de scoring propriétaire**
  de LL (on peut calculer *ses propres* scores, pas les leurs) ; (3) **score de bruit/« quiet »**
  (aucune donnée gratuite au Canada) ; (4) **couverture uniforme hors Montréal**.
- **La démographie — l'ingrédient principal — est 100 % gratuite** via StatCan (c'est la même
  source brute que LL).

## Tarification (NON publique)

Vente **entreprise / sur devis** ; accès API via client ID+secret obtenus sur démo. Aucun
tarif par appel ni par rapport publié. Points tiers (non confirmés) : ~**100 $US/mois/site**
(widgets), **250 $US/utilisateur/mois** (Capterra). **Coût pour 1 bien** : non tarifable à
l'unité publiquement ; techniquement **1 à 3 appels** suffiraient (Location Snapshot `/v3/data`
agrège démo+POI+scores ; +Market Stats [É.-U. seulement] +Profiles texte), mais facturé via
**abonnement annuel négocié**. ⚠️ Les rapports de marché (IO Reports) sont **É.-U. seulement** —
à confirmer pour le QC avant tout engagement.

## Recommandation pour Softimmo

**Ne pas dépendre de Local Logic au départ.** Construire le volet « données de secteur » du
module Évaluation sur les **sources gratuites** (StatCan, OSM/Overpass, Données Québec,
Données Montréal, GTFS, Sentinel-2). Garder Local Logic comme **connecteur optionnel du
Marketplace** (clé fournie par l'utilisateur), à activer seulement si la couverture hors
Montréal ou un score de bruit devient nécessaire. Cohérent avec [[minimize-runtime-ai]] et le
principe de coût minimal. Les **prix de vente** (comparables) restent le vrai verrou : voie par
défaut = comparables Centris saisis/importés par le courtier (gratuit).

## Tableau comparatif

| Donnée (Local Logic) | Source gratuite équivalente | Exclusif LL ? | Coût (LL / alternative) |
|---|---|---|---|
| Score marchabilité/piéton | Partiel — OSM/Overpass (à scorer) ; Walk Score (conditions restrictives) | Score chiffré : oui | Abo LL / gratuit |
| Score vélo | Partiel — OSM (infra cyclable) | Score : oui | Abo / gratuit |
| Score transport commun | Partiel — GTFS STM/RTC/exo + OSM | Score : oui | Abo / gratuit |
| Score auto | Partiel — OSM (pas de congestion fine gratuite) | Partiel | Abo / gratuit (proxy) |
| Épiceries/commerces/cafés/restos/bars | Partiel — OSM ; Google Places (payant) | Décompte non ; avis/fraîcheur oui | Abo / OSM gratuit |
| Écoles primaires/secondaires | OUI — Données Québec (CC-BY) | Non | Abo / gratuit |
| Garderies / CPE | OUI — Min. Famille (Données Québec) | Non | Abo / gratuit |
| Parcs / espaces verts | OUI — Données Montréal ; sinon NDVI Sentinel-2 | Non | Abo / gratuit |
| Verdure / canopée | OUI à Montréal (NDVI CMM) ; sinon Sentinel-2 | Non | Abo / gratuit |
| Tranquillité / bruit | **NON** — aucune carte gratuite (proxy OSM) | **Quasi exclusif** | Abo / aucune |
| Caractère vibrant / historique | Partiel — OSM (âge bâti incomplet) | Partiel | Abo / approx. |
| Bien-être (wellness) | Partiel — OSM (POI santé/sport) | Partiel | Abo / approx. |
| Démographie (revenu, âge, ménages, scolarité, navettage, langues, logement) | **OUI** — StatCan Recensement 2021 (API WDS, licence commerciale, AD/secteur) | Non | Abo / **gratuit** |
| Profils de quartier (texte rédigé) | NON — texte généré propriétaire | **Oui** | Abo / aucune (rédiger soi-même) |
| Quartiers comparables | NON — modèle propriétaire | **Oui** | Abo / aucune |
| Value Drivers | NON — modèle propriétaire | **Oui** | Abo / aucune |
| Limites de quartiers / géographies | OUI — fichiers StatCan 2021 + quartiers Montréal | Non | Abo / gratuit |
| Stats marché agrégées (prix médian, délais, ventes) métro/secteur | Partiel — APCIQ/Centris, CREA HPI, SCHL (niveau RMR) | Partiel | Abo / gratuit (agrégé) |
| **Prix de vente / médiane revente (adresse/quartier)** | **NON gratuit** — Registre foncier (1,00→1,50 $/doc) ou JLR | **Quasi exclusif** | Abo / payant aussi |
| Risque climatique / inondation | OUI (dépistage) — BDZI, FHIMP, ClimateData.ca | Non | Abo / gratuit (indicatif) |
| Criminalité / sécurité | OUI à Montréal — SPVM ; sinon StatCan (RMR) | Non | Abo / gratuit (Montréal) |

## Sources
docs.locallogic.co (endpoints scores/demographics/data/io-reports) ·
locallogic.co/platform/datasets/* · locallogic.co/pricing · api.statcan.gc.ca ·
donneesquebec.ca · donnees.montreal.ca · apciq.ca · capterra.ca/software/1022704/local-logic
