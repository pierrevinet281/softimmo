# Page — Attributs Ventes (matrice attribut × type)

`web/src/pages/SalesAttributes.jsx` · route `/properties/attributs` · menu **Propriétés →
Attributs Ventes**. Page d'administration : matrice **attribut (rangées, groupées par catégorie) ×
type de propriété (colonnes)**. Chaque cellule = bascule **Oui/Non** « cet attribut est-il à
caractériser pour ce type ». Pilote ensuite le **formulaire dynamique** de la fiche propriété
(*Property Overview*), puis (à venir) la brochure.

## Données
- **Taxonomie** : `server/src/db/seeds/sales-attributes.seed.json` — `types` (6 : condo,
  unifamilial, multi, commercial, industriel, rpa), `categories` (ordonnées), `attributes`
  (ordonnés par importance ; `key`, `category`, `label_fr/en`, `input` text|number|currency|
  percent|bool, `unit?`, `types` = applicabilité par défaut). Bilingue (Loi 96).
- **Surcharges admin** : `Settings['sales_attributes_matrix']` = `{ attr: { type: bool } }`
  (sparses). Matrice EFFECTIVE = défaut du seed sauf surcharge.
- **Lib** : `server/src/lib/salesAttributes.js` — `buildMatrix(Settings)`, `setCell`, `resetMatrix`,
  `formSchema(type)` (catégories non vides + attributs activés, pour générer le formulaire).

## Endpoints (`/api`)
- `GET /sales-attributes` → { types, categories, attributes[{…, enabled:{type:bool}}] }
- `PUT /sales-attributes/cell` { attr, type, value } → bascule (persiste la surcharge)
- `POST /sales-attributes/reset` → efface les surcharges
- `GET /sales-attributes/form/:type` → schéma de formulaire (catégories → attributs activés)

## UI
- **Sélecteur « Type de propriété »** en haut : « Tous les types » ou un type → n'affiche que sa
  colonne. Changer de type **réinitialise** les filtres de colonne.
- **Entonnoir par colonne** : Tous / Sélectionnés / Non sélectionnés (filtre les rangées, combiné
  en ET ; catégories vidées masquées).
- **Bascules** optimistes ; **Réinitialiser les défauts** ; **Aperçu du formulaire** par type
  (clic sur l'en-tête de colonne → modale `GET …/form/:type`).
- Styles : `.sa-matrix`, `.sa-funnel`, `.sa-menu` (tokens dark mode `--color-bg-card/-secondary/
  -text-primary`).

## Chaîne
Matrice → **formulaire de caractérisation par type** (Property Overview) → `properties.attributes`
→ **brochure** (consommation à implémenter, issue #53).
