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
| 1 | Analyse de propriété | **Livré + refonte fiche (S39)** — **page d'édition unifiée** `/properties/edit` (10 onglets ; `/properties/:id` redirige), **matrice « Attributs Ventes »** → formulaire de caractérisation par type, **bâtiments/unités détaillés** + **édition en ligne** (dimensions+unités, étage, fonction, recouvrement), **géo QC** (ville→région+MRC auto), photos **par pièce**, **marketing éditable**. `finance.js`, anomalies superficie |
| 2 | Évaluation (ACM) + Analyse de marché | **Livré + enrichi (S40)** — ACM refondé (« Tableau des ajustements » ; sujet↔comparables alignés ; postes « ignorés » ; **évaluations enregistrées**). **Module Analyse de marché** `/market-analysis` : caractérisation du secteur 100 % données publiques gratuites (StatCan/MAMH/OSM/Wikimedia) — démographie, revenus, emploi, langues, logement, entreprises/industries ; scores de secteur, 5 graphiques, images par bloc. Suites : coût/revenu, AVM/carte 3D, stats de marché MLS (#53) |
| 3 | Offre de services | **Livré + complet** — générateur PDF, offres sauvegardables, customizer par offre, aller-retour PPTX, Profil du courtier |
| 4 | Matériel marketing | **En cours** — **brochure RPA complète** + **bibliothèque de brochures** ; **round-trip PPTX granulaire par élément étendu aux familles standard (S39)**. Reste : **alimenter la brochure avec les nouvelles données saisies**, Commercial/Industriel dédiés (#53) |
| 5 | Trousse de soutien client | **À faire** — guides vendeur/acheteur PDF (réutilise Platypus) (#53) |
| 6 | Recherche & enrichissement | **Hérité/fonctionnel** (socle) — ré-orientation immobilier P2/P3 |

## Prochaines étapes (ordre suggéré)
0. **Analyse de marché — compléments** : carte animée 3D (Google Aerial View, **clé requise**),
   rapport PDF 3-4 pages, inoccupation SCHL (niveau RMR), scolarité/immigration/ethnies (worker
   WDS à la demande). Reste bloqué : prévisions ISQ, stats de marché MLS (#53).
1. **Alimenter la brochure (et l'analyse/évaluation) avec les nouvelles données de la fiche** :
   attributs de vente par type, bâtiments/unités détaillés, photos par pièce, marketing édité —
   fermer la chaîne **matrice → formulaire → brochure** (#53).
2. **Brochure Commercial — Phase 2** : la saisie est couverte (matrice + formulaire) ; bâtir la
   **brochure commerciale** élaborée (champ vide → étiquette + valeur masquées) (#53).
3. **Brochure Industriel — Phase 3** : brochure industrielle dédiée (quais, portes L×H, ponts
   roulants + tonnage, usages I1–I4…) (#53).
4. **Module 5** — guides vendeur/acheteur. **Module 2 suites** — stats APCIQ, coût/revenu, AVM.
5. Raffinements RPA : polices embarquées PPTX, contenu EN, fins séparateurs (#53).
6. Nettoyage : onglet Reports éditable, ville hors-QC, retirer le code mort `PropertyDetail` (#53).

## Architecture & exploitation
- Architecture : `documentation/ARCHITECTURE.md`. Docs par page :
  `documentation/Pages Technical Documentation/`.
- Lancement : dossier `..\Scripts\` (`Demarrer-Softimmo.bat`, `Arreter-Softimmo.bat`, …).
- Remote : https://github.com/pierrevinet281/softimmo. Closeout à chaque fin de session
  (`docs/05-dev-process.md`).
