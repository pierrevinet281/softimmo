# 09 — Pipeline du matériel marketing (PDF + PPTX éditable, aller-retour)

> Spécification du Module 4. **Principe non négociable : déterministe, sans IA au
> runtime.** L'IA sert à *bâtir* le logiciel ; le produit livré génère le matériel par
> scripts Python + gabarits + données saisies, **sans consommer de jetons IA** (sauf si
> absolument essentiel, et alors optionnel avec repli). Voir `CLAUDE.md` §3.

## Référence éprouvée (lecture seule)

Claude a déjà construit ce pipeline pour les Tours Gouin :
`D:\Google Drive\Personal Business\Immo PIERRE VINET\Clients Immo\Les Tours Gouin\Inscriptions\Inscription 16 juin 2026\Publicités\`

- `_build/brochure.py` — rendu **PDF** via **ReportLab** (`canvas`, page `letter`
  612×792 pt, polices TTF embarquées) + **PIL/Pillow** (traitement d'images, scrims,
  coins arrondis, flous).
- `_build/brochure_pptx.py` — **jumeau PowerPoint éditable** via **python-pptx**
  (objets natifs : zones de texte, formes, images, dégradés). 6 pages : couverture,
  appartements, sécurité/services, loisirs, vie sociale/quartier, contact.
- `_build/pptx_helpers.py` — primitives qui **réutilisent les MÊMES coordonnées que le
  PDF** (origine en bas-gauche, comme ReportLab) puis basculent vers l'espace EMU
  top-left de PowerPoint. Mesure de texte via métriques PIL pour la fidélité.
- `_build/embed_fonts.py` — embarquement de polices ; icônes **Font Awesome** (PUA)
  rendues en images pour fidélité.
- Sous-dossiers d'actifs : `_site_png/`, `_extracted_imgs/`, `_fonts/`, `_pptx_assets/`.
- Sorties : `rpa_mlt.pdf` + `rpa_mlt.pptx` (gabarit RPA).

**Insight d'architecture clé** : un **seul jeu de code de mise en page / coordonnées →
deux moteurs de rendu** (ReportLab PDF + python-pptx éditable). C'est ce qui garantit
que le PPTX est un *jumeau fidèle* du PDF.

## Exigence : générique + aller-retour (round-trip)

1. **Génération** : toute brochure (et autres formats marketing) produite en **PDF**
   ET en **PPTX fidèle et éditable**, à partir de **données** (formulaire/wizard) + un
   **gabarit** (RPA, unifamiliale, plex, commercial, terrain…).
2. **Édition manuelle** : l'utilisateur ouvre le PPTX dans PowerPoint et modifie texte,
   images, positions.
3. **Bouton « Mise à jour »** : un **script Python lit le PPTX modifié**, en **extrait
   les changements**, **met à jour les données en arrière-plan** (DB) et **régénère le
   PDF** — pour que les modifications manuelles se propagent partout.

## Conception cible Softimmo

### a) Couche de mise en page partagée (`server/python/marketing/`)
- `layout/` : modèle de gabarit **data-driven**. Un gabarit décrit des *blocs* (kicker,
  titre, paragraphe, carte-fonctionnalité, image légendée, bandeau dégradé, bloc
  contact…) positionnés par coordonnées, alimentés par un **dictionnaire de données**
  (champs saisis + chemins d'images). Sépare strictement **gabarit** (mise en page) et
  **contenu** (données).
- `render_pdf.py` : rend le gabarit+données en PDF (ReportLab + PIL). Repris/généralisé
  de `brochure.py`.
- `render_pptx.py` + `pptx_helpers.py` : rend le **même** gabarit+données en PPTX éditable
  (python-pptx). Repris/généralisé de `brochure_pptx.py`/`pptx_helpers.py`.
- Chaque objet PPTX porteur de contenu reçoit un **identifiant de champ** (via le *nom*
  de la forme et/ou l'alt-text/`descr`), ex. `field:page2.title`, `field:contact.phone`,
  `img:cover.hero`. C'est l'**ancrage** qui rend l'aller-retour fiable.

### b) Aller-retour PPTX → données + PDF (`ingest_pptx.py`)
- Lit le PPTX (python-pptx), parcourt les formes, récupère le **texte** et les **images**
  des objets **tagués** par leur identifiant de champ.
- Diffe avec les données stockées ; **met à jour la DB** (`documents` + données source) ;
  enregistre la **provenance** (« édité manuellement dans PPTX, <date> »).
- **Régénère le PDF** à partir des données mises à jour (cohérence PDF ↔ PPTX ↔ DB).
- Champs non tagués / objets ajoutés librement : conservés best-effort + signalés
  (rapport de mise à jour) ; ne jamais écraser silencieusement une édition manuelle.

### c) UI (React) — déterministe, sans IA
- **Wizard** de création par type de bien : étapes (propriété → contenu par section →
  actifs visuels → courtier/agence/mentions → choix du gabarit → aperçu).
- **Formulaires** capturant toutes les informations et **liens de répertoires** (chemins
  d'images, dossiers d'actifs, profils sociaux, QR), avec **téléversement d'images** et
  réutilisation des données de la propriété (Module 1) — aucune ressaisie.
- Boutons **« Générer PDF + PPTX »**, **« Télécharger »**, et **« Mise à jour depuis
  PPTX »** (déclenche `ingest_pptx.py` via la file de jobs).
- Tout passe par la **file de jobs** existante (workers Python via `services/python.js`).

### d) Conformité (`docs/06`)
- Mentions OACIQ (agence + courtier + désignations), **Loi 96** (FR prééminent) et
  caviardage injectés par la couche de rendu, jamais laissés à l'utilisateur seul.

## Autres formats marketing (même moteur)
Pub moyenne (Kijiji), Facebook (fil + Marketplace), Instagram (post + carrousel), X,
LinkedIn, **diapos de carrousel vidéo** : presets de dimensions/limites dans
`docs/07-marketing-specs.md`, rendus par la même couche déterministe (images PNG/JPG aux
bons formats + texte/hooks/CTA depuis gabarits ; PPTX éditable pour les formats qui s'y
prêtent, ex. diapos de carrousel).

## Dépendances Python à ajouter
`reportlab`, `python-pptx`, `Pillow` (PIL) — toutes licences permissives. À ajouter à
`server/python/requirements.txt` lors de la construction du Module 4.

## Tâches (à intégrer au plan, `docs/04`, Phase 4)
- [ ] Généraliser la couche de mise en page data-driven (gabarits + blocs).
- [ ] `render_pdf.py` (ReportLab) et `render_pptx.py`/`pptx_helpers.py` (python-pptx)
      partageant coordonnées + données.
- [ ] Système d'**ancrage par identifiant de champ** sur les objets PPTX.
- [ ] `ingest_pptx.py` (PPTX modifié → DB + régénération PDF) + rapport de mise à jour.
- [ ] Wizard + formulaires + upload d'images (React), file de jobs, boutons Générer /
      Mise à jour.
- [ ] Gabarits : RPA (`rpa_mlt`), unifamiliale (`Brochure_Inscription_102-8225_George`),
      plex, commercial, terrain.
- [ ] Presets des autres formats (FB/IG/X/LinkedIn/Kijiji/carrousel) sur le même moteur.
- [ ] Injection conformité (mentions, FR prééminent, caviardage).
