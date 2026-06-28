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
- **Brochures standard** (`render_brochure.py` + jumeau `render_brochure_pptx.py`) : layout
  **à position fixe** projeté d'un gabarit PowerPoint (`brochure_layout.py`, 540×720→Lettre).
  5 modèles (unifamilial, luxe, rpa*, commercial, industriel). Round-trip : `ingest_pptx.py`.
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
