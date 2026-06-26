# LAST_SESSION.md

> Fichier de continuité entre sessions. Lu au début de chaque session (après
> `CLAUDE.md`). Mis à jour au closeout de chaque session.

---

## ▶ REPRISE RAPIDE (à lire en premier)

**Pour reprendre, il suffit d'un prompt du genre :**
> « Nouvelle session Softimmo. Lis `CLAUDE.md` puis `LAST_SESSION.md` (et `docs/00`), puis
> enchaîne sur les *Prochaines tâches*. Mode continu. »

**Où on en est (après 6 sessions, tout sur `main`) :**
- **Framework complet** : `CLAUDE.md` + docs `00`→`12` (vision, archi, catalogue, plan,
  dev-process, conformité, specs marketing `09`, évaluation `10`, Local Logic `11`, ACM `12`).
- **Phase 1 livrée** : socle d'enrichissement re-brandé Softimmo + modèle de données métier
  (9 tables + repos + routes CRUD + `/properties/:id/bundle`), i18n FR/EN + bascule,
  navigation par module, page **Propriétés**. **L'app démarre** (`npm run dev` → web `:5180`,
  API `:8787`).
- **Phase 2 — Module 1 (Analyse de propriété) CONSTRUIT** (session 6) : **page détail**
  `/properties/:id` à 7 onglets (Caractérisation+bâtiments, Rent roll, Dépenses, Rentabilité,
  Transactions, Comparables, Rapports) ; **CRUD générique** (modals config-driven) pour
  bâtiments/unités/dépenses/transactions ; **moteur de rentabilité déterministe**
  (`engine/finance.js` : GPI→EGI→RNE, MRB, MRN, TGA, $/porte, ratio dépenses + alertes) et
  **détection d'anomalies de superficie**, exposés par `GET /properties/:id/analysis`.
  Testé bout-en-bout (calculs exacts) ; build web OK.
- **Specs prêtes pour la construction** : Évaluation (`10`+`11`+`12`, dont ACM détaillée),
  Marketing (`09`). Restent en placeholders côté UI.

**Prochaine session = Phase 3 : Module 2 (Évaluation)** — spec complète (`10`/`11`/`12`,
ACM). Voir *Prochaines tâches* en bas. (Restes Module 1 = import assisté + moteur `render/`.)

**Rappels** : seul `SoftImmoDev` est modifiable ; conformité non négociable ; déterministe
d'abord (IA pour bâtir, pas au runtime) ; closeout à chaque fin (commit→PR→squash→ff main→
backup). Remote `https://github.com/pierrevinet281/softimmo`. Backup : `..\Backup-Softimmo\Lancer-Backup.bat`.

---

## Session 6 — BUILD Phase 2 : Module 1 (Analyse de propriété) (2026-06-26)

### Réalisé
- **Moteur financier déterministe** `server/src/engine/finance.js` (PUR, sans IA) :
  `computeProfitability()` → revenus bruts potentiels (GPI) → effectifs (EGI, vacance réelle
  + taux structurel éditable) → **RNE**, puis **MRB, MRN, TGA/cap rate, $/porte, RNE/porte,
  ratio de dépenses** ; alertes de cohérence (ratio dépenses < 30 %, RNE négatif).
  `detectAreaAnomalies()` : empreinte > terrain, habitable > empreinte × étages, somme unités
  > habitable, nb bâtiments déclaré vs saisi. Défauts éditables documentés (jamais des vérités).
- **Endpoint** `GET /properties/:id/analysis` (`routes/business.js`) : `value` via `?value=`
  sinon repli sur le prix de la transaction active la plus récente ; `?vacancy=` (0..1).
  Retourne `{ value, valueSource, financials, anomalies }`.
- **Page détail** `web/src/pages/PropertyDetail.jsx` (route `/properties/:id`, lignes de la
  liste Propriétés cliquables) : **7 onglets** — Caractérisation (kv + bâtiments), Rent roll,
  Dépenses, **Rentabilité** (KPI cards + ventilation des dépenses + champs valeur/vacance +
  alertes), Transactions, Comparables (lecture seule, renvoi au module Évaluation), Rapports.
- **CRUD générique config-driven** : `EntityTable` + `EntityForm` (modals) pilotés par des
  specs de champs/colonnes par entité — DRY, miroir des fabriques repo/route côté serveur.
  Couvre bâtiments, unités, dépenses, transactions (API CRUD déjà en place).
- **Formatage** `web/src/lib/format.js` (fr-CA : `money`/`num`/`pct`/`mult`). Styles ajoutés
  (`.kpi`, `.notice`, `.crumb`, `.num`…). **i18n FR/EN** complété (préfixe `d.*`).
- **Vérifs** : `vite build` OK (1652 modules) ; endpoint testé bout-en-bout sur un triplex
  (GPI 45 840, EGI 29 040, RNE 19 200, TGA 2,75 %, MRB 15,2, $/porte 233 000) ; données de
  test supprimées (cascade).

### Décisions (session 6)
- **`value` (réf. ratios) non stockée sur la propriété** : query param + repli transaction
  active. Les ratios marché (MRB/MRN/TGA/$ porte) restent **null tant qu'aucune valeur** n'est
  fournie — pas d'invention de chiffre.
- **Comparables/Rapports en lecture seule** dans Module 1 : l'ACM (curation, ajustements) est
  construite dans le **Module 2 (Évaluation)** pour éviter le doublon.
- **CRUD piloté par config** (specs de champs) plutôt que des formulaires manuels par entité —
  cohérent avec les fabriques du socle, extensible aux futurs modules.

---

## Session 5 — ACM : grille d'ajustements explicable (2026-06-25)

- `docs/12` §2.1 ajoutée : **exigence de ventilation explicable** des ajustements pour le
  **courtier ET le client**. Chaque ligne = caractéristique, valeur sujet vs comparable,
  écart, taux/paramètre, **montant avec formule (`écart × taux`)**, sens, **explication en
  texte clair** ; total par comparable (vendu → ajusté) ; **grille de marché** (comparables
  en colonnes) ; **2 vues** (courtier complète / client simplifiée). Texte par gabarits
  (déterministe, IA optionnelle pour le style). Forme JSON de `comparables.adjustments`
  précisée. UI (§8) mise à jour. S'applique aussi aux autres données de soutien (chaque
  chiffre traçable et expliqué).

---

## Session 4 — Spec ACM (comparables, ajustements, prix) (2026-06-25)

### Réalisé
- Étude des fichiers d'exemple : **Matrix « 4 par page courtier »**
  (`Sample ACM/4_par_page_courtier_Imp_rial_8299.pdf`) et **stats APCIQ**
  (`Statistiques/pdf_fr_statistics_STATS_MUNGENRE_202605O.pdf`) — extraits via `pypdf`.
- **Spec ACM** `docs/12-acm-comparables.md` (cœur du module Évaluation, déterministe) :
  téléversement PDF Matrix → extraction (statut/prix/dates/JSM/sup./année/éval./inclusions)
  → **ajustements** des vendus (superficie × coût construction, inclusions piscine/foyer/…,
  âge, date de vente) → **prix de vente attendu** ; **prix d'inscription** par règle de 3
  sur le ratio APCIQ « prix de vente / prix inscrit » ; **éval. foncière** = corroboration
  seulement (alerte si gros écart) ; **expirés** = plafond ; **en vigueur** = concurrence ;
  données Evalo/marché/revenus = ajustements additionnels. Garde-fous APCIQ (indicatif,
  exclusions 50-150 %, prudence). Ajouts de schéma listés (`docs/12` §7).
- Références ajoutées dans `docs/10` et `docs/04` (Phase 3).

### Décisions (session 4)
- **ACM = méthode principale** du module Évaluation ; tout le reste (AVM, environnement,
  démo, revenus, éval. foncière) = **soutien/ajustements**, jamais la base du prix.
- Extraction PDF **déterministe** (pdfplumber/pypdf) ; IA en repli seulement.
- Paramètres d'ajustement = **défauts éditables** (coût constr. $/pi², prix inclusions,
  âge, % appréciation).

---

## Session 3 — Menu « Mise en marché » + specs Évaluation/Local Logic (2026-06-25)

### Réalisé
- **Réorg. du menu « Mise en marché »** (ordre chronologique d'usage) + renommages, dans
  `App.jsx` + i18n FR/EN : **Assets courtier** (nouveau, `/assets-courtier`), **Offre de
  services** (`/offres`), **Trousse démarrage** (`/trousse-demarrage`, ex-« Trousse client »),
  **Trousse marketing** (`/trousse-marketing`, ex-« Matériel marketing »). Taxonomie notée
  dans `docs/01`. Vérifié : Vite compile.
- **Spec module Évaluation** `docs/10-evaluation-module.md` (inspirée d'**Evalo.ca** +
  concurrents) : AVM marchande/locative (statistique, sans IA), indice de confiance,
  comparables, **enjeux environnementaux**, intelligence marché/démo, fourchette qualité,
  approche revenus, et **carte 3D dynamique Google Aerial View** (5000/mois gratuits ;
  `GOOGLE_MAPS_API_KEY` ajoutée à `.env.example`, 3D optionnelle + repli statique).
- **Analyse Local Logic** `docs/11-local-logic-analysis.md` : reproductible gratuitement
  ~70 % (StatCan/OSM/Données Québec/Montréal) ; verrous payants = prix de vente (MLS non
  ouvert), scoring propriétaire, score de bruit, couverture hors-Montréal. Prix LL non public
  (devis annuel ; ~100-250 $US/mois rapportés). **Reco : ne pas en dépendre ; connecteur
  Marketplace optionnel.** Tableau comparatif complet dans la doc.

### Décisions (session 3)
- Module Évaluation = **données gratuites d'abord** (StatCan/OSM/Données Québec) ; Local Logic
  et données de prix payantes = **optionnelles** (Marketplace, clé utilisateur).
- Carte 3D = **Google Aerial View** dans les quotas gratuits, optionnelle (principe coût min.).
- AVM = **modèle statistique déterministe** (pas d'IA par rapport).

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

## Prochaines tâches — BUILD Phase 3 : Module 2 (Évaluation)
> Spec complète : `docs/10` (Evalo, AVM, carte 3D), `docs/11` (Local Logic), `docs/12`
> (ACM Matrix, ajustements, grille explicable courtier+client). **Construire**, pas spécifier.
1. **Page Évaluation** (`/evaluation`) reliée à une propriété : choix du sujet + points de vue
   vendeur/acheteur. Structure à onglets (méthodes + réconciliation + sortie).
2. **ACM (méthode principale, déterministe)** : saisie/curation des comparables (réordonner,
   noter pire/égal/meilleur, pondérer), **grille d'ajustements explicable** (chaque ligne =
   écart × taux, montant, explication ; total vendu→ajusté ; 2 vues courtier/client) selon
   `docs/12` §2.1. Prix de vente attendu + prix d'inscription (ratio APCIQ). Paramètres =
   défauts éditables.
3. **Méthodes coût et revenu** (selon type) + **réconciliation** pondérée justifiée. Réutiliser
   `engine/finance.js` (RNE÷TGA pour la capitalisation directe).
4. **Garde-fous conformité** : sortie = **« opinion de valeur marchande »** (jamais
   « évaluation ») + avertissement légal auto ; **caviardage vendeur** sur exports client ;
   ne pas divulguer prix de comparables avant publication au Registre foncier.
5. Base du moteur **`render/`** (HTML→PDF) avec en-têtes/pieds de conformité (mentions,
   avertissement « opinion ≠ évaluation ») — **partagé Modules 2-5** ; première sortie =
   opinion de valeur + annexe sources + sommaire exécutif.

## Restes Module 1 (à reprendre quand utile)
- **Import assisté** depuis fiches Centris / extraits / rôle (workers extract + mapping).
- **Téléversement de fichiers** pour les rapports d'expertise (champ `file_path`).
- Étude de trafic (DJMA via MTQ/Données Québec) pour commercial/terrain.

## Tâches reportées
- Moteur `render/` (partagé Modules 2-5).
- Durcissement des schémas zod (enums/types) des entités métier.
- Renommage final du slug `leadgen` (Phase 8).

## Rappels
- Seul `SoftImmoDev` est modifiable. Conformité légale non négociable (voir `CLAUDE.md`).
- Closeout à chaque fin de session (`docs/05-dev-process.md`).
