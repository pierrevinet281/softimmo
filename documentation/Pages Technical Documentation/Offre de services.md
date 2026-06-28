# Pages — Offre de services (`/offres`, bloc MISE EN MARCHÉ)

Élément parent **Offre de services** avec 3 sous-éléments :
- **Liste et recherche** → `/offres` — `web/src/pages/OffresList.jsx`
- **Ajouter / éditer** → `/offres/edit` et `/offres/edit/:id` — `web/src/pages/OffreEdit.jsx`
- **Gabarits** → `/offres/templates` — `web/src/pages/OffreTemplates.jsx`
- Composant interne du customizer : `web/src/pages/OffreContentCustomizer.jsx`

## Offres = entités sauvegardées
Stockées dans `documents` (doc_type='offre'). Endpoints :
- `GET /offres?templates=0|1` → liste (filtre gabarits). `POST /offres` (create),
  `GET|PUT|DELETE /offres/:id`.
- `GET /offres/:id/pdf` → PDF (applique le contenu PPTX synchronisé sinon la personnalisation).
- `GET /offres/:id/pptx` → jumeau PPTX éditable. `POST /offres/:id/pptx/sync` (multipart) →
  ré-ingestion → `data.pptx_content[lang]` + `pptx_synced_at`.

## Ajouter / éditer (générateur)
Bloc **« Offer informations »** : **Nom de l'offre**, Type de client (résidentiel/commercial/
industriel/entreprise/autre), Type d'opportunité (vendeur/acheteur/locateur/locataire →
variante = vendeur si vendeur|locateur, sinon acheteur), langue, client, propriété, date,
case **Convertir en gabarit**. Rangée de boutons **en haut ET en bas** : **Enregistrer**,
**Enregistrer et générer le PDF**, **Enregistrer et personnaliser en PPTX**.

### Bloc « Contenu de l'offre » (personnalisation par offre)
`OffreContentCustomizer` charge le contenu global résolu (`/offre/config` → `resolved[lang]
[variant]`) et un **diff** stocké dans `data.customization[lang]` :
`{ order:[clés], hidden:{clé:true}, items:{clé:{order:[i…], excluded:{i:true}}}, assets:{clé:{kind|asset_id, caption}} }`.
- **Interrupteurs (toggles) verts alignés à droite** : inclure/exclure chaque **section** et
  chaque **élément** (listes plates + témoignages).
- **Glisser-déposer** sections + éléments.
- **Insertion d'images** n'importe où : logo/bannière/portrait/buste/autre photo, ou un asset
  image de la bibliothèque ; légende éditable. Placer par glisser-déposer.
- Sections groupées (Pourquoi/Services/Plan marketing) : bascule au niveau section (édition
  fine des puces dans Profil — voir issue #53).

Le backend (`offre.js applyOfferDiff` + route `offerRenderData`) transforme le diff en contenu
prêt au rendu (ordre, items filtrés/réordonnés, sections asset avec chemins résolus).

## Aller-retour PPTX (+ garde-fou draft, Session 38)
« Enregistrer et personnaliser en PPTX » → sauvegarde + télécharge `/offres/:id/pptx`
(1 diapo/section, formes nommées). Éditer dans PowerPoint, puis **Synchroniser** (téléverser).
Le sync écrit désormais un **brouillon** `data.draft_pptx_content[lang]` (n'écrase pas la version
courante). UI : **Aperçu du brouillon** (`/pdf?draft=1`) → **Approuver** (`POST /offres/:id/pptx/
approve` → `pptx_content`) ou **Rejeter** (`DELETE …/pptx/draft`) ; **Réinitialiser au défaut**
(`DELETE …/pptx`). Réenregistrer via le customizer rend la main à l'app. Le PPTX = une langue (bi → FR).

## Gabarits
`OffreTemplates` liste les offres `is_template` ; **Utiliser ce gabarit** clone une offre.

## Conformité
Pied de chaque page : agence + courtier + désignation + « document de présentation, ne
constitue pas un contrat de courtage ». Titres « spécialiste » neutralisés (`offre.js`).
