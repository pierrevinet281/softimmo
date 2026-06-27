# PLAN GLOBAL — Softimmo

> Feuille de route vivante (état des 6 modules + prochaines étapes). Détails de conception :
> `docs/01`→`12`. Tâches reportées : **GitHub issue #53**. Détail de la dernière session :
> `LAST_SESSION.md`.

## Vision
SaaS d'assistance au courtage immobilier (Québec, mono-utilisateur), 6 modules. Déterministe
d'abord (IA pour *bâtir*, pas au runtime). Conformité OACIQ/LCI, Loi 25, Loi 96 (FR prééminent).

## État par module
| # | Module | État |
|---|--------|------|
| 1 | Analyse de propriété | **Livré** — détail 7 onglets, CRUD, `finance.js`, anomalies superficie |
| 2 | Évaluation (ACM) | **Cœur livré** — `acm.js`, page `/evaluation`. Suites : stats APCIQ, coût/revenu, AVM (#53) |
| 3 | Offre de services | **Livré + complet** — générateur PDF, offres sauvegardables, customizer par offre, aller-retour PPTX, Profil du courtier |
| 4 | Matériel marketing | **En cours** — 5 brochures PDF/PPTX + round-trip ; brochure **RPA éditoriale** (moteur livré, form 1b à faire) ; annonces texte (Kijiji/FB/IG/X/LinkedIn). **Commercial/Industriel** à bâtir (#53) |
| 5 | Trousse de soutien client | **À faire** — guides vendeur/acheteur PDF (réutilise Platypus) (#53) |
| 6 | Recherche & enrichissement | **Hérité/fonctionnel** (socle) — ré-orientation immobilier P2/P3 |

## Prochaines étapes (ordre suggéré)
1. **Brochure RPA — Phase 1b** : formulaire d'édition + affectation des photos (#53).
2. **Brochure Commercial — Phase 2** : taxonomie de champs → BD + formulaire + détail +
   brochure (champ vide masqué) (#53).
3. **Brochure Industriel — Phase 3** : taxonomie spécialisée (usages autorisés/grille,
   hauteur libre, quais, portes + dimensions, ponts roulants + tonnage…) (#53).
4. **Module 5** — guides vendeur/acheteur.
5. **Module 2 suites** — stats APCIQ, méthodes coût/revenu, AVM.

## Architecture & exploitation
- Architecture : `documentation/ARCHITECTURE.md`. Docs par page :
  `documentation/Pages Technical Documentation/`.
- Lancement : dossier `..\Scripts\` (`Demarrer-Softimmo.bat`, `Arreter-Softimmo.bat`, …).
- Remote : https://github.com/pierrevinet281/softimmo. Closeout à chaque fin de session
  (`docs/05-dev-process.md`).
