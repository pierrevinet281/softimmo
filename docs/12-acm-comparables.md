# 12 — ACM : comparables, ajustements et prix (cœur du module Évaluation)

> Méthodologie **Analyse Comparative de Marché** (ACM) — la plus utilisée par les
> courtiers québécois — et son implémentation dans Softimmo. **100 % déterministe, sans IA
> au runtime** (`CLAUDE.md` §3) : extraction + calculs en Python/JS. L'IA reste optionnelle
> (repli de parsing seulement). Rappel : sortie = **« opinion de la valeur marchande »**,
> pas une évaluation (`docs/06`). Complète `docs/10` (module Évaluation).

## Flux global

1. Le courtier sélectionne, sur **Matrix** (Centris), les comparables similaires (vendus,
   expirés, annulés, en vigueur) selon ses critères, et **imprime en PDF**.
2. Il **téléverse** ce(s) PDF dans Softimmo (on démarre avec le format d'impression
   **« 4 par page courtier »** — voir `Sample ACM/4_par_page_courtier_Imp_rial_8299.pdf`).
3. Softimmo **extrait** les comparables, applique les **ajustements** (sur les vendus),
   calcule le **prix de vente attendu** et propose un **prix d'inscription**.
4. Données de soutien : **statistiques de marché** (APCIQ), **évaluation foncière**,
   moyennes des **expirés** (plafond) et des **en vigueur** (concurrence), plus les données
   type Evalo (`docs/10`).

## 1. Téléversement & extraction (déterministe)

- **Format de départ** : Matrix « 4 par page courtier » (4 comparables/page). Champs
  extractibles par comparable (confirmés sur l'exemple) :
  - Adresse, **No Centris**, courtier/agence inscripteur.
  - **Statut** : Vendu (VE) + date + **JSM** (jours), Expiré (EX), En vigueur, PA accepté,
    Hors marché (HM), Annulé.
  - **Prix** : original, **dernier prix inscrit**, **prix vendu** (VE).
  - **Dates** : inscription, expiration, vente.
  - **Sup. habitable** (pc), **Sup. terrain** (pc), Dim. bât./ter.
  - **Année de construction** (Cons.), pièces, CAC (chambres), GP/TB.
  - **Taxes** mun./scol., **Éval. tot.** (évaluation foncière municipale + année).
  - **Inclusions / commodités** (texte) → détection piscine, spa, foyer, garage, etc.
- **Technique** : parsing **positionnel** (pdfplumber) plus fiable que le texte brut (la
  mise en page en colonnes entrelace les libellés). Dépendances Python à ajouter :
  `pdfplumber` (+ `pypdf`). Repli : parsing par regex ; IA optionnelle pour les cas sales.
- **Validation humaine** : la table extraite est **éditable** avant calcul (le courtier
  corrige/complète). Provenance = « importé Matrix PDF, <date> ».
- Extensible : autres dispositions d'impression Matrix, CSV, saisie manuelle.

## 2. Ajustements des comparables VENDUS (paramètres = défauts éditables)

Pour chaque comparable vendu, on ajuste son prix vendu pour le rendre comparable au sujet :

| Ajustement | Méthode | Paramètre (défaut éditable) |
|---|---|---|
| **Superficie du bâtiment** | (sup. sujet − sup. comp.) × coût | **coût de construction moyen $/pi²** (par type/qualité) |
| **Inclusions** (piscine, spa, foyer, garage, etc.) | ± valeur marché par élément présent/absent | **table de prix moyens par inclusion** |
| **Âge du bâtiment** | (âge comp. − âge sujet) × ajustement | **ajustement $/an** ou % (dépréciation/âge effectif) |
| **Date de vente** | appréciation du marché entre date de vente et aujourd'hui | **% d'appréciation mensuel** (issu des stats ou saisi) |
| *(extensible)* superficie terrain, localisation, état, garage, stationnement | $/pi² terrain, ± forfaits | configurables |

- Sortie par comparable : prix vendu → **prix ajusté** (avec détail des ajustements,
  stocké dans `comparables.adjustments` JSON pour transparence/justification).
- **Prix de vente attendu** = moyenne **pondérée** des prix ajustés (pondération par
  similarité ; curation possible : réordonner/noter/pondérer, style RPR — `docs/10`).

### 2.1 Ventilation explicable (pour le courtier ET le client) — EXIGENCE

Le logiciel ne fait pas que calculer : il **produit une grille d'ajustements ventilée,
expliquée et chiffrée**, lisible par le courtier et présentable au client. Chaque ligne
d'ajustement enregistre et affiche :

| Champ | Exemple |
|---|---|
| Caractéristique | « Superficie habitable » |
| Valeur du **sujet** | 2 400 pi² |
| Valeur du **comparable** | 2 640 pi² |
| **Écart** | −240 pi² |
| **Paramètre/taux** appliqué (éditable) | 180 $/pi² (coût de construction moyen) |
| **Montant** de l'ajustement | **−43 200 $** |
| Sens | appliqué au comparable (le comp. est plus grand → on le baisse) |
| **Explication** (texte clair) | « Le comparable est 240 pi² plus grand ; à 180 $/pi², on retranche 43 200 $ pour le ramener au sujet. » |

- **Calcul montré** : chaque montant affiche sa formule (`écart × taux`), jamais une boîte
  noire.
- **Total par comparable** : `prix vendu → ± ajustements → prix ajusté`, avec sous-total et
  somme des ajustements (et % du prix).
- **Grille de marché** (style ACM classique) : tableau **comparables en colonnes**,
  caractéristiques en lignes, avec la ligne « prix vendu », chaque ajustement, et le
  « prix ajusté » en bas — la vue standard attendue par les courtiers.
- **Deux niveaux de présentation** :
  - **Courtier** : grille complète + paramètres + pondérations + notes de justification.
  - **Client** : version simplifiée, texte clair, sans jargon, montants arrondis, axée
    « pourquoi ce prix » (conforme au devoir d'information de la LCI).
- **Texte généré par gabarits** (déterministe, sans IA) ; l'IA peut, en option, polir la
  formulation narrative — jamais requise.
- Stocké dans `comparables.adjustments` (JSON) — **forme** :
  `[{ "key":"living_area", "label":"Superficie habitable", "subject":2400, "comp":2640,
  "delta":-240, "unit":"pi2", "rate":180, "amount":-43200, "explanation":"…" }, …]`
  plus un récapitulatif `{ sold_price, adjustments_total, adjusted_price, weight }`.
- La même logique de ventilation s'applique aux **autres données de soutien** (éval.
  foncière, plafond expirés, concurrence, ajustements Evalo) : chaque chiffre du rapport
  est **traçable et expliqué**.

## 3. Statistiques de marché (APCIQ — téléversement)

Fichier exemple : `Statistiques/pdf_fr_statistics_STATS_MUNGENRE_202605O.pdf` (rapport
APCIQ « STATS_MUNGENRE » : par **région → zone/MRC → municipalité → quartier** et par
**genre** de propriété). Métriques définies dans le rapport :
- Nouvelles inscriptions, **inscriptions en vigueur**, **nombre de ventes**, volume.
- **JSM** (jours sur le marché).
- **Prix de vente moyen** et **médian**.
- **Prix de vente vs prix inscrit** (ratio %) ← clé pour le prix d'inscription.
- **Prix de vente vs évaluation municipale** (ratio %) ← donnée de soutien.

Implémentation : le courtier choisit région/municipalité/genre ; Softimmo **localise la
page** correspondante (recherche par nom, comme le suggère le rapport) et extrait les
métriques. **Repli** : saisie manuelle des quelques ratios. Déterministe.

### a) Prix d'inscription proposé (règle de trois)
`prix_inscription ≈ prix_de_vente_attendu ÷ (ratio « prix de vente / prix inscrit »)`.
Ex. attendu 500 000 $ et ratio 97,5 % → inscription ≈ 512 800 $.

### b) Soutien par évaluation foncière (NE détermine PAS le prix)
Le courtier saisit l'**évaluation foncière** du sujet. Avec le ratio « prix de vente /
évaluation municipale » : `valeur_estimée ≈ éval_foncière × ratio`. **Usage strict** :
**donnée corroborante uniquement** ; si écart **important** avec le prix ACM → **signaler
au courtier d'investiguer**. Jamais utilisée pour fixer le prix d'inscription/vente.

## 4. Comparables expirés & en vigueur

- **Expirés** (moyenne, ajustée si possible) → **plafond « trop haut »** : prix que le
  marché a refusé. À ne pas atteindre.
- **En vigueur** (moyenne) → **prix de la concurrence** active (positionnement).

## 5. Synthèse de l'opinion de valeur

- **Primaire** : prix de vente attendu (ACM, comparables vendus ajustés) → **fourchette**
  + prix d'inscription proposé.
- **Bornes** : plafond (expirés), concurrence (en vigueur).
- **Corroboration** : ratio éval. foncière (soutien, avec alerte d'écart) ; AVM statistique
  (`docs/10`).
- **Ajustements additionnels / contexte** : toutes les données Evalo et prévues —
  enjeux environnementaux, marché/démo, approche revenus (immeubles à revenus), qualité —
  servent d'**ajustements appropriés** et d'éléments du rapport.

## 6. Garde-fous (APCIQ / OACIQ)

- Stats APCIQ « **à titre indicatif seulement** » ; transactions hors **50 %–150 %** du
  dernier prix exclues ; **prudence si peu de transactions** — afficher l'avertissement et
  le nombre de transactions.
- Tous les paramètres (coûts construction, prix inclusions, âge, appréciation) = **défauts
  éditables**, jamais des vérités.
- **« opinion ≠ évaluation »** ; **caviardage vendeur** des comparables à l'export client
  (`comparables.seller_redacted`).

## 7. Ajouts de schéma (Phase 3 — `data model`)

- `comparables` : ajouter `list_price` (dernier prix inscrit), `sold_price` (distinct de
  `price`), `livable_area`, `municipal_assessment`, `days_on_market`, `centris_no`,
  `inclusions` (JSON), `sale_date`. (`adjustments` JSON existe déjà.)
- `properties` : ajouter `municipal_assessment` (+ année).
- `settings` (ou table `acm_params`) : coût construction $/pi², table prix inclusions,
  ajustement d'âge, % appréciation mensuel — par défaut éditables.
- Stocker les **stats** importées (table `market_stats` : géo, genre, période, ratios,
  prix moyen/médian, JSM, n) pour réutilisation et traçabilité.

## 8. UI / Wizard (déterministe)

1. **Téléverser** le(s) PDF Matrix → table de comparables extraits **éditable**.
2. **Paramètres d'ajustement** (défauts éditables) + saisie sujet (sup., année,
   inclusions, éval. foncière).
3. **Téléverser/saisir** les stats de marché (ratios).
4. **Résultats** : prix de vente attendu (fourchette) + prix d'inscription proposé +
   panneau de corroboration (éval. foncière, plafond expirés, concurrence en vigueur) +
   **grille d'ajustements ventilée et expliquée** (§2.1 : vue courtier complète + vue
   client simplifiée, chaque montant avec sa formule et son explication).
5. **Rapport** via `render/` (`docs/10`) avec mentions/caviardage.

## Dépendances Python à ajouter (Phase 3)
`pdfplumber`, `pypdf` (licences permissives) → `server/python/requirements.txt`.

## Références
`Sample ACM/4_par_page_courtier_Imp_rial_8299.pdf` (format Matrix) ·
`Statistiques/pdf_fr_statistics_STATS_MUNGENRE_202605O.pdf` (APCIQ) · `docs/10` · `docs/08`.
