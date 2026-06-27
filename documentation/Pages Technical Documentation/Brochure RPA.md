# Brochure RPA — format éditorial (Module 4)

Format **très différent** des autres brochures (spec-sheet à position fixe) : document
**éditorial 6 pages** pour la location de logements en résidence pour aînés, porté du gabarit
apprécié `rpa_mlt` (client Tours Gouin, lecture seule). Data-driven et déterministe.

## Fichiers
- Moteur : `server/python/render_rpa_brochure.py` (ReportLab canvas, palette pétrole/or/crème,
  polices **Oswald** + **Font Awesome** dans `server/python/assets/fonts/`, logo société dans
  `assets/rpa/company_logo.png`).
- Contenu défaut : `server/src/engine/rpa-brochure-content.json` (générique, **FR** ; EN à venir).
- Builder : `server/src/engine/rpaBrochure.js` (`buildRpaData`, `imagesFromMedia`,
  `RPA_IMAGE_SLOTS`).

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

## Routage
`business.js` : `template='rpa'` → `render_rpa_brochure` pour `GET /properties/:id/brochure.pdf`
**et** l'aperçu gabarit `GET /brochure/templates/rpa/sample.pdf`. Surcharge texte par propriété
via `documents` (doc_type='brochure', template='rpa', `data.content`).

## Reste (issue #53)
- **Phase 1b** : formulaire structuré d'édition + UI d'affectation des photos aux emplacements.
- Contenu **bilingue EN**.
