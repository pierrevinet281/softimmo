# LAST_SESSION.md

> Continuité entre sessions. Lu après `CLAUDE.md`. **Concis** — détail dans `git log` (PR/session),
> tâches reportées dans **issue #53**, vue d'ensemble dans `PLAN_GLOBAL.md`, architecture dans
> `documentation/` (+ *Pages Technical Documentation/*).

## ▶ REPRISE RAPIDE
**Prompt :** « Nouvelle session Softimmo. Lis `CLAUDE.md`, `LAST_SESSION.md`, `PLAN_GLOBAL.md`, puis
enchaîne sur la prochaine tâche (issue #53). Mode continu. »

**Où on en est (après 40 sessions, tout sur `main`) :**
- **Modules 1, 2, 3 livrés.** Module 4 (marketing) avancé. Module 5 à faire.
- **Module 1** — fiche propriété unifiée `/properties/edit[/:id]` (12 onglets), matrice Attributs
  Ventes → formulaire dynamique, édition en ligne, géo QC. (S39)
- **Module 2 (S40)** — **ACM refondé** (`/evaluation`) selon le « Tableau des ajustements » ;
  sujet↔comparables alignés ; postes « ignorés » (œil) ; **évaluations enregistrées** (onglet fiche).
  **Module Analyse de marché** `/market-analysis` : caractérisation du secteur **100 % données
  publiques gratuites** (StatCan/MAMH/OSM/Wikimedia) — scores de secteur, démographie, revenus,
  emploi, langues, logement, entreprises/industries, 5 graphiques, images par bloc (contour+aérien+
  landmark). Onglets **Évaluations** et **Market Analysis** sur la fiche propriété.
- **Prochaine grande étape (#53)** : alimenter la **brochure** avec les données de la fiche
  (matrice→formulaire→brochure) ; puis Commercial/Industriel, Module 5. Compléments analyse de
  marché : carte 3D (clé Google), rapport PDF, SCHL/RMR.

**Rappels** : seul `SoftImmoDev` modifiable (sauf lanceurs `..\Scripts`) ; conformité non négociable ;
**déterministe d'abord**, **imagerie/données libres à usage commercial uniquement**. Remote
`https://github.com/pierrevinet281/softimmo`. Backup : `..\Backup-Softimmo\Lancer-Backup.bat`
(hash → `documentation/BACKUP_LOG.md`).

---

## Session 40 — ACM refonte + Module Analyse de marché (2026-07-01)

**Module 2 — ACM (`/evaluation`)** : moteur (`engine/acm.js`) + params (`acm-params.seed.json`,
`lib/acmParams.js`) refondés selon *Tableau des ajustements* (superficie $/pi² par niveau avec
répartition heuristique ; caractéristiques % et $ par option, multi→moyenne ; accessoires $/qté ;
âges plage neuf↔fin/durée de vie ; date %/mois). `ParamsPanel` = tableau éditable + reset. Sujet
(`buildSubject`, `deriveIncl`) ↔ comparables **alignés** (mêmes optsets ; colonnes comparables
ajoutées). Donnée catégorielle absente = « construction standard assumée ». Postes **« ignorés »**
(œil : grisé, exclu totaux/opinion, masqué impression). **Évaluations auto-enregistrées** (table
`evaluations`) → onglet fiche. Optsets `driveway`/`kitchen_cabinets` ajoutés à l'aperçu.

**Module 2 — Analyse de marché (`/market-analysis`, NOUVEAU)** : menu (bloc Analyse & Évaluation),
bouton + onglet sur la fiche. Moteur pur `engine/marketAnalysis.js` + `lib/quebecDemographics.js` +
worker best-effort `python/market_local.py` (géocodage Nominatim, POI Overpass top-5, écussons/
images Wikimedia). Génération rapide (seeds) + enrichissement découplé. **Seeds générés** :
`quebec-demographics.seed.json` (MAMH), `quebec-census.seed.json` (StatCan Recensement 2021 via WDS
+ Business Counts 33-10). Rapport : hero (jauge marchabilité), synthèse+impact valeur, scores de
secteur (9 dim.), top-5 POI cliquables (Google Maps par coord.), 5 graphiques, panneau 3 images/bloc.
**Imagerie/données 100 % libres usage commercial** (EOX Sentinel-2/terrain CC-BY, Wikimedia allowlist
CC0/PD/CC-BY/CC-BY-SA, écussons PD). Tables `evaluations`, `market_analyses`.

**Nouveaux fichiers** : `pages/MarketAnalysis.jsx`, `engine/marketAnalysis.js`,
`lib/quebecDemographics.js`, `python/market_local.py`, seeds `acm-params`(refondu),
`quebec-demographics`, `quebec-census` ; repos `evaluations.js`, `marketAnalyses.js`.
**Touchés** : `Evaluation.jsx`, `engine/acm.js`, `lib/acmParams.js`, `App.jsx`, `PropertyEdit.jsx`,
`routes/business.js`, `db/{schema.sql,index.js}`, `db/repositories/{index,comparables}.js`,
`lib/quebecGeo.js`, `attrOptions.js`, `sales-attributes.seed.json`, `python/acm_matrix.py`, `i18n`,
`app.css`. **Vérifié** : `vite build`, `node --check`, `py_compile`, JSON seeds ; tests moteur ACM +
analyse (Blainville).

**Reste (#53)** : carte 3D animée (clé Google) ; rapport PDF analyse ; inoccupation SCHL (RMR) ;
scolarité/immigration/ethnies (tables croisées → worker WDS à la demande) ; prévisions ISQ ; stats
de marché MLS (verrouillé) ; principales entreprises nommées ; import Matrix PDF ne saisit pas les
caractéristiques catégorielles des comparables (saisie manuelle).

## Sessions antérieures (résumé)
- **S39** : refonte fiche propriété (page unifiée, Attributs Ventes, édition en ligne, géo QC,
  photos par pièce, marketing éditable, round-trip PPTX standard granulaire).
- **S38** : brochure RPA (jumeau PPTX fidèle, round-trip ~180 slots, bibliothèque de brochures).
- **S37** : Module 3 (offres + customizer + PPTX), Profil, Assets courtier.
- **S1–36** : Modules 1 & 2, socle (shell/DB/jobs/IA), brochures standard + layout PPTX.

## Prochaines tâches
Voir **issue #53** et `PLAN_GLOBAL.md`. Priorité : **alimenter la brochure** avec les données de la
fiche, puis Commercial/Industriel, Module 5 ; compléments analyse de marché (carte 3D, PDF, SCHL).
