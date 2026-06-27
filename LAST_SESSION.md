# LAST_SESSION.md

> Fichier de continuité entre sessions. Lu au début de chaque session (après
> `CLAUDE.md`). Mis à jour au closeout de chaque session.

---

## ▶ REPRISE RAPIDE (à lire en premier)

**Pour reprendre, il suffit d'un prompt du genre :**
> « Nouvelle session Softimmo. Lis `CLAUDE.md` puis `LAST_SESSION.md` (et `docs/00`), puis
> enchaîne sur les *Prochaines tâches*. Mode continu. »

**Où on en est (après 31 sessions, tout sur `main`) :**
- **Framework complet** : `CLAUDE.md` + docs `00`→`12` (vision, archi, catalogue, plan,
  dev-process, conformité, specs marketing `09`, évaluation `10`, Local Logic `11`, ACM `12`).
- **Phase 1 livrée** : socle d'enrichissement re-brandé Softimmo + modèle de données métier
  (9 tables + repos + routes CRUD + `/properties/:id/bundle`), i18n FR/EN + bascule,
  navigation par module, page **Propriétés**. **L'app démarre** (`npm run dev` → web `:5180`,
  API `:8787`).
- **Phase 2 — Module 1 (Analyse de propriété) CONSTRUIT** (session 6) : **page détail**
  `/properties/:id` à 7 onglets (Caractérisation+bâtiments, Rent roll, Dépenses, Rentabilité,
  Transactions, Comparables, Rapports) ; **CRUD générique** (modals config-driven) pour
  bâtiments/unités/dépenses/transactions ; **moteur de rentabilité déterministe**
  (`engine/finance.js` : GPI→EGI→RNE, MRB, MRN, TGA, $/porte, ratio dépenses + alertes) et
  **détection d'anomalies de superficie**, exposés par `GET /properties/:id/analysis`.
  Testé bout-en-bout (calculs exacts) ; build web OK.
- **Phase 3 — Module 2 (Évaluation / ACM) CONSTRUIT** (session 7) : **moteur ACM déterministe**
  (`engine/acm.js`) — ajustements explicables (superficie × coût, inclusions, âge, date de
  vente), prix de vente attendu pondéré, prix d'inscription (ratio APCIQ), corroboration éval.
  foncière, plafond expirés, concurrence en vigueur, garde-fous APCIQ (exclusion 50-150 %,
  prudence < n transactions). **Page `/evaluation`** : sélection propriété → sujet →
  comparables (CRUD, sold/active/expired) → paramètres éditables → résultats + **grille
  d'ajustements ventilée (vues courtier/client)** + ventilation expliquée + avertissement
  « opinion ≠ évaluation ». Schéma comparables/properties étendu, paramètres en seed +
  override settings. Testé bout-en-bout ; build web OK.
- **Specs prêtes pour la construction** : Évaluation avancée (`10` Evalo/AVM/carte 3D, `11`
  Local Logic), Marketing (`09`). Restent en placeholders côté UI.

**Prochaine session = suite Module 2** (extraction PDF Matrix + stats APCIQ, AVM, carte 3D,
revenus) **ou Module 3 (Offre de services)**. Voir *Prochaines tâches*. (Restes Module 1 =
import assisté + moteur `render/` partagé.)

**Rappels** : seul `SoftImmoDev` est modifiable ; conformité non négociable ; déterministe
d'abord (IA pour bâtir, pas au runtime) ; closeout à chaque fin (commit→PR→squash→ff main→
backup). Remote `https://github.com/pierrevinet281/softimmo`. Backup : `..\Backup-Softimmo\Lancer-Backup.bat`.

---

## Session 30-31 — Round-trip PPTX SELF-SERVICE + correctif verrou luxe (2026-06-27)

Le courtier peut désormais **ajuster les positions des brochures lui-même**, sans intervention
sur le code. PR #39→#41, tout sur `main`.

- **Verrou luxe** (PR #39) : « COLLECTION DE LUXE » n'est plus rogné (marge intérieure).
- **Mise en page pilotée par JSON** (PR #40) : positions sorties du code →
  `server/python/brochure_layout.py` (DEFAULT_LAYOUT + NAME_MAP rôle↔nom de forme PPTX). Les
  deux moteurs lisent `load_layout(template)` ; `layouts/<template>.json` écrase les défauts
  (git-ignoré). `pptx_to_layout.py` : worker .pptx édité → JSON (round-trip vérifié, 20 rôles).
- **Bouton self-service** (PR #41) : API `GET/POST/DELETE /brochure/templates/:template/layout` ;
  UI sélecteur de modèle → « Mettre à jour le modèle (PowerPoint) », badge « Personnalisé »,
  « Réinitialiser ». Le courtier téléverse son PPTX édité → positions reportées automatiquement.

**⚠️ Limite luxe** : le gabarit `Brochure Luxury\modele_brochure.pptx` est une quasi-copie de
l'unifamiliale (bannière bleue) ; le look noir/or est **dans le code**. Self-service luxe =
nécessite un VRAI gabarit luxe. **Reste** : valider rendu PPTX dans PowerPoint ; modèles
RPA/Commercial/Entreprise (gabarits à fournir).

---

## Session 29 — Photos de propriété + QR configurable + pagination jumeau PPTX (2026-06-27)

Rend les brochures **réellement utilisables** (vraies photos au lieu de placeholders). PR #35→#37.

- **Photos de propriété** (PR #35) : table `property_media` (rôles hero|map|interior|gallery,
  position) + repo `PropertyMedia` ; API `GET/POST/PATCH/DELETE /properties/:id/photos` + `.../raw`
  (upload multi-images → `data/uploads/properties/:id/`) ; `buildBrochureData` câble
  `images.hero/map` + `interior[]` (repli galerie) ; **onglet UI « Photos »** (vignettes, rôle,
  suppression). i18n FR/EN.
- **Lien QR configurable** (PR #36) : colonne `properties.brochure_qr_url` (fiche Centris, site,
  mailto:…) éditée dans l'onglet Photos ; `listing_url` de la brochure = ce lien (sinon site courtier).
- **Pagination jumeau PPTX** (PR #37) : le tableau des pièces du `.pptx` se pagine comme le PDF
  (diapo de suite + pied sur la dernière si trop de pièces). Hauteurs de rangées explicites.

**Reste à faire brochure** (nécessite l'utilisateur) : **valider le rendu PPTX dans PowerPoint**
(bouger des éléments → je ré-extrais via `extract_pptx_layout.py`) ; **modèles RPA / Commercial /
Entreprise** (fournir les gabarits de référence) ; option héros page 2 plus grand (régler dans le PPTX).

---

## Session 28 — Brochure alignée sur les gabarits PowerPoint + jumeau PPTX éditable (2026-06-27)

**Tournant : les positions des brochures proviennent désormais des gabarits PowerPoint du
courtier** (round-trip, docs/09). PR #30→#33, tout sur `main`.

- **Contour noir** sur toutes les photos ; **pied page 2 complet** (héros + coordonnées + QR)
  (PR #30). Héros identique entre modèles (PR #31).
- **Mise en page PPTX-driven** (PR #32) : `server/python/extract_pptx_layout.py` extrait les
  positions des gabarits (résout les groupes) ; `render_brochure.py` réécrit avec helpers
  `PX/PY/pbox` projetant l'espace **540×720 (7,5×10 po)** sur **Lettre 8,5×11** par échelle
  **uniforme ajustée à la hauteur** (×1,1 ; carrés préservés ; marges latérales ~9 pt ; NE PAS
  étirer en largeur → rognerait le pied). Couleurs explicites conservées (#314897). Médaille
  débordant le haut de la bannière ; grille/prix/courtier aux coords PPTX. Pièces **dynamiques**
  (rangées comprimées dans la zone fixe ; **3e page auto** si trop nombreuses).
- **Jumeau PPTX éditable** (PR #33) : `server/python/render_brochure_pptx.py` (python-pptx) —
  formes/textes/images + **vrai tableau éditable** + QR rasterisé (matrice ReportLab → PIL).
  Endpoint `GET /properties/:id/brochure.pptx?template=` ; UI : sélecteur propose **PDF** et
  **PowerPoint (éditable)**. Round-trip bouclé (ré-extraction = coords identiques).
- Gabarits PPTX source (lecture seule) : `..\Brochure unifamiliales\Brochure Inscription.pptx`,
  `..\Brochure Luxury\modele_brochure.pptx`. Décision : **PDF final en 8,5×11** (PPTX en 7,5×10).
- Dép. ajoutée : **python-pptx==1.0.2**.

**Reste à faire brochure** : valider le rendu PPTX dans PowerPoint (l'utilisateur peut bouger
des éléments → je ré-extrais) ; option héros page 2 plus grand (à régler dans le PPTX) ;
logique multi-pages aussi dans le jumeau PPTX ; lien QR configurable par propriété ; téléversement
des photos de propriété depuis l'UI ; modèles RPA / Commercial / Entreprise.

---

## Session 26 — Brochure : alignement horizontal du bloc titre (2026-06-26)

- Le bloc titre (titre + ville + sommaire) était trop à droite. `tx` (x du titre) calculé après
  rognage de la marge transparente du logo (`_trim_alpha`) + écart réduit → titre à ~147 pt
  (24 % de la largeur), collé au logo, aligné comme le modèle.

---

## Session 25 — Brochure : remplir la page 8,5×11 + logo mieux placé (2026-06-26)

- Page **est** bien 612×792 (8,5×11) ; le « trop large » venait du **contenu qui ne remplissait
  pas la hauteur**. Corrigé : **photos hautes** (`iw_h` 200→250) + espacement grille
  (`rgap` 6→8) → le contenu occupe toute la page (courtier/prix près du bas, marge ~30).
- **Logo eXp** agrandi (hauteur 56→66) et **titre positionné juste après le logo** (`tx` dynamique
  = `M + largeur_logo + 22`) au lieu d'un décalage fixe. Conforme au modèle.

---

## Session 24 — Brochure : marge extérieure + médaille (sommet sur le haut de bande) (2026-06-26)

- **Marge extérieure `MO=30`** (haut/gauche/droite) : `T(y)=PH−MO−y` + bandeaux insérés
  (`rect(M, …, PW−2M, …)`), `M=MO`. Plus rien à fond perdu — sécurité d'impression (« boîtes pour
  respirer »).
- **Médaille** : sommet aligné sur le haut de la bande (`T(0)−ms`, ms=155) → comme 0,31·155≈bh/2,
  le cercle tombe au centre vertical de la bande **sans déborder vers le haut**, rubans sur la carte.

---

## Session 23 — Brochure unifamiliale : médaille (rubans sur carte) + héros ×2 (2026-06-26)

- Analyse alpha du PNG médaille : centre du cercle à **0,31 depuis le haut** (→ 0,69 du bas).
  Facteur corrigé (était 0,60) + médaille à 150 px → **cercle centré verticalement sur la bande**
  et **rubans débordant par-dessus la carte** (médaille dessinée après l'image). Conforme à la réf.
- **Super-héros page 2 doublé** (hauteur 104 → 208 px).

---

## Session 22 — Brochure unifamiliale : couleur + bannière (ajustements) (2026-06-26)

- **Bleu = `#314897`** (bande + boîtes libellés + en-tête de tableau + filet) au lieu de
  `#1C4E8F`/`#3360A6`.
- **Bannière** : logo eXp **réduit** (hauteur 56, aspect préservé) ; **médaille agrandie** (140 px)
  dessinée **après** les images pour que ses **rubans débordent par-dessus la carte** ; **cercle du
  badge centré verticalement** sur le centre de la bande (`band_center − 0,60·ms`). Réserve de
  largeur du titre ajustée. Rendu vérifié (carte de test) : centrage et débordement conformes.

---

## Session 21 — Brochure unifamiliale : logo eXp + photo SuperPierre (2026-06-26)

- Actifs : `exp_logo_white.png`/`exp_logo_black.png` (logo eXp Agence Immobilière) + `superpierre.png`
  (photo, costume eXp, cape rouge, transparent). `render_brochure.py` : thème unifamilial
  `logo_default`. **Bannière p.1** : vrai logo eXp (blanc, aspect préservé, sans recadrage) remplace
  le texte. **Page 2** : `hero_default` = photo **SuperPierre** (remplace l'illustration `hero.png`,
  supprimée). Rendu vérifié, fidèle au modèle. Exemple régénéré.

---

## Session 20 — Brochure unifamiliale : médaille + héros (2026-06-26)

- Actifs copiés : `assets/unifamilial/certificat.png` (médaille « Propriété Sélectionnée »
  or/bleu, RGBA) et `hero.png` (super-héros bleu, RGBA).
- `render_brochure.py` : thème unifamilial `medal_default` + `hero_default`. **Bannière p.1** :
  la médaille image remplace le badge dessiné (débordant sous la bannière, comme le modèle ;
  repli dessiné conservé). **Page 2** : héros bleu en bas à gauche. Réserve de largeur du titre
  ajustée. Rendu vérifié, fidèle au modèle George, sans débordement. Exemple régénéré.

---

## Session 19 — Brochure : portrait du courtier (page 1) (2026-06-26)

- Portraits du courtier copiés dans l'app : `server/python/assets/broker/portrait.png` (fond
  blanc, ~carré) et `portrait_nobg.png` (transparent).
- `render_brochure.py` : le bloc courtier de la page 1 utilise désormais le portrait par défaut
  embarqué (`asset('broker','portrait.png')`) si `broker.photo` non fourni — recadré carré, coins
  arrondis. S'applique aux deux modèles. Exemples régénérés dans `exemples-brochures/`.

---

## Session 18 — Brochure : recadrage parfait des photos fournies (2026-06-26)

- Exigence : les photos fournies en mise en marché peuvent être de proportions différentes des
  emplacements ; il faut les **recadrer** pour un rendu parfait.
- `render_brochure.py` : le recadrage **« cover » centré** (`_cover`) remplissait déjà chaque cadre
  sans déformation ; ajout de `_load()` qui **redresse l'orientation EXIF** (photos de téléphone)
  avant recadrage, utilisé pour les photos, le logo et le héros.
- **Correctif** : séparation des clés `images.hero` (photo principale, page 1) et
  `images.brand_hero` / `hero_default` (héros de marque, bas de page 2) — évitait une image parasite.
- Vérifié avec photos de proportions extrêmes (2400×600, 600×2000, 1000×1000) : cadres **remplis**,
  cercle-test resté **circulaire** (aucune déformation), **aucune bande blanche**, sur les 5 emplacements.

---

## Session 17 — Brochure Luxe : actifs de marque réels (2026-06-26)

- Actifs eXp Luxury copiés dans l'app (`server/python/assets/luxe/`) : verrou logo blanc
  (`exp_luxury_white.png`), version couleur, et héros doré `superpierre_luxury.png` (RGBA).
- `render_brochure.py` : chemin d'actifs embarqués (`ASSETS`/`asset()`) ; thème luxe pointe
  `logo_default` + `hero_default`. **Bannière luxe** : le verrou logo (eXp + « COLLECTION DE
  LUXE ») remplace le texte dessiné. **Page 2** : héros transparent en bas à gauche (fidèle au
  modèle). Rendu vérifié (logo net sur bannière noire, héros détouré, sans débordement).

---

## Session 16 — Brochure : modèle Luxe + sélecteur de modèle obligatoire (2026-06-26)

- **Système de thèmes** dans `render_brochure.py` : `THEMES` (couleurs + variante de bannière) ;
  `render()` choisit le thème via `data.template`. Même structure de mise en page → plusieurs
  identités visuelles.
- **Modèle « Maison de luxe »** (cible : `Brochure Luxury/brochure_luxury_modele.pdf`) : bannière
  **noire**, titre **or majuscule**, **« COLLECTION DE LUXE »** (+ logo, pas de médaille) ;
  libellés **or**, valeurs **crème** ; filet **or** ; bloc prix **noir** ; page 2 bannière **or**.
  Rendu vérifié, fidèle au modèle, sans débordement (réutilise les primitives `fit`).
- **Sélecteur de modèle OBLIGATOIRE** : bouton « Brochure PDF » → modale `BrochureChooser`
  (Unifamiliale / Luxe / RPA-bientôt). Aucune brochure générée sans choix explicite — important car
  le modèle Luxe affiche une marque de service **non encore souscrite**.
- **Endpoint** `GET /properties/:id/brochure.pdf?template=` validé (`unifamilial`|`luxe` ; `rpa`
  → « bientôt » ; inconnu → 400). i18n FR/EN. Vérifs : `vite build` OK ; HTTP testé (les deux
  modèles → PDF ; rpa/inconnu → 400).

### Reste (modèles de brochure)
- **Port RPA** (`rpa_mlt.pdf`, 6 pages) depuis `_build/brochure.py` → nouveau thème/structure.
- Modèles **Immeuble commercial** et **Entreprise** (copies fournies plus tard par l'utilisateur).
- Téléversement des **actifs réels** (logos, photos, carte, QR, photo courtier) ; jumeau **PPTX**.

---

## Session 15 — render/ : auto-ajustement du texte, ZÉRO débordement (2026-06-26)

- **Exigence utilisateur** : qualité graphiste/imprimeur, **aucun débordement de texte** (défaut
  observé même dans le `rpa_mlt.pdf` de référence). Cibles exactes : `Brochure_..._George.pdf`
  (unifamiliale, fait) et `rpa_mlt.pdf` (RPA, port à venir).
- **Primitives anti-débordement** ajoutées à `render_brochure.py` : `fit_size`/`draw_fit`
  (rétrécit la police puis tronque avec « … » en dernier recours pour une ligne) et `para_fit`
  (réduit la police d'un paragraphe jusqu'à tenir dans une boîte w×h fixe). Appliquées **partout** :
  titre, ville, sommaire, adresse, MLS, libellés/valeurs de la grille, bloc courtier, **prix**,
  bannière p.2, **description** (boîte à hauteur bornée), en-têtes et cellules du **tableau des
  pièces**, pied de conformité.
- **Vérifié par test de stress** (titre/adresse/valeurs/description/noms de pièces démesurés) :
  tout reste **dans les cadres** (rétréci ou tronqué proprement) ; cas George normal toujours fidèle.

### Reste (render/ — prochaines étapes)
- **Port du template RPA** (`rpa_mlt.pdf`) : adapter le script de réf. Tours Gouin `_build/brochure.py`
  (6 pages) dans `server/python/`, en corrigeant les débordements d'origine, + sélateur de template.
- Pagination du tableau des pièces si très nombreuses (débordement vertical de page).
- Téléversement des **actifs réels** (logo, médaille, photos, carte, QR, photo courtier) ;
  **jumeau PPTX éditable + aller-retour** (`docs/09`). Voir [[pdf-rendering-reportlab]].

---

## Session 14 — Moteur render/ : brochure PDF (ReportLab) (2026-06-26)

- **Décision (utilisateur)** : pas de HTML imprimé — **vrai PDF qualité brochure, parfait au
  millimètre**, calqué sur `Brochure unifamiliales/Brochure_Inscription_102-8225_George.pdf`.
  Approche **ReportLab** (positionnement au point), comme le pipeline de réf. Tours Gouin `_build`.
- **Worker `server/python/render_brochure.py`** (déterministe, sans IA) : brochure **2 pages** —
  p.1 bannière (logo eXp + titre + médaille « Propriété Sélectionnée »), photo + carte, adresse +
  MLS + filet, **grille de specs 2 colonnes** (libellés bleus / valeurs claires), bloc **prix
  rouge** + coordonnées courtier + barre rouge ; p.2 bannière rouge, **description**, 3 photos,
  **tableau des pièces**, pied de **conformité** (agence + courtier). Images manquantes →
  placeholders neutres. Repli de polices (Segoe UI → Helvetica). Lecture stdin forcée UTF-8.
- **Endpoint** `GET /properties/:id/brochure.pdf` : assemble les données depuis le bundle
  (genre→titre, ch/sdb/superficie, adresse, MLS, prix de la transaction active, specs bâtiment,
  pièces=unités) + profil courtier (`settings.broker_profile`, défaut Pierre Vinet/eXp) → rend le
  PDF et le **diffuse** (application/pdf). Bouton **« Brochure PDF »** dans l'en-tête du détail.
- `reportlab`/`Pillow` ajoutés à `requirements.txt` (installés). **Vérifs** : `vite build` OK ;
  rendu vérifié visuellement (mise en page fidèle, accents OK) ; génération HTTP testée sur données
  réelles (Maison à vendre, Laval, 749 000 $) → PDF 2 pages correct.

### Décisions / reste (session 14 — Module 4 à compléter)
- **Foundation livrée**, à compléter pour la perfection : **actifs réels** (logo eXp, médaille,
  photos propriété, carte statique, QR, photo courtier) via **téléversement d'images** ; calage
  fin des couleurs/espacements au modèle ; **jumeau PPTX éditable** + **aller-retour** (`docs/09`,
  python-pptx) ; wizard de saisie brochure ; autres formats marketing (Kijiji, FB, IG, X, carrousel).
- Données manquantes pour une brochure complète (dims pièce-par-pièce, garages/rangement,
  services) → à terme un **formulaire brochure** dédié (le bundle ne les couvre pas tous).

---

## Session 13 — Module Clients (mandants) + Loi 25 (2026-06-26)

- **Page Clients** `/clients` (ex-placeholder) `web/src/pages/ClientsPage.jsx` : liste filtrable
  (type vendeur/acheteur/les deux, recherche), CRUD via modale (nom, type, personne morale,
  courriel, téléphone, notes).
- **Conformité Loi 25** : capture de **consentement explicite + horodaté** (case + finalités ;
  `consent_at` daté automatiquement à l'octroi, effacé au retrait) ; badge « Consenti / Non
  consenti » dans la liste ; note d'information dans la modale.
- **Lien propriété ↔ client (mandat)** : sélecteur de client (vendeur) dans la modale Nouvelle
  propriété (`Properties.jsx`) ; **mandant** affiché dans l'onglet Caractérisation du détail.
- i18n FR/EN (`cli.*`, `prop.client`, `d.prop.client`). Vérifs : `vite build` OK ; CRUD client +
  consentement + lien propriété testés HTTP (bundle.client résolu).

> **Restent en placeholder (prochaines fonctions du plan initial)** : Module 3 **Offre de
> services**, Module 4 **Marketing** (PDF+PPTX, `docs/09`), Module 5 **Trousse de soutien**,
> Assets courtier, et le moteur **`render/`** (HTML→PDF, partagé) — voir *Prochaines tâches*.

---

## Session 12 — Comparables : multi-sélection + suppression en lot (2026-06-26)

- **`EntityTable` : prop `selectable`** → colonne de cases à cocher, « tout sélectionner »,
  ligne surlignée (`.row-selected`), bouton **« Supprimer (N) »** dans la barre d'outils.
  Activée sur le tableau des comparables (page Évaluation).
- **Endpoint `POST /:entity/bulk-delete`** (fabrique `_crud.js`) : `{ids:[…]}` → supprime en
  lot, journalise, renvoie `{count}`. Générique (toutes entités).
- i18n FR/EN (`common.deleteN`, `common.confirmDeleteN`). Vérifs : `vite build` OK ;
  bulk-delete testé (3 → 1). Correctif inclus : sous-sol fini en case à cocher (repli UI).

---

## Session 11 — Évaluation : caractéristiques catégorielles + UX comparables (2026-06-26)

### Réalisé (retours utilisateur)
- **Caractéristiques catégorielles avec ajustements % marché** (défauts éditables) : **fondation**
  (béton/blocs/pieux/pierre), **revêtement extérieur** (brique +3 %, pierre +5 %, aluminium 0 %…),
  **type de fenêtres** (PVC/hybride/aluminium/bois), **type de planchers** (bois franc +3 %…).
  Ajustement = (% sujet − % comp) × prix vendu. Moteur `acm.js` (§5), seed `features`,
  colonnes comparables, champs sujet + comparable, **édition des % dans Paramètres**.
- **Âges fenêtres / toiture** : `age_features` (%/an du prix × écart d'âge) — champs sujet +
  comparable, % éditables.
- **Inclusions** : ajout **sauna** et **cabanon** ; **sous-sol fini** (et climatisation,
  thermopompe) en **case à cocher** (booléen via `boolean_inclusions`), pas en quantité.
- **Liens Google Maps** : adresses cliquables dans la grille d'ajustements ET la ventilation
  expliquée (`AddressLink`). **N° Centris** affiché à côté de l'adresse dans la ventilation.
- Fusion en profondeur des paramètres (`lib/acmParams.js`) pour overrides partiels des `features`
  / `age_features`. **i18n FR/EN**. **Vérifs** : `vite build` OK ; moteur testé (cladding +15 000,
  fenêtres +10 000, toiture +7 500, sauna +7 000, sous-sol +15 000 = 54 500 $) ; HTTP compute OK.

### Décisions (session 11)
- Les **matériaux** (fondation/revêtement/fenêtres/planchers) sont **saisis manuellement** sur les
  comparables (le PDF Matrix « 4 par page » ne les expose pas de façon fiable) ; pré-remplis sur
  le sujet depuis le bâtiment principal.
- % stockés en fraction (0.03) ; l'UI affiche/édite en points de % (3,0).

---

## Session 10 — Évaluation : ratios depuis stats APCIQ (PDF) + âge en % (2026-06-26)

### Réalisé (retours utilisateur)
- **Extraction des ratios APCIQ depuis le PDF de stats** (`Statistiques/…STATS_MUNGENRE…pdf`) :
  worker `server/python/acm_stats.py` (déterministe) — localise la municipalité via les
  **signets PDF** (pypdf), lit la page (pdfplumber), parse la ligne du genre par **regroupement
  des mots en colonnes selon leur position x** (gère les espaces de milliers ambigus) et renvoie
  **vs prix inscrit** et **vs évaluation**. Préfère l'agrégat municipal (avant quartiers / « Total
  pour … »), repli année précédente si aucune vente. Mapping genre → libellés Centris.
- **Fichier de stats réutilisable** : endpoints `POST /acm/stats/upload` (conservé dans
  `data/uploads`, réf. en `settings`), `GET /acm/stats/file`, `POST /acm/stats/lookup`
  ({municipality, genre}). UI dans le panneau Paramètres : **utiliser le fichier en mémoire,
  en téléverser un nouveau, ou saisir manuellement** ; bouton « Extraire pour <ville> » remplit
  les deux ratios (toujours éditables).
- **Ajustement d'âge en %** (et non $) : `age_adjustment_pct_per_year` (% du prix vendu par an
  d'écart) dans le moteur, le seed et l'UI (libellé « %/an »).
- **i18n FR/EN** (`ev.stats.*`, `ev.p.age`). **Vérifs** : `vite build` OK ; worker stats testé
  sur plusieurs municipalités/genres (Amos 0,97/1,29 ; Blainville 0,99/1,19 ; Laval, Gatineau…) ;
  upload+lookup HTTP OK ; âge % testé (10 ans × 0,5 % × 500 000 = 25 000 $).

### Décisions (session 10)
- **Parsing par position x** des mots (et non par fusion des milliers, ambiguë) : colonnes du
  tableau APCIQ à x fixes, seuil de regroupement 8 px (intra-nombre ≈0-5 px, inter-colonne ≥17 px).
- **Navigation par signets** (pypdf) pour atteindre la municipalité sans scanner 1704 pages.
- **Note** : j'avais tué le port 8787 entre des tests → « Failed to fetch » côté UI ; corrigé,
  je ne tue plus ce port pendant la session (seulement au closeout). **Relancer `npm run dev`.**

---

## Session 9 — Évaluation : calculatrice, inclusions quantifiées, import PDF Matrix (2026-06-26)

### Réalisé (retours utilisateur)
- **Import PDF Matrix « 4 par page courtier »** : worker Python `server/python/acm_matrix.py`
  (pdfplumber, déterministe) — découpe par en-tête « <prix> $ No Centris <no>(<code>) », extrait
  prix vendu/inscrit, adresse/ville, dates, JSM, année, sup. habitable/terrain, éval. foncière,
  CAC, **inclusions quantifiées** (garage (2), piscine, foyer, spa…). Endpoint
  `POST /properties/:id/comparables/import-matrix` (multer) → crée les comparables (source
  « Matrix PDF », `seller_redacted`). Bouton **« Importer PDF Matrix »** sur l'onglet Comparables.
  Testé sur l'exemple : **6 comparables** extraits (prix, superficies, éval., inclusions) → ACM OK.
  `pdfplumber`/`pypdf` ajoutés à `requirements.txt` (installés dans le venv).
- **Inclusions avec QUANTITÉS** (ex. 4 foyers, 2 piscines, garage double) : stockage `{clé:qté}`,
  moteur ACM ajuste `(qté sujet − qté comp) × prix` avec explication ; `InclusionsField`
  (champ partagé) passe de cases à des **compteurs**. Rétrocompatible (tableau de clés → qté 1).
- **Calculatrice de superficie** (bouton en haut à droite de `/evaluation`) : additionne des
  pièces (longueur × largeur) → superficie totale, **appliquée au sujet**. Déterministe.
- **i18n FR/EN** (`ev.calc.*`, `ev.import*`, `ev.inclQty`). **Vérifs** : `vite build` OK ;
  moteur quantités testé (4 vs 1 foyer → +15 000 $) ; import HTTP testé (6 comparables persistés,
  ACM attendu 1 479 670 $).

### Décisions (session 9)
- **Import Matrix = création directe** des comparables (puis édition/validation dans le tableau,
  conforme à « table extraite éditable » de `docs/12` §1) plutôt qu'un aperçu intermédiaire.
- **Extraction par regex sur le texte positionnel** (pdfplumber) : le format Matrix est régulier ;
  champs accentués parfois en mojibake (cosmétique, n'affecte pas les nombres). IA non utilisée.

---

## Session 8 — UX : saisie en ligne (dépenses) + import du rent roll (2026-06-26)

### Réalisé (retours utilisateur)
- **Édition en ligne des dépenses** : composant `InlineTable` (`components/EntityTable.jsx`) —
  cellules éditables (input/select), **rangée d'ajout direct** en bas (saisie rapide sans boîte
  de dialogue ; commit au blur de la rangée ou via Entrée / bouton +). Onglet **Dépenses** câblé
  (`ExpensesTab`), **bouton + dialogue conservé** (« Ajouter (formulaire) »).
- **Import / copier-coller du rent roll** : composant `PasteImportModal` — coller un tableau
  Excel/Sheets (TSV/CSV/`;` auto-détecté), **mapping de colonnes** (auto-rapproché par en-tête),
  aperçu, conversion nombres FR/EN. Onglet **Rent roll** câblé (`UnitsTab`) avec bouton
  « Importer / coller », **table + dialogue conservés**.
- **Endpoint bulk** : `POST /:entity/bulk` (fabrique `_crud.js`) — création en lot best-effort,
  retourne `{ created, errors, count }` (rangées invalides signalées sans tout annuler ; max 2000).
- **i18n FR/EN** (`imp.*`, `d.exp.inline*`) ; CSS cellules (`.cell-input`, `.paste-preview`).
- **Vérifs** : `vite build` OK (1654 modules) ; bulk testé (2 créées / 1 rejetée avec message).

### Décisions (session 8)
- **Deux voies d'ajout conservées** partout (dialogue ET saisie rapide) : inline pour les
  dépenses (peu de champs), import collé pour le rent roll (dizaines/centaines d'unités).
- Inputs **non contrôlés** en édition de cellule (commit au blur) → pas de perte de focus au
  refetch ; `InlineTable` réutilisable pour d'autres entités.

---

## Session 7 — BUILD Phase 3 : Module 2 (Évaluation / ACM) (2026-06-26)

### Réalisé
- **Moteur ACM déterministe** `server/src/engine/acm.js` (PUR, sans IA) : `adjustComparable()`
  produit la **ventilation explicable** d'un comparable vendu (chaque ligne : caractéristique,
  valeur sujet/comp, écart, taux, **montant = écart × taux**, sens, **explication en clair**) ;
  `computeAcm()` → **prix de vente attendu** (moyenne pondérée des prix ajustés), **prix
  d'inscription** (÷ ratio APCIQ vente/inscrit), **corroboration** par éval. foncière (alerte
  d'écart), **plafond** (expirés), **concurrence** (en vigueur), **garde-fous APCIQ** (exclusion
  hors 50-150 % du prix inscrit, prudence si < min_transactions). Conforme à `docs/12`.
- **Schéma étendu** (idempotent — `COLUMN_ADDITIONS`) : `comparables` (centris_no, sale_date,
  list_price, sold_price, livable_area, municipal_assessment, days_on_market, inclusions JSON) ;
  `properties` (municipal_assessment, assessment_year). Repos + `schema.sql` à jour.
- **Paramètres d'ajustement éditables** : seed `seeds/acm-params.seed.json` (coût constr. $/pi²,
  ajustement d'âge, % appréciation, ratios APCIQ, prix d'inclusions, seuils) + override dans
  `settings` via `lib/acmParams.js`. Endpoints `GET/PUT /acm/params`.
- **Endpoint** `POST /properties/:id/acm` : sujet dérivé de la propriété + bâtiments (ou fourni),
  comparables enregistrés, params (seed + override + override d'appel). Déterministe.
- **Page `/evaluation`** `web/src/pages/Evaluation.jsx` : sélection de propriété → **Sujet**
  (sup., année, inclusions, éval. foncière) → **Comparables** (CRUD via `EntityTable`, genres
  vendu/en vigueur/expiré, champ inclusions à cases) → **Paramètres** (panneau éditable,
  enregistrable) → **Calcul** → **Résultats** : KPI (prix attendu/fourchette, inscription,
  plafond, concurrence), corroboration éval. foncière, avertissements APCIQ, **grille
  d'ajustements ventilée** (comparables en colonnes, **bascule vue courtier / client**),
  **ventilation expliquée** par comparable, **avertissement légal « opinion ≠ évaluation »**.
- **Refactor DRY** : `EntityForm`/`EntityTable` extraits dans `web/src/components/EntityTable.jsx`
  (réutilisés par PropertyDetail et Evaluation) + champ **inclusions** (cases→tableau).
  `api.put` ajouté. **i18n FR/EN** complété (préfixe `ev.*`).
- **Vérifs** : `vite build` OK (1654 modules) ; moteur testé (ex. sujet 2400 vs comp 2640 à
  180 $/pi² = −43 200 $, exclusion outlier, pondération, corroboration, garde-fous) ; endpoints
  HTTP testés (prix attendu 484 307 $, inscription 496 725 $) ; PUT/GET params (override→reset).

### Décisions (session 7)
- **ACM = saisie manuelle des comparables d'abord** ; l'extraction PDF Matrix (`pdfplumber`) et
  les stats APCIQ sont la couche suivante — la saisie/édition manuelle est le **repli documenté**
  (`docs/12`) et reste nécessaire (validation humaine). Reporté pour livrer un cœur fonctionnel.
- **Sujet non persisté** sur la propriété pour l'ACM (dérivé/saisi à l'usage) ; **paramètres**
  persistés comme **défauts éditables** (settings), surchargeables par appel.
- **Vue client** = montants arrondis (1 000 $), sans pondérations ni comparables exclus, texte
  clair (devoir d'information LCI) ; **vue courtier** = grille complète.

### Reste / à vérifier (session 7)
- **Vérification visuelle navigateur** de `/evaluation` **non faite** : le preview s'enracine
  dans le répertoire parent `Softimmo` (hors périmètre modifiable). Build + endpoints validés ;
  à confirmer visuellement via `npm run dev` (web `:5180`).

---

## Session 6 — BUILD Phase 2 : Module 1 (Analyse de propriété) (2026-06-26)

### Réalisé
- **Moteur financier déterministe** `server/src/engine/finance.js` (PUR, sans IA) :
  `computeProfitability()` → revenus bruts potentiels (GPI) → effectifs (EGI, vacance réelle
  + taux structurel éditable) → **RNE**, puis **MRB, MRN, TGA/cap rate, $/porte, RNE/porte,
  ratio de dépenses** ; alertes de cohérence (ratio dépenses < 30 %, RNE négatif).
  `detectAreaAnomalies()` : empreinte > terrain, habitable > empreinte × étages, somme unités
  > habitable, nb bâtiments déclaré vs saisi. Défauts éditables documentés (jamais des vérités).
- **Endpoint** `GET /properties/:id/analysis` (`routes/business.js`) : `value` via `?value=`
  sinon repli sur le prix de la transaction active la plus récente ; `?vacancy=` (0..1).
  Retourne `{ value, valueSource, financials, anomalies }`.
- **Page détail** `web/src/pages/PropertyDetail.jsx` (route `/properties/:id`, lignes de la
  liste Propriétés cliquables) : **7 onglets** — Caractérisation (kv + bâtiments), Rent roll,
  Dépenses, **Rentabilité** (KPI cards + ventilation des dépenses + champs valeur/vacance +
  alertes), Transactions, Comparables (lecture seule, renvoi au module Évaluation), Rapports.
- **CRUD générique config-driven** : `EntityTable` + `EntityForm` (modals) pilotés par des
  specs de champs/colonnes par entité — DRY, miroir des fabriques repo/route côté serveur.
  Couvre bâtiments, unités, dépenses, transactions (API CRUD déjà en place).
- **Formatage** `web/src/lib/format.js` (fr-CA : `money`/`num`/`pct`/`mult`). Styles ajoutés
  (`.kpi`, `.notice`, `.crumb`, `.num`…). **i18n FR/EN** complété (préfixe `d.*`).
- **Vérifs** : `vite build` OK (1652 modules) ; endpoint testé bout-en-bout sur un triplex
  (GPI 45 840, EGI 29 040, RNE 19 200, TGA 2,75 %, MRB 15,2, $/porte 233 000) ; données de
  test supprimées (cascade).

### Décisions (session 6)
- **`value` (réf. ratios) non stockée sur la propriété** : query param + repli transaction
  active. Les ratios marché (MRB/MRN/TGA/$ porte) restent **null tant qu'aucune valeur** n'est
  fournie — pas d'invention de chiffre.
- **Comparables/Rapports en lecture seule** dans Module 1 : l'ACM (curation, ajustements) est
  construite dans le **Module 2 (Évaluation)** pour éviter le doublon.
- **CRUD piloté par config** (specs de champs) plutôt que des formulaires manuels par entité —
  cohérent avec les fabriques du socle, extensible aux futurs modules.

---

## Session 5 — ACM : grille d'ajustements explicable (2026-06-25)

- `docs/12` §2.1 ajoutée : **exigence de ventilation explicable** des ajustements pour le
  **courtier ET le client**. Chaque ligne = caractéristique, valeur sujet vs comparable,
  écart, taux/paramètre, **montant avec formule (`écart × taux`)**, sens, **explication en
  texte clair** ; total par comparable (vendu → ajusté) ; **grille de marché** (comparables
  en colonnes) ; **2 vues** (courtier complète / client simplifiée). Texte par gabarits
  (déterministe, IA optionnelle pour le style). Forme JSON de `comparables.adjustments`
  précisée. UI (§8) mise à jour. S'applique aussi aux autres données de soutien (chaque
  chiffre traçable et expliqué).

---

## Session 4 — Spec ACM (comparables, ajustements, prix) (2026-06-25)

### Réalisé
- Étude des fichiers d'exemple : **Matrix « 4 par page courtier »**
  (`Sample ACM/4_par_page_courtier_Imp_rial_8299.pdf`) et **stats APCIQ**
  (`Statistiques/pdf_fr_statistics_STATS_MUNGENRE_202605O.pdf`) — extraits via `pypdf`.
- **Spec ACM** `docs/12-acm-comparables.md` (cœur du module Évaluation, déterministe) :
  téléversement PDF Matrix → extraction (statut/prix/dates/JSM/sup./année/éval./inclusions)
  → **ajustements** des vendus (superficie × coût construction, inclusions piscine/foyer/…,
  âge, date de vente) → **prix de vente attendu** ; **prix d'inscription** par règle de 3
  sur le ratio APCIQ « prix de vente / prix inscrit » ; **éval. foncière** = corroboration
  seulement (alerte si gros écart) ; **expirés** = plafond ; **en vigueur** = concurrence ;
  données Evalo/marché/revenus = ajustements additionnels. Garde-fous APCIQ (indicatif,
  exclusions 50-150 %, prudence). Ajouts de schéma listés (`docs/12` §7).
- Références ajoutées dans `docs/10` et `docs/04` (Phase 3).

### Décisions (session 4)
- **ACM = méthode principale** du module Évaluation ; tout le reste (AVM, environnement,
  démo, revenus, éval. foncière) = **soutien/ajustements**, jamais la base du prix.
- Extraction PDF **déterministe** (pdfplumber/pypdf) ; IA en repli seulement.
- Paramètres d'ajustement = **défauts éditables** (coût constr. $/pi², prix inclusions,
  âge, % appréciation).

---

## Session 3 — Menu « Mise en marché » + specs Évaluation/Local Logic (2026-06-25)

### Réalisé
- **Réorg. du menu « Mise en marché »** (ordre chronologique d'usage) + renommages, dans
  `App.jsx` + i18n FR/EN : **Assets courtier** (nouveau, `/assets-courtier`), **Offre de
  services** (`/offres`), **Trousse démarrage** (`/trousse-demarrage`, ex-« Trousse client »),
  **Trousse marketing** (`/trousse-marketing`, ex-« Matériel marketing »). Taxonomie notée
  dans `docs/01`. Vérifié : Vite compile.
- **Spec module Évaluation** `docs/10-evaluation-module.md` (inspirée d'**Evalo.ca** +
  concurrents) : AVM marchande/locative (statistique, sans IA), indice de confiance,
  comparables, **enjeux environnementaux**, intelligence marché/démo, fourchette qualité,
  approche revenus, et **carte 3D dynamique Google Aerial View** (5000/mois gratuits ;
  `GOOGLE_MAPS_API_KEY` ajoutée à `.env.example`, 3D optionnelle + repli statique).
- **Analyse Local Logic** `docs/11-local-logic-analysis.md` : reproductible gratuitement
  ~70 % (StatCan/OSM/Données Québec/Montréal) ; verrous payants = prix de vente (MLS non
  ouvert), scoring propriétaire, score de bruit, couverture hors-Montréal. Prix LL non public
  (devis annuel ; ~100-250 $US/mois rapportés). **Reco : ne pas en dépendre ; connecteur
  Marketplace optionnel.** Tableau comparatif complet dans la doc.

### Décisions (session 3)
- Module Évaluation = **données gratuites d'abord** (StatCan/OSM/Données Québec) ; Local Logic
  et données de prix payantes = **optionnelles** (Marketplace, clé utilisateur).
- Carte 3D = **Google Aerial View** dans les quotas gratuits, optionnelle (principe coût min.).
- AVM = **modèle statistique déterministe** (pas d'IA par rapport).

---

## Session 2 — Pipeline marketing (spec) + Phase 1 Fondations (2026-06-25)

### Réalisé
- **Spécification marketing** (exigence utilisateur) : `docs/09-marketing-pipeline.md`
  (PDF + PPTX éditable jumeau, aller-retour `ingest_pptx.py`), principe « IA pour bâtir,
  pas pour exécuter » ajouté à `CLAUDE.md` §3. Réf. : pipeline Tours Gouin `_build/`
  (ReportLab + python-pptx). Sauvegardé en mémoire.
- **Phase 1 — Fondations Softimmo** :
  - **Schéma DB métier** (`server/src/db/schema.sql`) : `clients`, `properties`,
    `buildings`, `units`, `expenses`, `transactions`, `comparables`, `reports`,
    `documents` (idempotent, appliqué au boot).
  - **Fabrique de repository** `repositories/_factory.js` + 9 repos métier + barrel.
  - **Fabrique de routes CRUD** `routes/_crud.js` + `routes/business.js` (toutes les
    entités) + endpoint agrégé `GET /properties/:id/bundle` (Module 1). Montées dans
    `routes/index.js`. **Testées** (création/bundle/filtre/cascade OK).
  - **i18n FR/EN** `web/src/i18n/index.jsx` (contexte + `useI18n` + dict, défaut FR) +
    **bascule de langue** dans la topbar.
  - **Navigation par module** (App.jsx : Mandats, Analyse/Évaluation, Mise en marché,
    CRM, Plateforme) + **page Propriétés fonctionnelle** (liste/création/suppression) +
    **pages placeholder** (Clients, Évaluation, Marketing, Offres, Trousse).
  - Vérifié : Vite compile tous les nouveaux modules (200) ; backend testé ; boot OK.

### Décisions (session 2)
- DRY assumé via **fabriques** (repo + route) pour les 9 entités métier — cohérent avec
  le style du socle, extensible.
- Schémas zod **permissifs** (passthrough) pour l'instant ; durcissement (enums/types)
  plus tard sans casser les entrées.
- Page Propriétés livrée minimale fonctionnelle ; le détail multi-bâtiments / rent roll /
  rentabilité = Phase 2 (Module 1).

---

## Session 1 — Framework & socle (2026-06-25)

### Objectif
Étapes 1-3 de la méthodologie : analyse de la requête + inspection des ressources,
recherche en ligne, et mise en place du framework de développement (avec intégration du
socle d'enrichissement).

### Réalisé
- **Inspection** complète des ressources fournies (design system, offre Ubee, brochures,
  documents de présentation, outil d'enrichissement, dossiers clients référencés).
- **Recherche en ligne** (3 axes) : besoins des courtiers QC + concurrents (Cloud CMA,
  RPR, Matrix/Realist, Centris, kvCORE, marketingimmobilier.ca…) ; sources de données
  (Centris, JLR, rôle, Registre foncier, StatCan, SCHL, Données Québec, MTQ, Local
  Logic) ; specs de formats marketing ; conformité légale (LCI, OACIQ, Loi 25, Loi 96).
- **Copie intégrale** du socle d'enrichissement
  (`Backup-Enrichissement de contacts/lead-gen-code`) dans `SoftImmoDev` (hors
  node_modules/dist/db/venv).
- **Git** : `git init`, remote `https://github.com/pierrevinet281/softimmo`, branche
  `session-01-framework`.
- **CLAUDE.md** : règles impératives (périmètre fichiers, conformité, tech stack,
  conventions, boucle de session).
- **Documentation de framework** : `docs/00`→`08` (prompt de départ, vision/modules,
  architecture, catalogue de fonctionnalités, plan d'action, dev-process, conformité,
  specs marketing, résultats de recherche). Docs héritées déplacées sous `docs/enrichment/`.
- **Re-branding** socle → Softimmo : package.json (root/server/web), README, index.html,
  vite (SOFTIMMO_API_PORT), config.js (DB `softimmo.db`, UA), App.jsx (marque, thème),
  `.env.example`.
- **LAST_SESSION.md** (ce fichier).
- Vérification de démarrage (install + boot) : voir statut ci-dessous.

### Décisions
- **UI bilingue FR/EN** (défaut FR), bascule. i18n à câbler en Phase 1.
- **Remote Git** : `https://github.com/pierrevinet281/softimmo` ; workflow branche → PR →
  squash merge → ff main.
- **IA via API Anthropic** (clé `ANTHROPIC_API_KEY` à fournir, stockée localement) ;
  recherche web par workers Python + Google CSE optionnel ; repli heuristique.
- Le **socle d'enrichissement EST l'app** : son infrastructure (shell, DB, jobs,
  settings, IA, workers) sert tous les modules ; l'enrichissement devient le Module 6.
- **Renommage du slug `leadgen`** fait **progressivement** (DB path/UA/packages déjà
  faits ; env var, schéma interne → Phase 8) pour éviter une migration risquée d'un coup.
- **Module 4 (marketing) — exigence ajoutée par l'utilisateur** : sortie **PDF + PPTX
  éditable (jumeau fidèle)** avec bouton **« Mise à jour »** aller-retour (PPTX modifié →
  script Python → met à jour PDF + données). **Déterministe, sans IA au runtime** (l'IA
  sert à bâtir, pas à exécuter) ; wizards, formulaires, upload d'images. Pipeline de
  référence (lecture seule) : Tours Gouin `…\Publicités\_build\` (ReportLab + python-pptx).
  Conception consignée dans `docs/09-marketing-pipeline.md`. Principe global ajouté à
  `CLAUDE.md` §3.

### Statut de démarrage — VALIDÉ ✔ (bout-en-bout)
- `npm install` OK (exit 0).
- `npm run setup:python` : le script npm inline était **cassé sous Windows** (espaces du
  chemin Google Drive + slashes via cmd). **Corrigé** : remplacé par
  `scripts/setup-python.mjs` (Node, multiplateforme, robuste aux espaces). venv créé,
  dépendances installées (`requests, bs4, lxml, dns, phonenumbers` importent OK).
- `migrate` + `seed --demo` OK → `data/softimmo.db` (110 réfs, 58 fournisseurs, démo).
- Serveur démarré : **API sur :8787**, file de jobs active. `/api/health` → `ok:true`,
  **pont Python fonctionnel** (`+14165550142`), `ai:false` (aucune clé, attendu).
  `/api/stats` renvoie les données démo.
- Reste à faire (rapide, session 2) : `npm run dev` + vérif visuelle de l'UI dans le
  navigateur (light/dark) — le backend et le pont Python sont déjà confirmés.

---

## Prochaines tâches — suite Module 2 (Évaluation) puis Module 3
> Le **cœur ACM est livré** (session 7). Étapes suivantes (déterministe d'abord) :
1. **Vérif visuelle `/evaluation`** (rapide) : `npm run dev`, créer une propriété + 3-4
   comparables vendus, lancer le calcul, contrôler la grille (vues courtier/client) et les
   avertissements. Corriger au besoin.
2. **Extraction PDF Matrix « 4 par page courtier »** (`docs/12` §1) : worker Python
   `pdfplumber`/`pypdf` → table de comparables **éditable** avant calcul ; provenance
   « importé Matrix PDF ». Repli regex/IA optionnel. Dépendances à ajouter à `requirements`.
3. **Stats APCIQ** (`docs/12` §3) : téléversement/saisie des ratios (vente/inscrit,
   vente/éval.) + JSM + prix moyen/médian ; table `market_stats` pour traçabilité.
4. **Méthodes coût & revenu + réconciliation** pondérée justifiée (réutiliser
   `engine/finance.js` : RNE ÷ TGA pour la capitalisation directe). Profils par type.
5. **Moteur `render/`** (HTML→PDF) avec en-têtes/pieds de conformité (mentions, avertissement
   « opinion ≠ évaluation », **caviardage vendeur** des comparables) — **partagé Modules 2-5** ;
   première sortie = opinion de valeur + annexe sources + sommaire exécutif.
6. Puis **Module 3 (Offre de services)** : générateur vendeur/acheteur (`docs/03` §3).

## Restes Module 1 (à reprendre quand utile)
- **Import assisté** depuis fiches Centris / extraits / rôle (workers extract + mapping).
- **Téléversement de fichiers** pour les rapports d'expertise (champ `file_path`).
- Étude de trafic (DJMA via MTQ/Données Québec) pour commercial/terrain.

## Tâches reportées
- Moteur `render/` (partagé Modules 2-5).
- Durcissement des schémas zod (enums/types) des entités métier.
- Renommage final du slug `leadgen` (Phase 8).

## Rappels
- Seul `SoftImmoDev` est modifiable. Conformité légale non négociable (voir `CLAUDE.md`).
- Closeout à chaque fin de session (`docs/05-dev-process.md`).
