# LAST_SESSION.md

> Fichier de continuité entre sessions. Lu au début de chaque session (après
> `CLAUDE.md`). Mis à jour au closeout de chaque session.

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

## Prochaines tâches (Session 2)
1. **Finaliser/confirmer le démarrage** du socle sous Softimmo (install, venv, seed, dev,
   UI light/dark). Corriger tout problème.
2. **Phase 1 — Fondations Softimmo** (`docs/04-action-plan.md`) :
   - Schéma DB : tables `properties`, `buildings`, `units`, `expenses`, `comparables`,
     `reports`, `transactions`, `documents`, `clients` + liaisons (migration idempotente).
   - Repositories + routes CRUD (zod, provenance, activité).
   - Shell de navigation Softimmo par module + i18n FR/EN (catalogues + bascule).
   - Base du moteur `render/` (HTML→PDF) avec en-têtes/pieds de conformité.
3. Si temps : amorcer **Module 1 (Analyse de propriété)** — formulaire de caractérisation.

## Tâches reportées
- Câblage i18n complet (amorcé en Phase 1).
- Renommage final du slug `leadgen` (Phase 8).

## Rappels
- Seul `SoftImmoDev` est modifiable. Conformité légale non négociable (voir `CLAUDE.md`).
- Closeout à chaque fin de session (`docs/05-dev-process.md`).
