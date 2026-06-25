# 00 — Prompt de départ (introduction de session)

> À injecter (ou paraphraser) au début de **chaque nouvelle session** Claude pour
> recharger le contexte rapidement, puis enchaîner avec les tâches du jour.

---

## Qui je suis / le projet

Tu travailles sur **Softimmo**, un SaaS web qui assiste **Pierre Vinet**, courtier
immobilier résidentiel et commercial au Québec, sur tout le cycle d'un mandat.
L'application est **mono-utilisateur** pour l'instant (pas de login), **bilingue FR/EN**
(défaut FR), et destinée à pouvoir être intégrée plus tard dans un SaaS multi-tenant.

## Marche à suivre au démarrage

1. **Lis `CLAUDE.md`** (règles impératives : périmètre de fichiers, conformité légale,
   tech stack, conventions, boucle de session).
2. **Lis `LAST_SESSION.md`** (où on en est, tâches reportées, prochaines tâches).
3. **Consulte la task list** (outils de tâches) et `docs/04-action-plan.md` (roadmap).
4. Charge les **prochaines tâches** et développe **en continu** (mode Auto), en
   minimisant les interruptions à l'utilisateur.
5. À la fin : exécute le **closeout** (`docs/05-dev-process.md`).

## Ce qu'il faut savoir

- **Seul `SoftImmoDev` est modifiable.** Tout le reste est en lecture seule.
- L'app d'enrichissement de contacts a été **copiée intégralement** dans `SoftImmoDev`
  et sert de **socle** (shell UI, DB, jobs, settings, couche IA, workers Python). Les
  autres modules s'y greffent.
- Respecte **toujours** la LCI, le CCQ, les règlements de l'OACIQ, la Loi 25 et la
  Loi 96. Une sortie d'évaluation est une **« opinion de valeur marchande »**, jamais une
  « évaluation » (réservée à l'évaluateur agréé).
- Style strictement conforme à `../Style/Softimmo-Design-System.md` (tokens, pas
  d'emoji, pas de pill, vert `#07D581` = action).

## Les 6 modules

1. Analyse de propriété · 2. Évaluation (vendeur/acheteur) · 3. Offre de services ·
4. Matériel marketing · 5. Trousse de soutien client · 6. Enrichissement de contacts.

Voir `docs/01-vision-modules.md` et `docs/03-feature-catalog.md` pour le détail.

## Méthodologie analytique de référence

Les modules d'analyse/évaluation reproduisent la démarche utilisée par Claude dans de
vraies analyses immobilières (cartographier le dossier client → lire les fiches/index →
corriger les anomalies de superficie → étudier les comparables → rechercher le marché
sur le web → réconcilier → produire rapport + sources + sommaire exécutif). Voir
`docs/03-feature-catalog.md` §1-2 pour la transposition en fonctionnalités.
