# Pages — Assets courtier (`/assets-courtier`, bloc MISE EN MARCHÉ)

Élément parent **Assets courtier** avec 3 sous-éléments :
- **Liste et recherche** → `/assets-courtier` — `web/src/pages/BrokerAssetsList.jsx`
- **Ajouter / éditer** → `/assets-courtier/edit` et `/edit/:id` — `web/src/pages/BrokerAssetEdit.jsx`
- **Gabarits** → `/assets-courtier/templates` — `web/src/pages/BrokerTemplates.jsx`

## Modèle
Table **`broker_assets`** (repo `brokerAssets.js`, factory `makeRepo`). Champs : `name`,
`asset_type`, `category`, `lang`, `text`, `file_path`/`filename`/`mime`, `tags` (JSON), `notes`,
`position`. Types : **logo, portrait (visage), buste (tête et tronc)**, carte, bio, signature,
accroche, certificat, hero, autre.

## API
- CRUD via `makeCrudRouter` à `/broker-assets` (`GET ?q=&asset_type=`, POST, GET/PATCH/DELETE /:id).
- Fichier : `POST /broker-assets/:id/file` (image/PDF), `DELETE …/file`, `GET …/raw`.

## Liste et recherche
Recherche `q` + filtre type ; vignette (image) ou icône ; clic → édition ; suppression.

## Ajouter / éditer
Formulaire (nom, type, catégorie, langue, texte, tags, notes) + téléversement fichier
(aperçu image / lien PDF). Bouton **« Ajouter un nouveau »** (après save) → repart vierge.
> Le fichier ne s'attache qu'après création (id requis pour l'upload).

## Gabarits → Bibliothèque de brochures (onglet « Brochures », Session 38)
Modèle **« cloner pour éditer »** : chaque carte = un document **`brochure_variant`**
(`template` = famille → moteur de rendu). Les **5 familles** (unifamiliale, Luxury, RPA·Location,
Commercial, Industriel) sont seedées comme **originaux verrouillés**.
- **Carte** : nom, description, type(s) de propriété ; boutons **Aperçu PDF · Éditer · Cloner ·
  Supprimer** (Supprimer caché sur un original ; cadenas si verrouillée). `Éditer` masqué si
  verrouillée sauf admin (mono-utilisateur = admin).
- **Clone** (`POST /brochure/library/clone`) → copie **`_copy` déverrouillée** + ouvre le dialogue.
- **Dialogue Edit/Clone** (`VariantDialog`) : Retour · Nom · Type · Nom de propriété · Langue ·
  **toggle Verrou** · Voir PDF · Télécharger PPTX · **Téléverser PPTX** (→ brouillon) · **Réviser
  le brouillon** (`/sample.pdf?draft=1`) · **Approuver** (remplace code+PDF de la copie) · **Rejeter**.
- **Garde-fou** : verrouillé → `Téléverser`/`Approuver` bloqués (déverrouiller ou cloner d'abord).
- API : `GET /brochure/library`, `POST /clone`, `GET/PUT/DELETE /brochure/variants/:id`,
  `POST …/sync` (→draft), `POST …/approve`, `DELETE …/draft`, `GET …/sample.pdf|.pptx`.
- RPA = contenu **+ positions** (aller-retour granulaire, voir *Brochure RPA.md*) ; familles
  standard = positions (`ingest_pptx`).
- **Posts** / **Présentations** : à venir (EmptyState).

## Lien avec l'offre
Les images de la bibliothèque (logo, buste…) servent de **repli** au logo/portrait de l'offre
(`business.js firstAssetFile`) et peuvent être **insérées** dans une offre via le customizer.
