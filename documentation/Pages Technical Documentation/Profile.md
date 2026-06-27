# Page — Profil du courtier (`/profile`)

Bloc nav **ACCOUNT**. Composant : `web/src/pages/ProfilCourtier.jsx`. Page unique de profil
(identité + image de marque + contenu d'offre par défaut). Remplace les anciens blocs
*Broker profile* / *Testimonials* de `/offres`.

## Sections
1. **Identité** — `broker_profile` (name, title, subtitle, agency, company, phone, email,
   web, linkedin, linkedin_label).
2. **Image de marque** — téléversement **logo / bannière de fond / portrait** + 2 couleurs
   (**bannière+blocs**, **titres de section**). Aperçus via `/broker/profile/image/:kind/raw`.
3. **Contenu de l'offre de services** — onglets **Vendeur/Acheteur** × **FR/EN** ; éditeur
   imbriqué (titre/sous-titre + sections). Par section : **glisser-déposer** (réordre),
   bouton **masquer/afficher** (œil), **sections personnalisées** (nom + type texte/liste/
   groupes) ajoutables/supprimables ; sections intégrées **non supprimables (masquables)**.
   Éléments réordonnables par glisser-déposer.

## API
- `GET /offre/config` → `{ broker, content, resolved, images }` (`resolved` = défauts +
  surcharge, pour pré-remplir l'éditeur).
- `PUT /offre/config` `{ broker?, content? }` → persiste `broker_profile` / `offre_content`
  (préserve les chemins d'images).
- `POST|DELETE /broker/profile/image/:kind` (kind = logo|banner|photo), `GET …/raw`.

## Données
- `broker_profile` (Settings) : identité + `logo/banner/photo` (chemins) + `theme`.
- `offre_content` (Settings) : contenu complet édité (par langue/variante), incl. `sections`
  (ordre + `hidden` + sections custom). Sert de défaut à toutes les offres.

## Rendu
Le moteur `render_offre.py` lit `theme` (couleurs + image bannière, contraste auto) et l'ordre
`sections` (intégrées / custom / masquées). Voir `documentation/ARCHITECTURE.md` §4.

## Notes / pièges
- `structuredClone` utilisé pour l'immutabilité de l'éditeur.
- Le glisser-déposer est natif HTML5 (pas de dépendance) ; poignée `.drag-handle`.
- DnD/édition imbriquée dans les groupes (sous-listes) : édition au niveau groupe + items.
