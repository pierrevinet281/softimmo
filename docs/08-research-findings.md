# 08 — Résultats de recherche (besoins courtiers, concurrents, données, sources)

Recherche menée en session 1 (2026-06-25). Sert de référence aux modules 1-2 et 4.
Degrés de confiance et incertitudes signalés. Les specs marketing sont dans `docs/07`.

## 1. Méthodes d'évaluation (alignées OEAQ)
- **Comparaison/parité** : 3-5 comparables récents + ajustements (année, superficies,
  garage, piscine, état, finition) → moyenne pondérée. Unifamilial, condo, terrain,
  petit plex.
- **Coût** : terrain + coût de remplacement − dépréciation (physique/fonctionnelle/
  externe). Commercial, industriel, neuf, atypique, patrimonial.
- **Revenu** : RNE ÷ TGA (capitalisation directe) ou DCF. Formellement immeubles
  **6 logements+**, commercial, industriel, bureau.

### Fonctionnalités par type de bien
- **Unifamiliale** : comparaison + vérifs **RPVE** et **rôle × facteur comparatif**.
- **Plex/multi** : rent roll par logement ; vacance % + mauvaises créances % ; dépenses
  détaillées (taxes muni/scolaires, assurances, entretien, gestion %, énergie communes,
  déneigement, conciergerie, **réserve remplacements**) ; **RNE → MRB, MRN (=1/TGA),
  TGA**, **$/porte** ; alerte si ratio dépenses < 30 % (typique 35-50 %).
- **Commercial** : 3 méthodes réconciliées, revenu primaire si loué ; baux **brut/net/
  TMI triple net**, récupérations, indexations ; **$/pi²**.
- **Industriel** : coût + revenu ; superficies, hauteur libre, quais, portée, environn. ;
  **$/pi²**. (À vocation unique : municipal impose le coût.)
- **Terrain** : (a) comparaison **$/pi²** ajustée (zonage/services/taille/localisation) ;
  (b) **méthode résiduelle** (revenus projet − coûts construction − marge promoteur).
  Zonage/densité/usage optimal = moteurs de valeur.
- **RPA** : **entreprise en exploitation** → **EBITDA + cap rate selon niveau de soins** ;
  **séparer valeur immobilière vs exploitation** ; rent roll par type d'unité/soins,
  occupation, services auxiliaires, masse salariale normalisée ; **$/place** ; statut
  certification MSSS/CISSS.

> Repères directionnels (défauts éditables, **non vérités**) : TGA Montréal premium
> 4-5 %, urbain 4,5-5,5 %, banlieues 5-6 %, régions 6-7 %+ ; MRB Montréal ~12-14×.
> Sources : blogues de courtiers (confiance moyenne/faible, parfois contradictoires).

## 2. Sources de données (Québec)
| Source | Gratuit | Fournit | Accès |
|---|---|---|---|
| **Centris** (APCIQ) | Non (membres) | comparables vendus/actifs/expirés | apciq.ca |
| **JLR** | Non (abonn.) | 7M+ transactions notariées, ventes privées, rapport ÉVIA, RPVE | API gated — solutions.jlr.ca |
| **Rôle d'évaluation municipal** | Oui | valeurs portées ; via **facteur comparatif** → valeur marchande | XML en lot (CKAN) ; noms/cadastre caviardés |
| **Registre foncier QC** | Non (1,50 $/doc) | registre légal, propriétaires, actes | par document, **pas d'API** |
| **Statistique Canada** | Oui | recensement 2021 (démo, logement, revenu) | **API WDS/SDMX** — statcan.gc.ca/en/developers/wds |
| **SCHL/CMHC** | Oui | inoccupation, loyers moyens/médians par RMR | portail **HMIP** (pas d'API) |
| **Données Québec** | Oui | 1000+ jeux, rôles, trafic | **API CKAN v2.10** — donneesquebec.ca/page-api |
| **MTQ — débit circulation** | Oui | DJMA/DJME/DJMH, 4500+ sites | géospatial via Données Québec (WFS non confirmé) |
| **Local Logic** | Non (payant) | 18 scores localisation, POI, démographie (Market Stats = US only) | **API REST + SDK + widgets** — docs.locallogic.co |

Meilleure pile gratuite/programmable : **Données Québec (CKAN) + StatCan WDS + XML rôles
+ tables SCHL + géodonnées MTQ**. Le payant = données **nominatives/transactionnelles**
(Registre foncier au doc, ou JLR).

## 3. Fonctionnalités concurrentes à répliquer
- **Cloud CMA** : 4 types de rapports brandés ; **Homebeat** (ACM récurrente auto =
  rétention) ; **CMA Live** (présentation interactive) ; édition courtier (gabarits
  centralisés + tableau de bord).
- **RPR (NAR)** : **RVM** (AVM) avec **score de confiance 0-5 ★** ; outil **« Refine
  Value »** (4 leviers explicites) ; gestion fine des comps (réordonner, noter, annoter,
  pondérer).
- **Matrix + Realist (CoreLogic)** : comps **hors-MLS** depuis registres fiscaux/évaluation.
- **Centris Statistics** : stats de marché par période/catégorie/secteur (QC).
- **BrokerBay** : gestion visites/offres/formulaires.
- **kvCORE/BoldTrail** : **CORE Present** (curseur de prix + suivi d'engagement) ;
  Marketing Autopilot (campagnes multicanal) ; valorisations mensuelles auto.
- **RealtyJuggler** : 100+ flyers, calculateurs (net vendeur/acheteur, louer vs acheter).
- **marketingimmobilier.ca** (QC) : **Guide du vendeur en ~5 min**, 100 % personnalisé,
  numérique + imprimé ; Guide de l'acheteur ; 1200+ courtiers QC.
- **Outils IA** : Saleswise (ACM + staging virtuel + copy + flyer + posts), Write.Homes.

**À répliquer en priorité** : AVM + score de confiance ; « Refine Value » à leviers ;
curation des comparables ; ACM récurrente (Homebeat) ; mode présentation live ; un moteur
→ plusieurs sorties brandées ; guide vendeur/acheteur express ; copy IA ; comps hors-MLS
(rôle/registre) ; tableau de prix avec suivi d'engagement.

## 4. Conformité (résumé — détail dans `docs/06`)
- Opinion de valeur marchande **≠** évaluation (réservée à l'É.A./OEAQ) → avertissement.
- Comparables : pas de prix avant publication au Registre foncier ; caviarder le vendeur.
- Publicité : nom agence + désignation, nom courtier + désignation ; pas de
  « spécialiste » ; « VENDU » sur consentement.
- **Loi 25** : consentement séparé/horodaté, RPRP, rétention, opt-out.
- **Loi 96** : FR prééminent ; amendes 700-30 000 $/jour.

## 5. Incertitudes à valider
1. Frontière acte vs titre réservé É.A. (OEAQ / Code des professions).
2. Texte exact des mentions C-73.2 r.1 (lecture manuelle OACIQ/LégisQuébec).
3. Cap rates/MRB : directionnels, à exposer comme défauts éditables.
4. Mécanique TMI/triple net : pas de source autoritaire unique.
5. API SCHL et WFS MTQ non confirmées → repli téléchargement manuel.
6. RPA tangible/intangible : lire le guide JVM de l'OEAQ pour fermer le point.

## Sources principales (URLs)
apciq.ca · solutions.jlr.ca/fr/courtier-immobilier · quebec.ca (proportions médianes) ·
portail-info.foncier.gouv.qc.ca · statcan.gc.ca/en/developers/wds ·
www03.cmhc-schl.gc.ca/hmip-pimh · donneesquebec.ca/page-api · docs.locallogic.co ·
oaciq.com (guidelines, advertising) · legisquebec.gouv.qc.ca (C-73.2 et r.1) ·
cai.gouv.qc.ca · oeaq.qc.ca · lwolf.com/engage/cma · blog.narrpr.com ·
boldtrail.com/platform · marketingimmobilier.ca/guides-immobilier/guide-vendeur
