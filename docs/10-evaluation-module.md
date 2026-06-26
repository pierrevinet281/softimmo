# 10 — Module 2 : Évaluation (spec enrichie, inspirée d'Evalo & similaires)

> Spécification cible du module **Évaluation** de Softimmo. Intègre les fonctionnalités
> observées sur **evalo.ca** (EVALO AI, service québécois de rapports d'évaluation) et les
> concurrents (`docs/08`). **Principe : déterministe d'abord, sans IA au runtime**
> (`CLAUDE.md` §3) — l'AVM est un **modèle statistique** (comparables + régression), pas un
> appel IA par rapport. Rappel légal : sortie = **« opinion de la valeur marchande »**, pas
> une « évaluation » (`docs/06`).

## Fonctionnalités d'Evalo à reproduire (et étendre)

| Fonction Evalo | Description | Dans Softimmo |
|---|---|---|
| **AVM – Valeur marchande** | Prédiction de valeur basée sur transactions notariées (3,5 M propriétés QC) + indice de confiance | Module 2 §AVM — modèle statistique sur comparables ; voir dépendance données ci-dessous |
| **AVM – Valeur locative** | Estimation des loyers de marché (analyse d'investissement) | §AVM locatif (alimente l'approche revenus) |
| **Comparables ventes & locations** | Sélection auto des comparables pertinents (type, superficie, localisation) | **ACM** = méthode principale → import PDF Matrix + ajustements + prix d'inscription : **`docs/12-acm-comparables.md`** |
| **Indice de confiance & statistiques** | Score de confiance (ex. 93,1 %), écart-type, fourchette de prix | §Confiance — calculé depuis la dispersion des comparables |
| **Enjeux environnementaux** | Zones inondables, milieux humides, terrains contaminés, glissements de terrain (min. Environnement) | §Environnement — données ouvertes Données Québec / GéoIndex |
| **Historique & infos municipales** | Historique propriété, évaluation municipale, permis ; MAJ trimestrielle | Module 1 (`transactions`, `reports`) + rôle municipal |
| **Intelligence de marché & démographie** | Volume de transactions, délai de vente moyen, appréciation, tendances démo | §Marché — StatCan + Données Québec (+ Local Logic en option) |
| **Fourchette de qualité & état** | Plage statistique de l'état/qualité probable | §Qualité — heuristique sur âge/secteur/comparables |
| **Approche par revenus** | Loyers/unité, **MRB**, **taux de capitalisation**, valeur revenus | §Revenus — réutilise rent roll/dépenses du Module 1 (calcul déjà prévu) |
| **Vue 3D dynamique inclinée (Google Maps)** | Image aérienne 3D animée/inclinée à l'adresse — rend le rapport vivant | §Carte 3D (ci-dessous) |
| **Recherche par adresse → « Générer le rapport »** | Champ d'adresse en page d'accueil + carte explorable | §Saisie — wizard d'évaluation |

## Composants du module

### A. Saisie & points de vue
- Saisie par **adresse** (géocodage) + sélection de la propriété (lien Module 1) ou création.
- Deux points de vue : **vendeur** (positionnement/fourchette) et **acheteur** (pro forma,
  étude de demande, analyse de risque) — `docs/03` Module 2.

### B. AVM (modèle statistique, déterministe)
- **Valeur marchande** : moyenne pondérée des comparables ajustés (méthode comparaison) +
  régression simple ($/pi², ajustements année/superficie/état) ; réconciliation avec
  coût/revenu selon le type (`docs/08` §1). **Score de confiance 0-5 ★ / %** dérivé de la
  dispersion (écart-type) et du nombre/qualité des comparables.
- **Valeur locative** : modèle sur loyers comparables → alimente l'approche revenus.
- **Pas d'IA au runtime.** (IA optionnelle seulement pour rédiger le texte narratif du
  rapport, désactivable.)
- **Dépendance données (à trancher)** : l'AVM d'Evalo repose sur un dataset propriétaire de
  transactions notariées. Softimmo n'a pas ce dataset gratuitement. Options : (a) comparables
  **saisis/importés** par le courtier (Centris) — voie par défaut, gratuite ; (b) **Registre
  foncier** (payant au document) ; (c) **JLR/API** (abonnement). Voir l'analyse Local Logic /
  sources (`docs/08`, et le rapport de recherche Local Logic).

### C. Confiance & statistiques
- Indice de confiance, écart-type, fourchette basse/haute, n comparables, MAJ.

### D. Enjeux environnementaux
- Couches : zones inondables, milieux humides, terrains contaminés (GTC/répertoire),
  glissements de terrain. Source : **Données Québec / Données ouvertes du min. Environnement**
  (couches géospatiales). Affichage carto + drapeaux dans le rapport.

### E. Intelligence de marché & démographie
- Volume de transactions, délai de vente, appréciation du secteur, profil démographique.
  Sources : **StatCan (API WDS)**, **SCHL (locatif)**, **Données Québec**, MTQ (trafic).
  **Local Logic** en **option payante** (scores de localisation) — voir rapport dédié.

### F. Approche par revenus (immeubles à revenus)
- Réutilise rent roll + dépenses (Module 1) : revenus bruts → effectifs → **RNE**, **MRB**,
  **MRN**, **TGA/cap rate**, **$/porte**, **valeur revenus**. Repères = défauts éditables.

### G. Carte 3D dynamique (comme Evalo)
- **Recommandation** : **Google Aerial View API** — vidéo cinématique 3D inclinée
  pré-rendue à l'adresse. **5 000 événements gratuits/mois** (≈ 0 $ pour un courtier seul).
- Alternative interactive : **Photorealistic 3D Tiles** (1 000 gratuits/mois) rendus via
  **MapLibre/CesiumJS** pour une caméra inclinée animée.
- Repli **gratuit** : image satellite/oblique statique (Google Static / tuiles) si l'on veut
  éviter toute clé payante. Clé `GOOGLE_MAPS_API_KEY` dans Réglages, usage suivi.
- Conforme au principe de coût minimal : rester dans les quotas gratuits ; rendre la 3D
  **optionnelle/désactivable**.

### H. Sortie « Rapport d'évaluation »
- Via le moteur `render/` (Phase 2/3) : PDF (+ éventuellement PPTX éditable, `docs/09`).
- **Mentions légales automatiques** (« opinion ≠ évaluation »), méthode citée, comparables
  **caviardés** (vendeur) à l'export client (`docs/06`).
- Sections du rapport calquées sur Evalo : sommaire valeur + confiance, comparables,
  statistiques, environnement, historique/municipal, marché/démo, qualité/état, approche
  revenus, annexe sources.

## Tâches (Phase 3 — `docs/04`)
- [ ] Modèle AVM statistique (comparaison + régression) + score de confiance ; valeur locative.
- [ ] UI évaluation : wizard adresse → données → comparables (curation) → méthodes → rapport.
- [ ] Couches environnementales (Données Québec) + carte.
- [ ] Intelligence marché/démo (StatCan/SCHL/Données Québec) ; Local Logic optionnel.
- [ ] Approche revenus branchée sur Module 1.
- [ ] **Carte 3D** Aerial View API (option, quotas gratuits) + repli statique.
- [ ] Rapport via `render/` avec mentions/caviardage.
- [ ] Points de vue vendeur/acheteur.

## Sources
evalo.ca · developers.google.com/maps/documentation/tile/3d-tiles ·
mapsplatform.google.com/resources/blog/aerial-view-api-now-generally-available ·
voir aussi `docs/08-research-findings.md` (sources de données QC) et le rapport Local Logic.
