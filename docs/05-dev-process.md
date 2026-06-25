# 05 — Procédure de développement (boucle de session)

Pour maximiser l'efficacité de Claude et éviter d'épuiser le contexte, on travaille par
**sessions** courtes et autonomes. Chaque session suit la même boucle.

## Boucle de session

### a. Ouverture
1. Lire `CLAUDE.md` (règles impératives).
2. Lire `LAST_SESSION.md` (état, tâches reportées, prochaines tâches).
3. Lire/paraphraser `docs/00-prompt-de-depart.md` pour recharger le contexte.
4. Consulter la task list et `docs/04-action-plan.md`.

### b. Injection des tâches
Charger les **prochaines tâches** (de `LAST_SESSION.md` / task list) comme objectifs de
la session. Créer les tâches manquantes.

### c. Développement (mode continu / Auto)
Développer sans interruptions inutiles. Marquer les tâches `in_progress` → `completed`.
Respecter : périmètre de fichiers (`SoftImmoDev` seulement), conformité légale, design
system, séparation moteur/persistance/orchestration, provenance des données.

### d. Closeout de session
1. **Inspecter** le répertoire ; mettre à jour la **task list** et la **documentation**
   touchée.
2. Mettre à jour **`LAST_SESSION.md`** : résumé de la session, décisions, tâches
   reportées, **prochaines tâches**.
3. **`git add` + `commit`** (message clair, en français) **+ `push`** la branche.
4. **PR** vers `main` → **squash & merge**.
5. **Fast-forward** local sur `main` (`git checkout main && git pull --ff-only`).
6. **Inviter l'utilisateur à faire un backup** (copie du dossier `SoftImmoDev` ou de
   `Softimmo`).
7. **Fermeture de session.**

### e. Nouvelle session
Recommencer à l'étape **a** sur une nouvelle branche `session-NN-<thème>`.

## Conventions Git

- Branche par session : `session-NN-<theme>` (ex. `session-02-data-model`).
- Remote : `https://github.com/pierrevinet281/softimmo`.
- Commits en français, à l'impératif, regroupés logiquement.
- `main` est protégé conceptuellement : on n'y commit pas directement ; on passe par PR.
- Ne jamais committer : `node_modules/`, `python/.venv/`, `data/*.db*`, `.env`
  (couverts par `.gitignore`).

## Commandes utiles

```bash
npm install            # workspaces server + web
npm run setup:python   # venv + requirements (Windows)
npm run migrate        # schéma idempotent
npm run seed           # références + marketplace (--demo en option)
npm run dev            # API :8787 + web :5180
npm run build && npm start   # prod locale sur :8787
```

## Checklist closeout (copier dans le commit / LAST_SESSION)

- [ ] Task list à jour (completed / reportées).
- [ ] Documentation mise à jour (CLAUDE.md, docs/, README si pertinent).
- [ ] `LAST_SESSION.md` réécrit pour la prochaine session.
- [ ] App démarre toujours (si du code a changé) — sinon noter le blocage.
- [ ] Commit + push + PR + squash merge + ff main.
- [ ] Utilisateur invité au backup.
