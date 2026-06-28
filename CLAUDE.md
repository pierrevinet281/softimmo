# CLAUDE.md — Projet Softimmo

> Guide opérationnel pour toute session Claude travaillant sur **Softimmo**, le SaaS
> d'assistance au courtage immobilier de Pierre Vinet (courtier résidentiel et
> commercial, Québec). Lire ce fichier **en entier** au début de chaque session,
> puis lire `LAST_SESSION.md` pour reprendre le fil.

---

## 0. RÈGLES IMPÉRATIVES (à ne jamais enfreindre)

### 0.1 Périmètre des fichiers
- **Le SEUL répertoire que tu peux modifier est** :
  `D:\Google Drive\Personal Business\Logiciels\Softimmo\SoftImmoDev`
- **Tous les autres répertoires fournis sont en LECTURE SEULE.** Ne jamais y écrire,
  renommer, déplacer ou supprimer quoi que ce soit. Ils servent uniquement de
  référence et de gisement de gabarits.
- **Exception (lanceurs)** : le dossier voisin `..\Scripts` (`…\Softimmo\Scripts`) contient
  les scripts de démarrage/arrêt (`Demarrer-Softimmo.bat`, `Arreter-Softimmo.bat`,
  `Demarrer-Softimmo-PRODUCTION.bat`, `Installation-Initiale.bat`) — créés à la demande
  explicite de l'utilisateur. Y écrire des **lanceurs uniquement**.
- Le code et le contenu de
  `D:\Google Drive\Personal Business\Logiciels\Backup-Enrichissement de contacts`
  **ne peuvent pas être modifiés à la source**. Ils ont été **copiés intégralement**
  dans `SoftImmoDev` ; toute adaptation se fait **uniquement** dans `SoftImmoDev`.

### 0.2 Conformité légale (Québec) — non négociable
Toujours travailler dans le respect des lois, notamment :
- **Loi sur le courtage immobilier (LCI, RLRQ c. C-73.2)** et règlement
  **C-73.2, r.1** (déontologie + publicité), administrés par l'**OACIQ**.
- **Code civil du Québec (CCQ)**.
- **Loi 25** (protection des renseignements personnels).
- **Loi 96 / Charte de la langue française** (français prééminent dans tout contenu
  commercial destiné aux consommateurs québécois — en vigueur depuis le 1er juin 2025).

Garde-fous **produit** à coder et à ne jamais contourner (détaillés dans
`docs/06-conformite-legale.md`) :
1. Une sortie d'évaluation est une **« opinion de la valeur marchande » produite par
   un courtier — JAMAIS une « évaluation »** (acte/titre réservé à l'évaluateur agréé,
   OEAQ). Ne jamais étiqueter une sortie « évaluation », « rapport d'évaluation », ni
   employer « É.A. » pour le courtier. Insérer automatiquement l'avertissement légal.
2. Toute publicité/marketing exportée porte le **nom de l'agence + désignation** et le
   **nom du courtier + désignation** ; bloquer les titres « spécialiste » prohibés ;
   « VENDU » conditionné au consentement écrit du vendeur.
3. **Ne pas divulguer les prix de vente des comparables** au client avant leur
   publication au Registre foncier ; **caviarder** toute donnée identifiant un vendeur
   sur les fiches de comparables avant partage.
4. **Loi 25** : capture de consentement séparée/explicite/horodatée, politique de
   confidentialité, coordonnées du RPRP, rétention + suppression sécurisée, respect de
   l'opt-out de prospection. Pas de listes nominatives sans consentement enregistré.
5. **Loi 96** : génération **bilingue** par défaut pour le marché québécois, avec le
   **français au moins aussi prééminent** que l'anglais (idéalement FR en premier).

> En cas de doute légal, signaler l'incertitude dans la sortie plutôt que d'affirmer.
> Les repères de marché (cap rates, MRB, $/pi²) sont des **valeurs par défaut éditables,
> jamais des vérités** — toujours présentés comme tels.

---

## 1. Mission du produit

Softimmo assiste le courtier sur tout le cycle d'un mandat, via **6 modules** dans une
seule application web mono-utilisateur (pour l'instant) :

1. **Analyse de propriété** — étude du sujet, tout genre (unifamilial, plex/multi,
   commercial, industriel, terrain, RPA…) : caractérisation multi-bâtiments, rent roll,
   dépenses, rentabilité, historique de transactions, rapports d'expertise, étude de
   trafic.
2. **Évaluation** (point de vue vendeur **et** acheteur) — ACM + 3 méthodes
   reconnues (comparaison, coût, revenu), repères par type, données de secteur.
3. **Proposition d'offre de services** (acheteurs et vendeurs) — inspirée et améliorée
   de `Offre Ubee Rive-Nord Rehaussée.pdf`.
4. **Production de matériel marketing** — brochure (pub longue), pub moyenne (Kijiji),
   fil Facebook, Facebook Marketplace, Instagram, X, LinkedIn, diapos carrousel vidéo.
5. **Trousse de soutien client** — guides vendeur/acheteur, checklists, documents de
   préparation.
6. **Recherche & enrichissement de contacts** — trouver prospects (vendeurs/acheteurs)
   et acheteurs pour ses vendeurs. C'est l'**intégration littérale** de l'outil
   d'enrichissement existant (socle technique de l'app), ré-orienté immobilier.

Détails complets : `docs/01-vision-modules.md` et `docs/03-feature-catalog.md`.

---

## 2. Architecture & tech stack

L'app d'enrichissement copiée est le **socle** : son shell (sidebar/topbar/thème),
ses design tokens, sa DB, sa file de jobs, ses réglages, sa couche IA et ses workers
Python sont l'**infrastructure partagée** de tous les modules.

- **Frontend** : React 18 + Vite, React Router, TanStack Query, icônes **Lucide**
  (jamais d'emoji dans l'UI), CSS à tokens (light/dark via `data-theme`).
- **Backend** : Node ≥ 22 (testé Node 24) + Express + **`node:sqlite`** (aucune build
  native). Validation **zod**. Fichiers via `xlsx`, `csv-parse`/`csv-stringify`.
- **Workers Python** (≥ 3.9, ici 3.11) : `search.py`, `extract.py`, `verify_email.py`,
  `phone.py` (requests + BeautifulSoup + dnspython + phonenumbers). **Réutilisés** pour
  la recherche de marché/comparables, pas seulement l'enrichissement de contacts.
- **Couche IA** : SDK Anthropic (`@anthropic-ai/sdk`), modèle par défaut
  `claude-opus-4-8`. **Optionnelle** : tout dégrade vers des heuristiques si la clé est
  absente. Alimente l'analyse, l'évaluation et la génération de texte marketing.
- **DB** : SQLite (`data/softimmo.db`), colonnes `tenant_id` nullables prévues pour un
  futur multi-tenant. Toute migration est **idempotente**.

Architecture détaillée : `docs/02-architecture.md`.

### Commandes
```bash
npm install            # installe les workspaces server + web
npm run setup:python   # crée python/.venv + installe requirements (Windows)
npm run migrate        # applique le schéma (idempotent)
npm run seed           # données de référence + catalogue marketplace (--demo en option)
npm run dev            # API (:8787) + web Vite (:5180) en parallèle
npm run build && npm start  # build web puis sert API+UI sur :8787
```

---

## 3. Conventions de développement

- **Style UI** : conforme à `../Style/Softimmo-Design-System.md` (tokens CSS,
  `var(--color-*)`, jamais de hex en dur ; pas de coins « pill » > 8px ; aucun emoji ;
  Outfit titres / Inter corps / JetBrains Mono pour montants & IDs ; vert `#07D581` =
  action, bleu `#67C8FA` = info). Le nom « Netritious » dans ce fichier de style
  appartient à une autre app **sans rapport** : ignorer le nom, appliquer les specs.
- **i18n** : UI **bilingue FR/EN** avec bascule (défaut FR). Strings via catalogue,
  pas de texte codé en dur dans les composants quand c'est évitable.
- **ESM JavaScript** partout côté Node/React. Python pour les workers d'I/O réseau.
- **Minimiser l'IA au runtime** : l'IA (jetons Claude) sert à *bâtir* le logiciel ; le
  produit livré doit fonctionner **de façon autonome sans appels IA**, sauf si absolument
  essentiel (et alors optionnel, avec repli déterministe). Pour chaque fonctionnalité,
  concevoir d'abord la voie **déterministe** (Python/JS, gabarits, données saisies,
  wizards, parsing). S'applique en particulier au **Module 4 (marketing)**. Documenter et
  justifier tout usage IA au runtime.
- **Provenance** : toute donnée enrichie/recherchée enregistre sa source, sa méthode et
  sa confiance (`field_provenance`). Traçabilité = exigence légale et produit.
- **Pas de données codées en dur** : références, catalogues et démos vivent dans des
  fichiers seed JSON sous `server/src/db/seeds/`.
- Garder le moteur **pur** (retourne des données) séparé de la **persistance**
  (repositories) et de l'**orchestration** (file de jobs).
- **Rendu PDF/PPTX = déterministe** (ReportLab / python-pptx), jamais d'HTML imprimé. Le **jumeau
  PPTX miroite le PDF** aux mêmes coordonnées (voir `documentation/ARCHITECTURE.md` §4 et la mémoire
  `pptx-twin-mirrors-pdf`), **pas** un formulaire structuré.
- **Aller-retour PPTX (brochure RPA)** : modèle **layout-driven granulaire** — chaque forme nommée
  `RPA::<slot>` (texte éditable + position) ou `RPAp::<slot>` (position seule : logos/formes/MAJUSCULES)
  est capturée par l'ingest dans `data.layout` et appliquée par **les deux** moteurs. **Toute nouvelle
  primitive de dessin doit accepter un slot** pour rester round-trippable. Garde-fou `data.draft`
  (sync → Approve/Reject/Reset) sur tous les sync PPTX. **Bibliothèque de brochures** = documents
  `brochure_variant` (cloner pour éditer, original verrouillé). Détails : *Brochure RPA.md*, *Assets
  courtier.md*.

---

## 4. Boucle de session (voir `docs/05-dev-process.md`)

Chaque session suit : **(a)** lire CLAUDE.md + LAST_SESSION.md → **(b)** charger les
prochaines tâches → **(c)** développer en continu → **(d)** closeout :
1. Inspecter le répertoire ; mettre à jour la **GitHub issue #53** (tâches reportées),
   `PLAN_GLOBAL.md`, `documentation/ARCHITECTURE.md` et `documentation/Pages Technical
   Documentation/` (pages touchées).
2. Mettre à jour `LAST_SESSION.md` (concis : résumé, tâches reportées, prochaines tâches).
3. `git commit` + `push`.
4. PR → squash & merge.
5. Fast-forward sur `main`.
6. Inviter l'utilisateur à faire un **backup** : `..\Backup-Softimmo\Lancer-Backup.bat`
   (consigner le hash dans `documentation/BACKUP_LOG.md`).
7. Fermeture de session.

**Remote Git** : `https://github.com/pierrevinet281/softimmo`.
**Docs internes** : feuille de route `PLAN_GLOBAL.md` ; architecture & pages dans
`documentation/` ; specs de conception dans `docs/00`→`12` ; backlog = issue #53.
**Lancement** : voir `..\Scripts\` (dev `:5180`/`:8787`, arrêt ciblé par ports).

---

## 5. Ressources de référence (lecture seule)

| Ressource | Chemin | Usage |
|---|---|---|
| Design system | `../Style/Softimmo-Design-System.md` | Specs visuelles (ignorer le nom de marque) |
| Logo | `../Style/logo_clean.png` | Identité |
| Offre de services modèle | `../Offre Ubee Rive-Nord Rehaussée.pdf` | Module 3 |
| Brochure unifamiliale | `../Brochure unifamiliales/` | Module 4 (gabarit) |
| Documents de présentation | `../Documents de présentation/` | Modules 3-5 (guides, scripts de vente) |
| Formulaire consentement Loi 25 | `../Formulaire de Consentement (Loi 25).docx` | Module 6 / conformité |
| Outil d'enrichissement (source) | `../../Backup-Enrichissement de contacts/` | Socle (déjà copié — NE PAS modifier la source) |
| Dossiers clients réels | `..\..\Immo PIERRE VINET\Clients Immo\` | Gabarits marketing & exemples d'analyses (lecture seule) |

> Les gabarits marketing cités dans la requête (RPA `rpa_mlt.pdf`, pubs Tours Gouin)
> sont dans les dossiers clients ci-dessus ; les consulter au moment de bâtir le
> Module 4.
