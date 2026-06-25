# 04 — Plan d'action (roadmap par sessions)

> On procède **session par session**, en mode continu. Chaque session produit du
> logiciel qui démarre et se termine par un closeout (`docs/05-dev-process.md`). Les
> tâches détaillées vivent dans la task list ; ce document donne l'ordre macro.

## Phase 0 — Framework (SESSION 1 — en cours)
- [x] Inspection des ressources + recherche (besoins courtiers, concurrents, formats,
      conformité).
- [x] Copie intégrale du socle d'enrichissement dans `SoftImmoDev`.
- [x] `CLAUDE.md`, documentation de framework (`docs/00`→`08`), `LAST_SESSION.md`.
- [x] Git init + remote + branche de session.
- [ ] Re-branding socle → Softimmo (package.json, README, .env, DB path, titres UI).
- [ ] Vérifier le démarrage (install, venv, migrate/seed, dev) du socle sous Softimmo.
- [ ] Closeout session 1.

## Phase 1 — Fondations Softimmo (modèle de données + shell)
- [ ] Schéma : tables `properties`, `buildings`, `units`, `expenses`, `comparables`,
      `reports`, `transactions`, `documents`, `clients`, liaisons. Migration idempotente.
- [ ] Repositories + routes CRUD pour ces entités (zod, provenance, activité).
- [ ] Shell de navigation Softimmo : sections par module + i18n FR/EN + bascule.
- [ ] Moteur `render/` (base HTML→PDF) + en-tête/pied conformité (mentions, avertissements).

## Phase 2 — Module 1 : Analyse de propriété
- [ ] Formulaire de caractérisation multi-bâtiments + détection d'anomalies.
- [ ] Tableaux rent roll / dépenses / rentabilité (MRB, MRN, TGA, $/porte) + contrôles.
- [ ] Historique de transactions ; rapports & expertises ; étude de trafic.
- [ ] Import assisté (extract + IA mapping) ; synthèse IA pré-recherche.
- [ ] Sortie « Rapport d'analyse » (PDF + numérique).

## Phase 3 — Module 2 : Évaluation
- [ ] Moteurs comparaison / coût / revenu + réconciliation ; ratios & vérifications.
- [ ] Profils par type (unifamilial → RPA) ; points de vue vendeur/acheteur.
- [ ] Branchement données secteur (StatCan, SCHL, MTQ, Données Québec) + Local Logic opt.
- [ ] AVM + score de confiance ; assistant « Refine Value ».
- [ ] Sorties : opinion de valeur + pro forma investisseur + annexe sources + sommaire.

## Phase 4 — Module 4 : Matériel marketing
- [ ] Moteur de gabarits multi-sorties + presets de formats (`docs/07`).
- [ ] Brochure (unifamiliale, RPA) ; pub moyenne ; FB feed/Marketplace ; IG ;
      X ; LinkedIn ; diapos carrousel.
- [ ] Copy IA (hook/corps/CTA/hashtags) ; conformité Loi 96 + mentions OACIQ.

## Phase 5 — Module 3 : Offre de services
- [ ] Générateur vendeur/acheteur (inspiré offre Ubee) ; gabarits brandés ; PDF.

## Phase 6 — Module 5 : Trousse de soutien client
- [ ] Bibliothèque de guides/checklists personnalisables ; génération PDF.

## Phase 7 — Module 6 : Adaptations immobilier de l'enrichissement
- [ ] Types de leads vendeur/acheteur ; lien lead ↔ propriété ; matching acheteurs ;
      conformité Loi 25 (consentement, opt-out) ; sources spécifiques.

## Phase 8 — Renommage final & polish
- [ ] Finaliser slug `leadgen` → `softimmo` (env, packages, DB) ; nettoyage.
- [ ] Doc utilisateur + doc technique complètes ; captures light/dark ; tests bout-en-bout.

> L'ordre des phases 2-7 peut être réordonné selon les priorités de l'utilisateur ;
> noter tout changement dans `LAST_SESSION.md`.
