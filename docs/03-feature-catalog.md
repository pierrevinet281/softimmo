# 03 — Catalogue de fonctionnalités (par module)

Fonctionnalités cibles, enrichies par la recherche sur les besoins des courtiers
québécois et les solutions du marché (Cloud CMA, RPR, Matrix/Realist, Centris,
BrokerBay, kvCORE/BoldTrail, RealtyJuggler, marketingimmobilier.ca, outils IA). Les
détails de recherche bruts et sources sont dans `docs/08-research-findings.md`.

Légende priorité : **P1** (cœur, MVP) · **P2** (important) · **P3** (différenciateur).

---

## Module 1 — Analyse de propriété

**Saisie & caractérisation (P1)**
- Fiche propriété multi-bâtiments (tous les champs de la requête).
- Import assisté depuis fiches Centris / extraits / rôle (workers extract + IA mapping).
- Détection d'anomalies de superficie (terrain/bâtiment/habitable) avec alerte —
  inspirée du cas réel (superficie corrigée d'un lot).
- Zonage, usage, statut de viabilisation (terrain).

**Historique de transactions (P1)** — statuts en vigueur/vendue/expirée ; parties ;
prix ; source. Recherche web + saisie manuelle ; provenance.

**Tableaux financiers (P1)**
- **Rent roll** par unité (type, superficie, loyer, bail, échéance, vacance).
- **Dépenses** : taxes municipales/scolaires, assurances, énergie, entretien, gestion %,
  déneigement/paysagement, conciergerie, **réserve pour remplacements**.
- **Rentabilité** : revenus bruts potentiels → effectifs → **RNE** ; **MRB**, **MRN**,
  **TGA/cap rate**, **$/porte**, flux par porte. Contrôle de cohérence (alerte si ratio
  de dépenses < 30 %).

**Rapports & expertises (P2)** — liste (date, type, lien) + tableau de résultats
(inspection, sol, environnemental, etc.).

**Étude de trafic (P2)** — DJMA/débits (MTQ via Données Québec) pour commercial/terrain ;
seuils indicatifs par usage (ex. station-service).

**Synthèse IA (P3)** — résumé pré-recherche des constats documentaires avant recherche
web, à la manière de la démarche analytique de référence.

---

## Module 2 — Évaluation (opinion de valeur marchande)

**Méthodes (P1)**
- **Comparaison** : import/saisie de 3-5 comparables ; ajustements par comparable
  (superficie, chambres/sdb, garage, piscine, état, année, finition) ; moyenne pondérée.
  UX de curation (réordonner, noter pire/égal/meilleur, annoter, pondérer) — inspiré RPR.
- **Coût** : terrain + coût de remplacement − dépréciation (physique/fonctionnelle/
  externe). Pour commercial, industriel, neuf, atypique.
- **Revenu** : RNE ÷ TGA (capitalisation directe) ou DCF. Immeubles 6+ logements,
  commercial, industriel.
- **Réconciliation** des 3 méthodes avec pondération justifiée.

**Vérifications croisées (P2)** — **RPVE** (prix/évaluation), **rôle × facteur
comparatif**, **$/pi²**, **$/place** (RPA).

**Profils par type (P1/P2)** — formulaires et ratios adaptés : unifamiliale, plex/multi,
commercial (baux brut/net/TMI), industriel ($/pi², hauteur, quais), terrain
(comparaison $/pi² **ou** méthode résiduelle), **RPA** (entreprise en exploitation :
EBITDA + cap rate selon niveau de soins, séparation valeur immobilière/exploitation).

**Données de secteur (P2)** — démographie (StatCan), locatif/inoccupation (SCHL),
trafic (MTQ), urbanisme/zonage, coûts de construction ; **Local Logic** (scores de
localisation) en option payante.

**Points de vue (P1)** — *vendeur* (positionnement, fourchette) et *acheteur* (pro forma,
étude de demande, analyse de risque/financement).

**Sorties (P1)** — opinion de valeur + annexe des sources + sommaire exécutif.
**AVM avec score de confiance 0-5 (P3)** et assistant « Refine Value » à leviers
explicites (inspiré RPR). **ACM récurrente automatisée** style *Homebeat* (P3, rétention).

> Tous les repères (cap rate, MRB, $/pi²) = **défauts éditables**. Avertissement légal
> « opinion ≠ évaluation » obligatoire sur toute sortie.

---

## Module 3 — Offre de services

- Générateur **vendeur** et **acheteur** (P1) : profil/bio courtier, stratégie de mise en
  marché, plan marketing multicanal, calendrier, honoraires/commission, valeur ajoutée,
  témoignages, prochaines étapes.
- Gabarits brandés (logo, coordonnées, agence) (P1) ; sortie PDF + numérique (P1).
- Variantes par type de bien (P2). Bilingue, mentions obligatoires (P1).
- Générateur « Guide du vendeur / acheteur » en quelques minutes (P2) — éprouvé au QC
  (marketingimmobilier.ca).

---

## Module 4 — Matériel marketing

Un **moteur de gabarits, plusieurs sorties** depuis les mêmes données propriété :
- **Brochure** longue (P1) — gabarits **unifamiliale** et **RPA** (modèles fournis).
- **Pub moyenne** Kijiji / classées (P1).
- **Fil Facebook** (P1), **Facebook Marketplace** (P1), **Instagram** (post + carrousel)
  (P1), **X** (280, fil) (P1), **LinkedIn** (P1).
- **Diapos de carrousel vidéo** (P2) : séquence d'images 1:1 / 4:5 / 9:16.
- Génération de **copy assistée IA** (P2) : hook, corps, CTA, hashtags ; ton adaptable.
- Respect strict des **specs de format** (`docs/07-marketing-specs.md`) et **Loi 96**
  (FR prééminent) + mentions OACIQ (P1). Désactivation/limitation d'emojis configurable.

---

## Module 5 — Trousse de soutien client

- Bibliothèque de **guides & checklists** (vendeur, acheteur, copropriété, plex,
  commercial, entreprise) dérivés des `Documents de présentation` (P1).
- Personnalisation au mandat et au courtier (P2).
- Explications (commission, processus, délais Loi 16 copropriété, etc.) (P2).
- Génération de la trousse en PDF brandé (P1).

---

## Module 6 — Recherche & enrichissement de contacts (socle intégré)

Hérité et fonctionnel ; ré-orienté immobilier :
- **Générer** companies/contacts depuis un brief (P1, existant).
- **Enrichir** (waterfall plan→search→crawl→resolve→pattern→verify→score) (P1, existant).
- **Vérifier** courriels (syntaxe+MX+SMTP opt.) et téléphones (E.164) (P1, existant).
- **Gérer** : tables, listes, tags, import/export CSV/XLSX/JSON, provenance, activité,
  dashboard, marketplace de connecteurs (P1, existant).
- **Adaptations immobilier (P2/P3)** : types de leads *vendeur/acheteur/prospect* ;
  lien lead ↔ propriété ; trouver acheteurs pour un vendeur (matching) ; sources
  spécifiques (registres, annuaires). Conformité **Loi 25** (consentement, opt-out).

---

## Capacités transverses (plateforme)

- **Dashboard** mandats/propriétés/contacts (P1).
- **Génération de documents** (HTML→PDF, exports formats marketing) — moteur `render/`
  (P1).
- **Recherche web agentique** réutilisant les workers Python + IA (P1).
- **Provenance & sources** sur toute donnée (P1).
- **Conformité** intégrée (avertissements, mentions, consentement, caviardage) (P1).
- **Bilingue** FR/EN (P1) ; **thème** light/dark (P1, existant).
- **Réglages** : clé API Anthropic, Google CSE, politesse crawl, agence/courtier,
  RPRP/politique de confidentialité (P1).
