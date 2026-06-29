# -*- coding: utf-8 -*-
"""Slots granulaires de la brochure standard — aller-retour PowerPoint PAR ÉLÉMENT (docs/09).

Espace PowerPoint 540×720 pt (origine HAUT-gauche) — **source de vérité unique** des boîtes par
défaut, partagée par le moteur PDF (`render_brochure.py`) et le jumeau PPTX
(`render_brochure_pptx.py`) pour qu'ils restent au point près, ainsi que par l'ingest
(`ingest_pptx.py`, `pptx_to_layout.py`).

Modèle (calqué sur la brochure RPA, voir `ingest_rpa_brochure_pptx.py`) :
- `STD::<slot>`  = forme dont le TEXTE est éditable (relu dans le contenu) **et** la position.
- `STDp::<slot>` = forme dont seule la POSITION est suivie (images, filets, barres, cellules de
  grille, lignes du courtier dont le texte vient du profil).

Chaque slot a une boîte PAR DÉFAUT calculée ici à partir de la mise en page de régions
(`brochure_layout.DEFAULT_LAYOUT`, surchargeable). Si l'aller-retour a capté une position pour ce
slot (`layout[slot]`), elle remplace la boîte par défaut ; les deux moteurs appliquent la même
règle (`ovr`). Déterministe, sans IA (CLAUDE.md §3).
"""
import copy

EMU_PT = 12700  # 1 pt = 12700 EMU

# Clés de contenu éditables relues du PPTX (doivent rester alignées sur CONTENT_FIELDS, business.js).
CONTENT_KEYS = {
    "title", "city", "summary_line", "address", "mls", "price_text", "headline", "description",
}
# Slots d'images dont le remplacement dans le PPTX est rapatrié.
PIC_SLOTS = ("hero", "map", "broker_photo", "photo.0", "photo.1", "photo.2")


# ───────────────────────── Boîtes par défaut (décomposition des blocs) ─────────────────────────
def title_lines(L, key="title_block"):
    """Bloc titre → 3 lignes individuelles (titre / ville / résumé)."""
    x, y, w, h = L[key]
    return {
        "title":        [x, y + 1,  w, 24],
        "city":         [x, y + 26, w, 16],
        "summary_line": [x, y + 43, w, 16],
    }


def address_lines(L):
    """Bloc adresse → adresse + MLS."""
    x, y, w, h = L["address_block"]
    return {
        "address": [x, y + 12, w, 26],
        "mls":     [x, y + 40, w, 16],
    }


def broker_lines(L):
    """Bloc coordonnées courtier (page 1) → 5 lignes (texte issu du profil : POSITION seule)."""
    x, y, w, h = L["broker_text"]
    return {
        "broker.name":     [x, y + 1,  w, 18],
        "broker.title":    [x, y + 21, w, 13],
        "broker.subtitle": [x, y + 33, w, 13],
        "broker.agency":   [x, y + 45, w, 13],
        "broker.phone":    [x, y + 57, w, 13],
    }


def broker2_lines(L):
    """Bloc coordonnées courtier (pied page 2) → 5 lignes (POSITION seule)."""
    x, y, w, h = L["broker2_text"]
    return {
        "broker2.name":    [x, y + 1,  w, 16],
        "broker2.titles":  [x, y + 19, w, 12],
        "broker2.agency":  [x, y + 31, w, 12],
        "broker2.contact": [x, y + 43, w, 12],
        "broker2.web":     [x, y + 55, w, 12],
    }


def grid_cell(L, i, ci, kind):
    """Cellule de grille i (rangée), ci (colonne 0/1), kind 'label'|'value' → boîte."""
    g = L["grid"]
    ry = g["row0_y"] + i * g["pitch"]
    col = g["cols"][ci]  # [label_x, label_w, value_x, value_w]
    if kind == "label":
        return [col[0], ry, col[1], g["h"]]
    return [col[2], ry, col[3], g["h"]]


def grid_slot(i, ci, kind):
    return "grid.%d.%d.%s" % (i, ci, kind)


# ───────────────────────────── Override (les DEUX moteurs) ─────────────────────────────
def ovr(layout, slot, x, y, w, h):
    """Boîte PPTX (haut-gauche) du slot : override capté (`layout[slot]`) sinon valeur par défaut."""
    b = layout.get(slot) if isinstance(layout, dict) else None
    if isinstance(b, (list, tuple)) and len(b) == 4:
        return float(b[0]), float(b[1]), float(b[2]), float(b[3])
    return x, y, w, h


# ───────────────────────────── Ingest (PPTX édité → contenu + layout) ─────────────────────────────
def _walk(shapes):
    """Itère récursivement (groupes inclus) sur toutes les formes."""
    for sh in shapes:
        yield sh
        try:
            if sh.shape_type == 6:  # GROUP
                yield from _walk(sh.shapes)
        except Exception:  # noqa: BLE001
            pass


def _box(sh):
    try:
        return [round(float(sh.left) / EMU_PT, 2), round(float(sh.top) / EMU_PT, 2),
                round(float(sh.width) / EMU_PT, 2), round(float(sh.height) / EMU_PT, 2)]
    except Exception:  # noqa: BLE001
        return None


def _text(sh):
    """Texte d'une forme (paragraphes non vides joints), ou None."""
    try:
        if not sh.has_text_frame:
            return None
    except Exception:  # noqa: BLE001
        return None
    lines = [("".join(r.text for r in p.runs)) for p in sh.text_frame.paragraphs]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def _table_rooms(sh):
    """Tableau des pièces → liste de [pièce, étage, dimension] (en-tête ignoré)."""
    try:
        if not sh.has_table:
            return None
    except Exception:  # noqa: BLE001
        return None
    t = sh.table
    ncol = min(3, len(t.columns))
    rows = []
    for r in range(1, len(t.rows)):
        cells = [t.cell(r, c).text.strip() for c in range(ncol)]
        if any(cells):
            rows.append(cells)
    return rows or None


def _apply_content(content, slot, value):
    """Affecte la valeur de texte d'un slot éditable au contenu (clés plates connues)."""
    if slot == "mls":
        m = value.strip()
        if ":" in m and m.lower().startswith("mls"):
            m = m.split(":", 1)[1].strip()
        content["mls"] = m
    elif slot in CONTENT_KEYS:
        content[slot] = value.strip() if slot in ("title", "city", "address") else value


def _save_pic(sh, dest_base, images_dir, placeholder_bytes):
    """Image réellement remplacée (≠ réserve) → fichier ; renvoie le chemin ou None."""
    try:
        img = sh.image
    except Exception:  # noqa: BLE001
        return None
    if not img.blob or img.blob == placeholder_bytes:
        return None
    import os
    ext = (img.ext or "png").lstrip(".")
    os.makedirs(images_dir, exist_ok=True)
    dest = os.path.join(images_dir, "%s.%s" % (dest_base, ext))
    with open(dest, "wb") as f:
        f.write(img.blob)
    return dest


def extract_slots(prs, images_dir=None, placeholder_bytes=b""):
    """Relit un PPTX (jumeau standard édité) → (content, layout).

    `content` : surcharges de texte/images (clés plates + rooms + images/interior/broker_photo).
    `layout`  : { slot: [x, y, w, h] } en pt PPTX (haut-gauche) pour CHAQUE forme STD::/STDp::.
    """
    content = {}
    layout = {}
    pics = {}
    for slide in prs.slides:
        for sh in _walk(slide.shapes):
            name = getattr(sh, "name", "") or ""
            if name.startswith("STD::"):
                slot = name[len("STD::"):]
                if slot == "table":
                    rooms = _table_rooms(sh)
                    if rooms:
                        content["rooms"] = rooms
                else:
                    t = _text(sh)
                    if t not in (None, ""):
                        _apply_content(content, slot, t)
            elif name.startswith("STDp::"):
                slot = name[len("STDp::"):]
            else:
                continue
            if not slot:
                continue
            b = _box(sh)
            if b:
                layout[slot] = b
            if images_dir and slot in PIC_SLOTS:
                saved = _save_pic(sh, slot.replace(".", "_"), images_dir, placeholder_bytes)
                if saved:
                    pics[slot] = saved

    if pics:
        imgs = {}
        if pics.get("hero"):
            imgs["hero"] = pics["hero"]
        if pics.get("map"):
            imgs["map"] = pics["map"]
        if imgs:
            content["images"] = imgs
        if pics.get("broker_photo"):
            content["broker_photo"] = pics["broker_photo"]
        interior = [pics.get("photo.0"), pics.get("photo.1"), pics.get("photo.2")]
        if any(interior):
            content["interior"] = interior  # positionnel : [chemin|null, …]
    return content, layout
