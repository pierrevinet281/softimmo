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

## Gabarits (3 onglets)
- **Brochures** : les 5 modèles (unifamiliale, Luxury, RPA·Location, Commercial, Industriel).
  Chaque carte : **Aperçu PDF** (`/brochure/templates/:t/sample.pdf`) + **PPTX éditable**
  (`…/sample.pptx`). RPA = format éditorial (PPTX masqué pour RPA, `pptx:false`).
- **Posts** / **Présentations** : à venir (EmptyState).

## Lien avec l'offre
Les images de la bibliothèque (logo, buste…) servent de **repli** au logo/portrait de l'offre
(`business.js firstAssetFile`) et peuvent être **insérées** dans une offre via le customizer.
