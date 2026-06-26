# LAST_SESSION.md

> Fichier de continuité entre sessions. Lu au début de chaque session (après
> `CLAUDE.md`). Mis à jour au closeout de chaque session.

---

## Session 2 — Pipeline marketing (spec) + Phase 1 Fondations (2026-06-25)

### Réalisé
- **Spécification marketing** (exigence utilisateur) : `docs/09-marketing-pipeline.md`
  (PDF + PPTX éditable jumeau, aller-retour `ingest_pptx.py`), principe « IA pour bâtir,
  pas pour exécuter » ajouté à `CLAUDE.md` §3. Réf. : pipeline Tours Gouin `_build/`
  (ReportLab + python-pptx). Sauvegardé en mémoire.
- **Phase 1 — Fondations Softimmo** :
  - **Schéma DB métier** (`server/src/db/schema.sql`) : `clients`, `properties`,
    `buildings`, `units`, `expenses`, `transactions`, `comparables`, `reports`,
    `documents` (idempotent, appliqué au boot).
  - **Fabrique de repository** `repositories/_factory.js` + 9 repos métier + barrel.
  - **Fabrique de routes CRUD** `routes/_crud.js` + `routes/business.js` (toutes les
    entités) + endpoint agrégé `GET /properties/:id/bundle` (Module 1). Montées dans
    `routes/index.js`. **Testées** (création/bundle/filtre/cascade OK).
  - **i18n FR/EN** `web/src/i18n/index.jsx` (contexte + `useI18n` + dict, défaut FR) +
    **bascule de langue** dans la topbar.
  - **Navigation par module** (App.jsx : Mandats, Analyse/Évaluation, Mise en marché,
    CRM, Plateforme) + **page Propriétés fonctionnelle** (liste/création/suppression) +
    **pages placeholder** (Clients, Évaluation, Marketing, Offres, Trousse).
  - Vérifié : Vite compile tous les nouveaux modules (200) ; backend testé ; boot OK.

### Décisions (session 2)
- DRY assumé via **fabriques** (repo + route) pour les 9 entités métier — cohérent avec
  le style du socle, extensible.
- Schémas zod **permissifs** (passthrough) pour l'instant ; durcissement (enums/types)
  plus tard sans casser les entrées.
- Page Propriétés livrée minimale fonctionnelle ; le détail multi-bâtiments / rent roll /
  rentabilité = Phase 2 (Module 1).

---

## Session 1 — Framework & socle (2026-06-25)

### Objectif
Étapes 1-3 de la méthodologie : analyse de la requête + inspection des ressources,
recherche en ligne, et mise en place du framework de développement (avec intégration du
socle d'enrichissement).

### Réalisé
- **Inspection** complète des ressources fournies (design system, offre Ubee, brochures,
  documents de présentation, outil d'enrichissement, dossiers clients référencés).
- **Recherche en ligne** (3 axes) : besoins des courtiers QC + concurrents (Cloud CMA,
  RPR, Matrix/Realist, Centris, kvCORE, marketingimmobilier.ca…) ; sources de données
  (Centris, JLR, rôle, Registre foncier, StatCan, SCHL, Données Québec, MTQ, Local
  Logic) ; specs de formats marketing ; conformité légale (LCI, OACIQ, Loi 25, Loi 96).
- **Copie intégrale** du socle d'enrichissement
  (`Backup-Enrichissement de contacts/lead-gen-code`) dans `SoftImmoDev` (hors
  node_modules/dist/db/venv).
- **Git** : `git init`, remote `https://github.com/pierrevinet281/softimmo`, branche
  `session-01-framework`.
- **CLAUDE.md** : règles impératives (périmètre fichiers, conformité, tech stack,
  conventions, boucle de session).
- **Documentation de framework** : `docs/00`→`08` (prompt de départ, vision/modules,
  architecture, catalogue de fonctionnalités, plan d'action, dev-process, conformité,
  specs marketing, résultats de recherche). Docs héritées déplacées sous `docs/enrichment/`.
- **Re-branding** socle → Softimmo : package.json (root/server/web), README, index.html,
  vite (SOFTIMMO_API_PORT), config.js (DB `softimmo.db`, UA), App.jsx (marque, thème),
  `.env.example`.
- **LAST_SESSION.md** (ce fichier).
- Vérification de démarrage (install + boot) : voir statut ci-dessous.

### Décisions
- **UI bilingue FR/EN** (défaut FR), bascule. i18n à câbler en Phase 1.
- **Remote Git** : `https://github.com/pierrevinet281/softimmo` ; workflow branche → PR →
  squash merge → ff main.
- **IA via API Anthropic** (clé `ANTHROPIC_API_KEY` à fournir, stockée localement) ;
  recherche web par workers Python + Google CSE optionnel ; repli heuristique.
- Le **socle d'enrichissement EST l'app** : son infrastructure (shell, DB, jobs,
  settings, IA, workers) sert tous les modules ; l'enrichissement devient le Module 6.
- **Renommage du slug `leadgen`** fait **progressivement** (DB path/UA/packages déjà
  faits ; env var, schéma interne → Phase 8) pour éviter une migration risquée d'un coup.
- **Module 4 (marketing) — exigence ajoutée par l'utilisateur** : sortie **PDF + PPTX
  éditable (jumeau fidèle)** avec bouton **« Mise à jour »** aller-retour (PPTX modifié →
  script Python → met à jour PDF + données). **Déterministe, sans IA au runtime** (l'IA
  sert à bâtir, pas à exécuter) ; wizards, formulaires, upload d'images. Pipeline de
  référence (lecture seule) : Tours Gouin `…\Publicités\_build\` (ReportLab + python-pptx).
  Conception consignée dans `docs/09-marketing-pipeline.md`. Principe global ajouté à
  `CLAUDE.md` §3.

### Statut de démarrage — VALIDÉ ✔ (bout-en-bout)
- `npm install` OK (exit 0).
- `npm run setup:python` : le script npm inline était **cassé sous Windows** (espaces du
  chemin Google Drive + slashes via cmd). **Corrigé** : remplacé par
  `scripts/setup-python.mjs` (Node, multiplateforme, robuste aux espaces). venv créé,
  dépendances installées (`requests, bs4, lxml, dns, phonenumbers` importent OK).
- `migrate` + `seed --demo` OK → `data/softimmo.db` (110 réfs, 58 fournisseurs, démo).
- Serveur démarré : **API sur :8787**, file de jobs active. `/api/health` → `ok:true`,
  **pont Python fonctionnel** (`+14165550142`), `ai:false` (aucune clé, attendu).
  `/api/stats` renvoie les données démo.
- Reste à faire (rapide, session 2) : `npm run dev` + vérif visuelle de l'UI dans le
  navigateur (light/dark) — le backend et le pont Python sont déjà confirmés.

---

## Prochaines tâches (Session 3) — Phase 2 : Module 1 (Analyse de propriété)
1. **Détail de propriété** (page `/properties/:id`) consommant `/properties/:id/bundle` :
   onglets Caractérisation (multi-bâtiments), Rent roll (unités), Dépenses, Rapports,
   Transactions, Comparables.
2. **Formulaires** d'édition par bâtiment / unité / dépense (CRUD déjà dispo côté API).
3. **Tableau de rentabilité** (calcul côté serveur, déterministe, sans IA) : revenus
   bruts → effectifs → RNE ; **MRB, MRN, TGA/cap rate, $/porte** ; contrôle de cohérence
   (alerte ratio dépenses < 30 %). Voir `docs/03-feature-catalog.md` §1 et `docs/08`.
4. **Détection d'anomalies** de superficie ; import assisté (extract + mapping).
5. Base du moteur **`render/`** (HTML→PDF) avec en-têtes/pieds de conformité (mentions,
   avertissement « opinion ≠ évaluation ») — partagé avec Modules 2-5.
6. i18n : compléter les catalogues au fil des nouvelles pages.

## Tâches reportées
- Moteur `render/` (déplacé en Phase 2, partagé).
- Durcissement des schémas zod (enums/types) des entités métier.
- Renommage final du slug `leadgen` (Phase 8).

## Rappels
- Seul `SoftImmoDev` est modifiable. Conformité légale non négociable (voir `CLAUDE.md`).
- Closeout à chaque fin de session (`docs/05-dev-process.md`).
