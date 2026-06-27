# -*- coding: utf-8 -*-
"""Mise en page des brochures — pilotée par données (round-trip PowerPoint, docs/09).

Les positions vivent ICI (espace PowerPoint 540×720 pt = 7,5×10 po). Le moteur PDF
(`render_brochure.py`) et le jumeau PPTX (`render_brochure_pptx.py`) lisent tous deux
`load_layout(template)`. Un gabarit PowerPoint édité par le courtier peut **écraser** ces
positions via `layouts/<template>.json` (généré par `pptx_to_layout.py`) — sans toucher au code.

`NAME_MAP` relie chaque rôle de mise en page au **nom de forme** stable dans le gabarit
PowerPoint, ce qui permet la ré-extraction après édition.
"""
import os
import json
import copy

LAYOUTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "layouts")

# ── Mise en page par défaut (extraite des gabarits de référence) ──
# Boîtes = [x, y, largeur, hauteur] en points PowerPoint (origine haut-gauche).
DEFAULT_LAYOUT = {
    # ----- Page 1 -----
    "banner": [19.84, 16.76, 500.31, 82.49],
    "logo": [33.75, 30.38, 84.39, 53.79],
    "title": [132.04, 24.56, 282.0, 65.43],
    "hero": [19.84, 110.54, 299.94, 224.96],
    "map": [328.0, 110.54, 192.16, 224.96],
    "medal": [387.34, 12.14, 146.72, 144.13],
    "address": [26.72, 328.76, 486.41, 71.18],
    "rule": [19.58, 392.9, 500.69, 0.0],
    "grid": {
        "row0_y": 413.43, "pitch": 29.7, "h": 24.13,
        "cols": [[31.69, 136.89, 175.06, 87.15], [277.16, 136.89, 421.22, 86.45]],
    },
    "price": [279.04, 608.5, 241.11, 71.18],
    "broker_photo": [43.03, 605.0, 59.31, 60.29],
    "broker_text": [106.85, 605.0, 172.2, 67.86],
    "bottom_bar": [33.75, 678.0, 486.41, 2.6],
    # Verrou luxe (titre or à gauche, verrou à droite) — propre au thème luxe.
    "luxe_title": [33.75, 24.56, 282.0, 65.43],
    "luxe_lock": [350.0, 38.0, 150.0, 42.0],
    # ----- Page 2 -----
    "p2_title": [19.84, 20.82, 500.31, 24.72],
    "desc": [19.84, 50.57, 500.31, 169.32],
    "photos": [
        [20.14, 228.58, 161.0, 131.9],
        [189.25, 228.58, 160.7, 131.9],
        [358.36, 228.58, 162.1, 131.9],
    ],
    "table": [20.07, 368.48, 500.31, 216.0],
    "hero2": [19.84, 589.52, 192.82, 109.66],
    "broker2_text": [213.58, 621.56, 226.18, 63.01],
    "qr": [422.0, 604.83, 100.46, 100.46],
}

# Rôle de mise en page → nom de forme dans le gabarit PowerPoint (pour la ré-extraction).
# Les lignes (filets) sont des connecteurs ; les cellules de grille proviennent des groupes.
NAME_MAP = {
    "banner": "Rectangle 7",
    "logo": "Image 8",
    "title": "ZoneTexte 21",
    "hero": "Image 9",
    "map": "Image 20",
    "medal": "Image 26",
    "address": "Rectangle 47",
    "rule": "Connecteur droit 99",
    "price": "Rectangle 40",
    "broker_photo": "Image 119",
    "broker_text": "ZoneTexte 46",
    "bottom_bar": "Connecteur droit 102",
    # Grille : 1re cellule de chaque colonne (+ 2e rangée pour le pas).
    "grid_c1_label": "Rectangle 84", "grid_c1_value": "Rectangle 79",
    "grid_c2_label": "Rectangle 48", "grid_c2_value": "Rectangle 49",
    "grid_c2_label_r1": "Rectangle 50",
    # Page 2.
    "p2_title": "Rectangle 20",
    "desc": "Rectangle 64",
    "table": "Tableau 43",
    "hero2": "Image 61",
    "broker2_text": "ZoneTexte 1",
    "qr": "Image 45",
    "photo1": "Image 11", "photo2": "Image 12", "photo3": "Image 14",
}


def _deep_merge(base, override):
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_layout(template):
    """Mise en page par défaut, écrasée par layouts/<template>.json si présent."""
    layout = copy.deepcopy(DEFAULT_LAYOUT)
    path = os.path.join(LAYOUTS_DIR, "%s.json" % (template or "unifamilial"))
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                layout = _deep_merge(layout, json.load(f))
        except Exception:  # noqa: BLE001 — JSON invalide → on garde les valeurs par défaut
            pass
    return layout
