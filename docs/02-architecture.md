# 02 — Architecture

Softimmo réutilise l'architecture éprouvée du socle d'enrichissement et l'étend aux 6
modules. Le socle hérité est documenté en détail dans `docs/enrichment/02-architecture.md`
(référence) ; ce document décrit l'**architecture cible Softimmo**.

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  web/  React 18 + Vite  (UI bilingue FR/EN, design tokens)     │
│   Shell: Sidebar + Topbar + thème · TanStack Query · Lucide    │
│   Modules: Analyse · Évaluation · Offre · Marketing · Trousse  │
│            · Contacts/Enrichissement · Dashboard · Réglages    │
└───────────────▲──────────────────────────────────────────────┘
                │  /api (proxy Vite → :8787)
┌───────────────┴──────────────────────────────────────────────┐
│  server/  Express + node:sqlite                                │
│   routes/ (REST par ressource)  ·  zod  ·  activity log        │
│   repositories/ (seul accès SQL)                               │
│   engine/  (pur) : waterfall enrichissement, scoring, queue    │
│              + moteurs Softimmo : valuation, analysis, render  │
│   engine/ai/ : couche Claude (optionnelle, repli heuristique)  │
│   services/python.js : pont vers workers Python                │
└───────────────▲───────────────────────────▲──────────────────┘
                │ spawn JSON stdin/stdout     │ Anthropic SDK
┌───────────────┴───────────┐   ┌────────────┴─────────────────┐
│ server/python/ workers     │   │  API Claude (claude-opus-4-8) │
│  search · extract · verify │   │  analyse, évaluation, copy    │
│  · phone (+ futurs:        │   └──────────────────────────────┘
│  comparables, market, pdf) │
└────────────────────────────┘
                │
        ┌───────┴────────┐
        │ data/softimmo.db│  (SQLite, tenant_id-ready)
        └────────────────┘
```

## Couches

### Frontend (`web/`)
- React + Vite, React Router, TanStack Query (cache + refetch), Lucide (icônes).
- **Design tokens** (`web/src/styles/tokens.css`) conformes au design system : light/dark
  via `data-theme`, `var(--color-*)`, aucun hex en dur, aucun emoji, rayons ≤ 8px sur
  cartes/boutons/badges.
- **i18n** bilingue FR/EN (catalogues `web/src/i18n/`), bascule persistée.
- Le **shell** (Sidebar, Topbar, thème, composants UI) est partagé par tous les modules.

### Backend (`server/`)
- **routes/** : un routeur par ressource ; validation **zod** ; journalisation
  d'activité ; secrets masqués en réponse.
- **repositories/** : **seul** point d'accès SQL (facilite l'ajout futur de `tenant_id`).
- **engine/** : logique pure (retourne des données, ne persiste pas).
  - Hérité : `waterfall.js` (enrichissement), `scoring.js`, `discover.js`, `apply.js`,
    `domains.js`, `emailPatterns.js`, `queue.js` (file de jobs SQLite, pause/resume),
    `workers.js` (pont Python), `ai/`.
  - **À ajouter (Softimmo)** : moteurs `analysis/`, `valuation/` (comparaison, coût,
    revenu, ratios MRB/MRN/TGA/cap rate), `render/` (génération de documents :
    HTML→PDF, exports marketing aux bons formats).
- **services/python.js** : spawn des workers, contrat JSON stdin/stdout, timeouts.
- **lib/** : `config.js` (env + défauts), `logger.js`, `errors.js`.

### Workers Python (`server/python/`)
- Hérités : `search.py` (multi-moteur), `extract.py` (fetch + BeautifulSoup),
  `verify_email.py` (syntaxe + MX + SMTP opt.), `phone.py` (E.164 + type).
- **Réutilisés pour la recherche de marché** (comparables, démographie, trafic) — pas
  seulement l'enrichissement de contacts.
- Contrat : chaque worker lit **un** JSON sur stdin, écrit **un** JSON sur stdout
  (`shared/io.py`), HTTP poli (`shared/net.py`), regex (`shared/patterns.py`).

### Couche IA (`server/src/engine/ai/`)
- SDK Anthropic, modèle `claude-opus-4-8` par défaut, **optionnelle** (clé absente →
  heuristiques). Usages : génération de requêtes, résolution d'entité, normalisation de
  titres, scoring de confiance ; **et pour Softimmo** : synthèse d'analyse, réconciliation
  d'évaluation, rédaction de matériel marketing/offres/guides (toujours en respectant les
  garde-fous légaux).

### Données (`data/softimmo.db`)
- SQLite via `node:sqlite`. Migrations **idempotentes** (`server/src/db/migrate.js`).
- Schéma hérité (companies, contacts, field_provenance, lists, jobs, providers,
  settings, activity, reference_data…) **+ tables Softimmo** à ajouter : `properties`,
  `buildings`, `units`, `expenses`, `comparables`, `reports`, `transactions`,
  `documents`, `clients`, et tables de liaison (ex. `lead_property_links`).
- Colonnes `tenant_id` nullables conservées → multi-tenant mécanique plus tard.

## Décisions d'architecture

1. **Le socle d'enrichissement EST l'app** : on ne crée pas une sous-app isolée ;
   l'enrichissement devient une section de navigation et son infrastructure sert tout.
2. **Moteur pur ≠ persistance ≠ orchestration** : conserver cette séparation pour les
   nouveaux moteurs (analyse/évaluation/render).
3. **Workers Python partagés** : la recherche web de marché passe par les mêmes workers.
4. **IA dégradable** : aucune fonction critique ne doit *exiger* l'IA pour fonctionner.
5. **Renommage progressif** : slug interne `leadgen` → `softimmo` fait par étapes
   contrôlées (DB path, env, package names) pour éviter une migration risquée d'un coup.
   Documenté dans `LAST_SESSION.md` au fil de l'avancement.

## Intégration future multi-tenant
Voir `docs/enrichment/integration/INTEGRATION-GUIDE.md` : `tenant_id` déjà présent,
repositories = seul accès SQL, secrets à déplacer vers un coffre par tenant, file de
jobs remplaçable par un système hôte, i18n déjà amorcé.
