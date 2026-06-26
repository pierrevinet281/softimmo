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
> Specs : `docs/10-evaluation-module.md` (Evalo, carte 3D, AVM) + **`docs/12-acm-comparables.md`**
> (ACM : import PDF Matrix « 4 par page », ajustements, prix d'inscription, stats APCIQ).
- [ ] **ACM** : import/extraction PDF Matrix (pdfplumber) → comparables éditables ;
      ajustements (superficie×coût constr., inclusions, âge, date de vente) ; prix de vente
      attendu + prix d'inscription (règle de 3 sur ratio stats) ; corroboration éval.
      foncière ; plafond expirés ; concurrence en vigueur. Ajouts schéma (voir `docs/12` §7).
- [ ] Moteurs comparaison / coût / revenu + réconciliation ; ratios & vérifications.
- [ ] Profils par type (unifamilial → RPA) ; points de vue vendeur/acheteur.
- [ ] Branchement données secteur (StatCan, SCHL, MTQ, Données Québec) + Local Logic opt.
- [ ] AVM + score de confiance ; assistant « Refine Value ».
- [ ] Sorties : opinion de valeur + pro forma investisseur + annexe sources + sommaire.

## Phase 4 — Module 4 : Matériel marketing
> Conception détaillée : `docs/09-marketing-pipeline.md`. **Déterministe, sans IA au runtime.**
- [ ] Couche de mise en page **data-driven** partagée (gabarits + blocs).
- [ ] `render_pdf.py` (ReportLab) + `render_pptx.py`/`pptx_helpers.py` (python-pptx) —
      **mêmes coordonnées + données** → PDF et **PPTX jumeau éditable**.
- [ ] **Ancrage par identifiant de champ** sur objets PPTX + `ingest_pptx.py` (aller-retour
      PPTX modifié → DB + régénération PDF) + rapport de mise à jour.
- [ ] Wizard + formulaires + **upload d'images**, via file de jobs ; boutons Générer /
      Mise à jour.
- [ ] Gabarits (RPA, unifamiliale, plex, commercial, terrain) + presets autres formats
      (FB feed/Marketplace, IG, X, LinkedIn, Kijiji, carrousel) sur le même moteur.
- [ ] Conformité Loi 96 (FR prééminent) + mentions OACIQ + caviardage injectés au rendu.
- [ ] Copy par gabarits ; assistance IA **optionnelle** seulement.

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
