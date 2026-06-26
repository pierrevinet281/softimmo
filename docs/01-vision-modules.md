# 01 — Vision & modules

Softimmo regroupe en une seule application web les outils dont un courtier a besoin du
premier contact avec une propriété jusqu'à la commercialisation et le suivi client. Le
fil conducteur : **une propriété + un client → des analyses, des documents et des
contacts, tous traçables et conformes.**

## Entités centrales (modèle de données métier)

- **Property (propriété)** — le sujet d'un mandat. Multi-bâtiments. Sert de pivot aux
  modules 1-5.
- **Building (bâtiment)** — caractérisation détaillée (type, superficies, étages,
  construction, structure, fondation, revêtement, fenestration, toiture, planchers…).
- **Unit (unité/logement)** + **revenu** — rent roll pour plex/commercial/RPA.
- **Expense (dépense)** — taxes municipales/scolaires, assurances, entretien, gestion…
- **Comparable** — vente/inscription comparable (ACM), avec caviardage vendeur.
- **Report (rapport d'expertise)** — inspection, sol, environnement, etc.
- **Transaction** — historique (en vigueur, vendue, expirée).
- **Client / Lead / Contact / Company** — vendeurs, acheteurs, prospects (module 6).
- **Document** — toute sortie générée (analyse, évaluation, offre, marketing, guide).

Ces entités sont **partagées** entre modules : une même propriété alimente l'analyse,
l'évaluation, l'offre de services et le marketing sans ressaisie.

---

## Module 1 — Analyse de propriété

Étude du sujet, tout genre (unifamilial, plex/multi, commercial, industriel, terrain,
RPA…).

- **i. Historique de transactions** : dates, parties, prix ; statuts *en vigueur /
  vendue / expirée*.
- **ii. Caractérisation** : nom, adresse, ville, région, province/État, zonage, nombre
  de bâtiments ; **par bâtiment** : type, superficie terrain, superficie bâtiment,
  étages (sous-sol/hors-sol/total), superficie habitable/occupable, année de
  construction, structure, fondation, revêtement extérieur, fenestration, toiture,
  planchers. **Tableau des unités et revenus**, **tableau des dépenses**, **tableau de
  rentabilité**.
- **iii. Rapports & expertises** : liste (date, type, lien) + tableau des résultats.
- **iv. Étude de trafic** : DJMA/débits (MTQ / Données Québec) pour commercial/terrain.

## Module 2 — Évaluation (opinion de valeur marchande)

Deux points de vue : **vendeur** (positionnement de prix) et **acheteur** (opportunité,
pro forma, risques). Trois méthodes reconnues — **comparaison**, **coût**, **revenu** —
appliquées et réconciliées selon le type de bien. Intègre l'ACM (comparables Centris et
autres), les données de secteur (datasets publics, Local Logic), et la recherche web
(démographie, locatif SCHL, trafic, urbanisme, coûts de construction). Produit :
opinion de valeur + (côté investisseur) étude de demande, pro forma, analyse de risque
+ annexe des sources + sommaire exécutif.

> Garde-fou : **opinion de valeur marchande ≠ évaluation**. Avertissement légal
> automatique. Repères de marché = défauts éditables.

## Module 3 — Proposition d'offre de services

Générateur d'offres aux **vendeurs** et **acheteurs**, inspiré et amélioré de
`Offre Ubee Rive-Nord Rehaussée.pdf` : présentation du courtier, stratégie de mise en
marché, plan marketing, honoraires/commission, échéancier, valeur ajoutée. Sortie
brandée, bilingue, avec mentions obligatoires.

## Bloc « Mise en marché » — ordre chronologique d'usage

Le menu de gauche présente la mise en marché dans l'ordre où le courtier s'en sert :
1. **Assets courtier** — matériel marketing du *courtier lui-même* (carte, bio, signature,
   gabarits personnels). *À produire plus tard.*
2. **Offre de services** — présentée au client (acheteur/vendeur) avant le mandat (Module 3).
3. **Trousse démarrage** — utilisée **au moment de l'inscription** pour préparer/guider le
   client (anciennement « Trousse de soutien client » — Module 5).
4. **Trousse marketing** — utilisée **après l'inscription**, pour la mise en marché des
   propriétés (anciennement « Matériel marketing » — Module 4 ; pipeline `docs/09`).

> Les numéros de module historiques (4 = marketing, 5 = soutien) restent valides dans les
> docs ; seuls les **libellés UI** et l'**ordre** changent comme ci-dessus.

## Module 4 — Trousse marketing (matériel de mise en marché des propriétés)

À partir des données de la propriété, génère :
- **Brochure** (pub longue) — gabarits unifamiliale et RPA.
- **Pub moyenne** (Kijiji / annonces classées).
- **Fil Facebook**, **Facebook Marketplace**, **Instagram**, **X**, **LinkedIn**.
- **Diapos de carrousel vidéo**.

Chaque sortie respecte les **specs de format** (`docs/07-marketing-specs.md`) et la
**Loi 96** (FR prééminent). Voir aussi les mentions obligatoires OACIQ.

## Module 5 — Trousse démarrage (soutien et préparation du client à l'inscription)

Guides et checklists pour préparer/guider les clients (vendeur, acheteur, copropriété,
plex, commercial, entreprise), dérivés des `Documents de présentation`. Personnalisés au
mandat et au courtier.

## Module 6 — Recherche & enrichissement de contacts

Le socle d'enrichissement intégré, ré-orienté immobilier :
- Trouver de **nouveaux prospects** (vendeurs et acheteurs).
- Trouver des **acheteurs** pour les vendeurs existants.
- Générer / enrichir / vérifier / gérer companies & contacts (waterfall : plan →
  search → crawl → resolve → email-pattern → verify → score), avec provenance.

---

## Principes transverses

- **Traçabilité** partout (provenance des données, sources citées).
- **Conformité** intégrée (avertissements, mentions, consentement, caviardage).
- **Réutilisation** : workers Python de recherche/crawl partagés analyse ↔ enrichissement.
- **IA optionnelle** : Claude améliore l'analyse et la rédaction ; repli heuristique.
- **Bilingue** FR/EN ; sorties documents FR prééminent.
