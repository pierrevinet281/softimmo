# Brochure RPA — format éditorial (Module 4)

Format **très différent** des autres brochures (spec-sheet à position fixe) : document
**éditorial 6 pages** pour la location de logements en résidence pour aînés, porté du gabarit
apprécié `rpa_mlt` (client Tours Gouin, lecture seule). Data-driven et déterministe.

## Fichiers
- Moteur **PDF** : `server/python/render_rpa_brochure.py` (ReportLab canvas, palette pétrole/or/
  crème, polices **Oswald** + **Font Awesome** dans `server/python/assets/fonts/`).
- Jumeau **PPTX** (miroir fidèle) : `server/python/render_rpa_brochure_pptx.py` + primitives
  `server/python/rpa_pptx_helpers.py` (mêmes coordonnées que le PDF : y-bas → EMU PowerPoint ;
  icônes FA rendues en **PNG net**). Méthode portée de l'app ancêtre `rpa_mlt` (Tours Gouin).
- **Ingest** (round-trip) : `server/python/ingest_rpa_brochure_pptx.py`.
- Contenu défaut : `server/src/engine/rpa-brochure-content.json` (générique, **FR** ; EN à venir).
- Builder : `server/src/engine/rpaBrochure.js` (`buildRpaData(layout)`, `rpaContent`, `rpaDefaults`,
  `imagesFromMedia`, `RPA_IMAGE_SLOTS`, `RPA_ROLES`).

## Aller-retour PPTX ↔ code ↔ PDF (Session 38)
Le courtier télécharge le PPTX éditable, **déplace/redimensionne/édite** n'importe quels éléments
dans PowerPoint, ré-téléverse → **Synchroniser** crée un **brouillon**, qu'il **prévisualise** puis
**approuve**. L'ingest capture **texte + position** de chaque forme **nommée** (≈180) ; **les deux
moteurs** appliquent l'override `data.layout` → PDF **et** PPTX identiques.
- Modèle **granulaire** : chaque élément (image, carte, icône, libellé, logo, pastille, titre,
  filet…) suit **sa propre boîte**. Bouger un seul élément le déplace seul ; bouger une carte
  groupée déplace tout.
- Nommage : `RPA::<slot>` = texte éditable (overlay contenu) + position ; `RPAp::<slot>` = position
  seule (logos, formes, textes rendus en MAJUSCULES dont on ne réécrit pas la casse).
- Helpers PDF : `ov` (boîte), `ovc` (centre icône), `tov_text`/`tov_para` (boîte→ligne-de-base via
  facteurs `ASC`), `ovline` (filet), `draw_logo(slot)`/`kicker(slot)`/`fa(slot)`. PPTX : `set_pos`/
  `POS` (placement à la boîte exacte = round-trip stable).
- **Garde-fou** : `data.draft` (sync) → Approve/Reject/Reset. PPTX temporaire (supprimé après approbation).

## Pages (sections, data-driven, masquables si vides)
1. Couverture (héros plein cadre, logo agence, pastille « certifiée », titre, sous-titre, chips).
2. Confort / appartements (intro + image large + 6 cartes d'avantages + bandeau note).
3. Sécurité + services (panneau foncé d'items + image + 3 cartes services).
4. Loisirs (mosaïque photo avec légendes + 3 piliers).
5. Vie sociale / quartier / avantage fiscal.
6. Contact (héros + carte coordonnées + QR + héros courtier « SuperPierre » + logo société).

**Règle « champ vide »** : un texte/élément absent n'est pas affiché ; image absente →
réserve grise élégante.

## Emplacements d'images (rôles `property_media`)
`rpa_cover, rpa_comfort, rpa_security, rpa_gallery1..6, rpa_event1..3, rpa_contact`
(repli : rôle `hero` → couverture + contact). Voir `RPA_IMAGE_SLOTS`.

## Édition du contenu (Phase 1b — livré)
- **Par propriété** : `PropertyDetail.jsx` → Brochure → carte RPA → **Éditer le contenu**
  (`RpaContentEditor`, éditeur récursif data-driven) + affectation des photos aux 13 emplacements.
  Routes `GET/PUT /properties/:id/brochure/rpa/content`.
- **Par gabarit / variante** : via la **bibliothèque** (`/assets-courtier/templates`, voir
  *Assets courtier.md*). Rendu d'une variante = `render_rpa_brochure(_pptx)` + son snapshot.

## Routage
`business.js` : `template='rpa'` → `render_rpa_brochure` pour `GET /properties/:id/brochure.pdf/.pptx`,
l'aperçu gabarit, et `GET /brochure/variants/:id/sample.pdf|.pptx`. Indépendance : le rendu d'une
propriété utilise **son** `data.content/layout` (snapshot) ; à défaut, repli sur le défaut du gabarit.

## Reste (issue #53)
- Fins séparateurs gris décoratifs + scrims pleine largeur (position non suivie ; négligeable).
- **Embarquer les polices** Oswald dans le PPTX (portabilité). Contenu **bilingue EN**.
