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
  `comparables`, `reports`, `documents`, `property_media`.
- **`documents`** (doc_type='analyse|evaluation|offre|brochure|…') sert de **store polyvalent** :
  - `doc_type='brochure'` + `template` + `data.{layout,content}` = surcharge de présentation
    par propriété (round-trip brochure).
  - `doc_type='offre'` + `title`(=nom) + `data.{variant,lang,client_id,property_id,is_template,
    overrides,customization,pptx_content}` = **offre sauvegardée** (Module 3).
- **`broker_assets`** : bibliothèque marketing du courtier (logo, portrait, buste, carte, bio,
  signature, accroche, certificat, hero, autre ; fichier image/PDF + texte). Voir docs/01.
- **`broker_profile`** (clé Settings) : identité + image de marque (`logo`,`banner`,`photo`,
  `theme{band_color,title_color}`) + coordonnées. **`offre_content`** (Settings) : surcharge
  globale du contenu d'offre (par-dessus `offre-content.json`).

## 4. Pipelines de rendu (déterministe, ReportLab / python-pptx)
- **Brochures standard** (`render_brochure.py` + jumeau `render_brochure_pptx.py`) : layout
  **à position fixe** projeté d'un gabarit PowerPoint (`brochure_layout.py`, 540×720→Lettre).
  5 modèles (unifamilial, luxe, rpa*, commercial, industriel). Round-trip : `ingest_pptx.py`.
- **Brochure RPA** (`render_rpa_brochure.py`) : format **éditorial 6 pages** (différent),
  data-driven depuis `rpa-brochure-content.json` (+ surcharge propriété), photos par rôle
  `rpa_*` → emplacements (`rpaBrochure.js`). Le routage `business.js` envoie `template='rpa'`
  vers ce moteur (PDF + aperçu gabarit). *Polices Oswald + Font Awesome dans `assets/fonts/`.*
- **Offre de services** (`render_offre.py`, **Platypus à flux**) : sections ordonnables,
  thème éditable (couleurs bannière/titres), bannière image optionnelle, contraste auto.
  Jumeau **PPTX** (`render_offre_pptx.py`, 1 diapo/section, formes nommées `OFF::clé::type::partie`)
  + ingestion (`ingest_offre_pptx.py`) = **aller-retour**. `offre.js` : `buildOffreData`,
  `resolveOffreContent`, `applyOfferDiff` (personnalisation par offre → contenu prêt au rendu).

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
