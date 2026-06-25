# Softimmo

SaaS d'assistance au **courtage immobilier résidentiel et commercial au Québec**.
Frontend React + Vite, backend Express + `node:sqlite`, workers Python (recherche /
crawl / extraction / vérification) et couche IA Claude optionnelle.

> Mono-utilisateur pour l'instant (pas de login), **UI bilingue FR/EN** (défaut FR).
> Conçu pour pouvoir être intégré plus tard dans un SaaS multi-tenant.
>
> **Slug interne hérité** : `leadgen` subsiste dans certains noms internes (schéma DB,
> quelques variables) en cours de migration progressive vers `softimmo` (voir
> `docs/04-action-plan.md`, Phase 8).

## Les 6 modules

1. **Analyse de propriété** — caractérisation multi-bâtiments, rent roll, dépenses,
   rentabilité, historique de transactions, rapports d'expertise, étude de trafic.
2. **Évaluation** (vendeur/acheteur) — ACM + méthodes comparaison/coût/revenu, par type
   de bien (unifamilial → RPA), données de secteur.
3. **Proposition d'offre de services** — vendeurs et acheteurs.
4. **Matériel marketing** — brochure, pub moyenne, Facebook (fil + Marketplace),
   Instagram, X, LinkedIn, diapos carrousel vidéo.
5. **Trousse de soutien client** — guides et checklists.
6. **Recherche & enrichissement de contacts** — l'outil d'enrichissement intégré
   (socle technique), ré-orienté immobilier : générer / enrichir / vérifier / gérer
   companies & contacts (waterfall plan → search → crawl → resolve → pattern → verify →
   score), avec provenance.

Voir `docs/01-vision-modules.md` et `docs/03-feature-catalog.md`.

## Prérequis

- **Node.js ≥ 22** (`node:sqlite` intégré, aucune build native). Testé Node 24.
- **Python ≥ 3.9** (workers). Testé Python 3.11.

Aucun serveur de base de données, ni Redis, ni toolchain de build requis.

## Démarrage rapide

```bash
npm install                     # workspaces server + web
npm run setup:python            # venv Python + requirements (Windows)
# npm run setup:python:unix     # macOS / Linux
node server/src/db/seed.js --demo   # données de référence + marketplace (+ démo)
npm run dev                     # API :8787 + web :5180
```

Ouvrir **http://localhost:5180**.

En un seul processus (l'API sert l'UI buildée sur :8787) :

```bash
npm run build && npm start
```

## Configuration

Copier `.env.example` → `.env` (port, politesse crawl, sonde SMTP, clé IA/modèle, clé
Google CSE optionnelle). Tout est aussi configurable dans **Réglages** ; les clés sont
stockées localement dans SQLite.

```
PORT=8787
PYTHON_BIN=python/.venv/Scripts/python.exe   # Unix: python/.venv/bin/python
ANTHROPIC_API_KEY=                            # optionnel — active la couche IA
SMTP_PROBE_ENABLED=false                       # vérif courriel renforcée, off par défaut
```

## Arborescence

```
SoftImmoDev/
├─ CLAUDE.md          Règles impératives (à lire en premier)
├─ LAST_SESSION.md    État de la dernière session + prochaines tâches
├─ server/            API Express, couche SQLite, moteur, workers Python
├─ web/               SPA React + Vite (design system Softimmo)
├─ data/              softimmo.db (créé au premier lancement)
└─ docs/              vision, architecture, catalogue, plan, conformité, recherche
   └─ enrichment/     docs héritées du socle d'enrichissement (référence)
```

## Documentation

- `docs/00-prompt-de-depart.md` — introduction de session.
- `docs/01-vision-modules.md` — vision et 6 modules.
- `docs/02-architecture.md` — pile et conception.
- `docs/03-feature-catalog.md` — fonctionnalités par module.
- `docs/04-action-plan.md` — roadmap par sessions.
- `docs/05-dev-process.md` — boucle de session + closeout.
- `docs/06-conformite-legale.md` — LCI/OACIQ/Loi 25/Loi 96 + garde-fous.
- `docs/07-marketing-specs.md` — formats marketing.
- `docs/08-research-findings.md` — recherche (besoins, concurrents, données, sources).
- `docs/enrichment/` — doc technique/utilisateur et guide d'intégration du socle.

## Conformité (rappel)

Une sortie d'évaluation est une **« opinion de la valeur marchande »** produite par un
courtier — **jamais une « évaluation »** (réservée à l'évaluateur agréé, OEAQ). Mentions
de publicité OACIQ, Loi 25 (consentement), Loi 96 (français prééminent) intégrées au
produit. Voir `docs/06-conformite-legale.md`.

## Recherche web gratuite

Le scraping SERP gratuit (DuckDuckGo / Bing / Mojeek) peut être limité selon le réseau.
La recherche est un étage **best-effort, pluggable** : le crawl direct, la génération de
patterns de courriel et la vérification fonctionnent sans elle. Pour une recherche
fiable, ajouter une clé Google Programmable Search dans **Réglages** (gratuit : 100/jour).
