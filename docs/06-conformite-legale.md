# 06 — Conformité légale (Québec) & garde-fous produit

> Synthèse opérationnelle. À traduire en **contraintes codées** dans le produit. En cas
> de doute, signaler l'incertitude dans la sortie ; ne pas affirmer. Points à valider
> auprès des autorités listés en fin de document.

## Cadre

- **Loi sur le courtage immobilier (LCI)**, RLRQ c. C-73.2 + règlement **C-73.2, r.1**
  (déontologie + publicité), administrés par l'**OACIQ**.
- **Code civil du Québec (CCQ)**.
- **Loi 25** (protection des renseignements personnels, en vigueur depuis 2023-09-22).
- **Loi 96 / Charte de la langue française** (français prééminent, depuis 2025-06-01).

## 1. Opinion de valeur marchande ≠ évaluation

- Le courtier produit une **« opinion de la valeur marchande » à des fins marketing**,
  **PAS une « évaluation »** au sens réservé. L'évaluation officielle est l'acte d'un
  **évaluateur agréé (É.A., OEAQ)**, reconnu par prêteurs/tribunaux/fisc.
- **Garde-fous à coder :**
  - Ne **jamais** étiqueter une sortie « évaluation », « rapport d'évaluation », ni
    employer « évaluateur agréé »/« É.A. » pour le courtier.
  - Insérer **automatiquement** un avertissement sur toute sortie de valeur (gabarit
    ci-dessous).
  - Exiger la **citation de la méthode** (comparaison/parité en résidentiel) et
    **joindre/enregistrer les comparables** utilisés.

**Avertissement type (FR) :**
> *Le présent document constitue une opinion de la valeur marchande établie par un
> courtier immobilier à des fins de mise en marché. Il ne constitue pas une évaluation
> au sens de la Loi sur les évaluateurs agréés et ne remplace pas le rapport d'un
> évaluateur agréé reconnu par les institutions financières, les tribunaux ou les
> autorités fiscales.*

## 2. Comparables

- **Ne pas divulguer** au client les **prix de vente** de comparables **avant leur
  publication au Registre foncier**.
- **Caviarder** toute donnée identifiant un **vendeur** sur les fiches de comparables
  avant tout partage. → Le module évaluation doit masquer ces champs par défaut sur les
  exports client.

## 3. Publicité / marketing (toute publicité, sollicitation, représentation)

Mentions **obligatoires** à forcer sur toute sortie marketing :
- **Nom de l'AGENCE** exactement comme au permis + **désignation** (agence immobilière /
  résidentielle / commerciale).
- **Nom du COURTIER** exactement comme au permis + désignation ; si rattaché à une
  agence, inclure le nom de l'agence.

Interdits / conditions :
- Pas de titre trompeur de **« spécialiste »** → détecter et bloquer/avertir.
- **« VENDU »** : exige le **consentement écrit du vendeur** (drapeau enregistré) ;
  contraintes de délais (acte / 180 jours).

## 4. Loi 25 (renseignements personnels)

- **RPRP** (responsable) configurable + coordonnées affichées ; **politique de
  confidentialité** liée en pied de page.
- **Consentement** clair, libre, éclairé, spécifique, **présenté séparément**,
  **horodaté et journalisé** (référence : Formulaire de consentement Loi 25 fourni).
- **Rétention** avec **suppression sécurisée** ; contrôle d'accès ; journal et
  notification d'incidents.
- **Pas de listes nominatives** sans consentement enregistré ; respect de l'**opt-out**
  de prospection (module 6).

## 5. Loi 96 (langue française)

- Tout contenu commercial destiné aux consommateurs québécois doit être **disponible en
  français** ; le français doit être **au moins aussi prééminent** que toute autre langue.
- → Génération **bilingue par défaut** ; FR en premier / version FR autonome ;
  affichage public « nettement prédominant » (≥ 2× l'espace de l'autre langue).

## 6. Repères de marché

Cap rates, MRB, $/pi², $/place, facteurs comparatifs = **valeurs par défaut éditables**,
**jamais des vérités**. Toujours afficher comme hypothèses modifiables, avec date et
source. Le rôle d'évaluation municipale **n'est pas** la valeur marchande.

## Implémentation (où coder)
- Moteur `render/` : injecte en-têtes/pieds (mentions, avertissements) selon le type de
  document et la langue ; applique le caviardage des comparables.
- Réglages : agence, courtier (nom/permis/désignation), RPRP, URL politique de
  confidentialité, drapeaux de consentement.
- Validation pré-export : présence des mentions, détection « spécialiste », état du
  consentement « VENDU », langue FR présente et prééminente.

## À valider (avant de coder en dur)
1. Frontière acte réservé vs titre réservé de l'É.A. (OEAQ / Code des professions).
2. Texte exact des mentions de publicité — vérifier C-73.2 r.1 article par article
   (sources OACIQ/LégisQuébec à lire manuellement, fetch automatisé bloqué).
3. Délais précis « VENDU » et conditions de pancarte.
4. Mécanique des baux commerciaux (brut/net/TMI) — pas de source autoritaire unique.
