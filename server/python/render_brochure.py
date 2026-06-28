# -*- coding: utf-8 -*-
"""Moteur render/ — brochure immobilière (PDF qualité professionnelle, ReportLab).

Déterministe, sans IA (CLAUDE.md §3). Reproduit la mise en page de la brochure unifamiliale
de référence (eXp / Pierre Vinet) : bannière, photo + carte, grille de spécifications, bloc
prix, coordonnées du courtier ; page 2 : description, photos, tableau des pièces, pied.

E/S : lit {"data": {...}, "out": "<chemin.pdf>"} sur stdin, écrit le PDF et renvoie {"path"}.
Les images manquantes sont remplacées par des cadres neutres (la mise en page reste visible).
Conformité : mentions agence + courtier en pied (LCI/OACIQ).
"""
import sys
import os
import io
import json

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

from brochure_layout import load_layout
from brochure_slots import (
    ovr, title_lines, address_lines, broker_lines, broker2_lines, grid_cell, grid_slot,
)

# Mise en page courante (positions PPTX), peuplée par render() — voir brochure_layout.py.
# Contient les boîtes de RÉGIONS (DEFAULT_LAYOUT) + tout override de POSITION par slot capté à
# l'aller-retour (brochure_slots.extract_slots) ; lu identiquement par le jumeau PPTX.
LAYOUT = {}

try:
    from PIL import Image, ImageDraw, ImageOps
except Exception:  # noqa: BLE001
    Image = None


def _load(path, rgb=True):
    """Ouvre une image en corrigeant l'orientation EXIF (photos de téléphone)."""
    im = Image.open(path)
    try:
        im = ImageOps.exif_transpose(im)  # redresse selon l'orientation EXIF
    except Exception:  # noqa: BLE001
        pass
    return im.convert("RGB") if rgb else im


def _trim_alpha(im):
    """Rogne la marge transparente (bbox du canal alpha) — pour un placement précis des logos."""
    try:
        if im.mode in ("RGBA", "LA"):
            bb = im.getchannel("A").getbbox()
            if bb:
                return im.crop(bb)
    except Exception:  # noqa: BLE001
        pass
    return im

PW, PH = letter  # 612 x 792 pt

# ── Palette (approx. de la brochure de référence ; éditable) ──
BLUE = HexColor("#314897")     # bannière + boîtes (libellés, en-tête de tableau)
BLUE_LABEL = HexColor("#314897")  # cellules-libellés de la grille
VAL = HexColor("#D7DEEE")      # cellules-valeurs (gris-bleu clair)
RED = HexColor("#E2231A")      # bloc prix / barres
INK = HexColor("#1A1A1A")
INK2 = HexColor("#5A5A5A")
WHITE = HexColor("#FFFFFF")
LINE = HexColor("#314897")
PH_BG = HexColor("#E9EDF3")    # placeholder image

# Palette luxe (noir + or + crème)
LX_BLACK = HexColor("#221F1C")
LX_GOLD = HexColor("#B79A5B")
LX_GOLD_D = HexColor("#9C8246")
LX_CREAM = HexColor("#F2EDE2")

WF = "C:/Windows/Fonts"
# Actifs embarqués (logos, héros) livrés avec l'app.
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
def asset(*p):
    return os.path.join(ASSETS, *p)


def _reg(name, *candidates):
    for p in candidates:
        if p and os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont(name, p))
                return True
            except Exception:  # noqa: BLE001
                pass
    return False


# Polices : Segoe UI (Windows) si présentes, repli sur Helvetica intégré.
F_REG = "Sg" if _reg("Sg", os.path.join(WF, "segoeui.ttf")) else "Helvetica"
F_BOLD = "Sg-B" if _reg("Sg-B", os.path.join(WF, "segoeuib.ttf")) else "Helvetica-Bold"
F_SB = "Sg-SB" if _reg("Sg-SB", os.path.join(WF, "seguisb.ttf")) else F_BOLD


# Marge extérieure (haut/gauche/droite/bas) — rien ne touche le bord (sécurité d'impression).
MO = 30

# Cadre fixe du héros de pied (page 2/3) — identique pour tous les modèles (cf. _page2_footer).
HERO_W, HERO_H = 196, 200

def T(y):
    """Coordonnée 'depuis le haut' (sous la marge supérieure) → coordonnée ReportLab (du bas)."""
    return PH - MO - y


# ── Transform : gabarit PowerPoint (540×720 pt = 7,5×10 po) → page Lettre (612×792 pt) ──
# Échelle UNIFORME (les carrés restent carrés) qui remplit la largeur ; léger recentrage
# vertical. Toutes les positions des brochures sont définies dans l'espace PowerPoint
# (cf. extract_pptx_layout.py) puis projetées ici — c'est le socle du « round-trip » PPTX.
PPTX_W, PPTX_H = 540.0, 720.0
# Échelle ajustée à la HAUTEUR (la page Lettre est plus haute en ratio) : la mise en page
# remplit toute la hauteur sans rien rogner en bas (pied page 2), avec de fines marges
# latérales centrées (~9 pt). Échelle uniforme → les carrés restent carrés.
PSCALE = PH / PPTX_H   # = 1,1
HSHIFT = (PW - PPTX_W * PSCALE) / 2.0   # ≈ 9 : centrage horizontal


def PX(x):
    return x * PSCALE + HSHIFT


def PSc(v):
    return v * PSCALE


def PY(y):
    """y pptx (depuis le haut) → y ReportLab du BORD HAUT de l'élément."""
    return PH - y * PSCALE


def pbox(x, y, w, h):
    """Boîte pptx (coin haut-gauche) → (x, y, w, h) ReportLab (coin bas-gauche)."""
    return PX(x), PY(y) - PSc(h), PSc(w), PSc(h)


def pfont(sz):
    return sz * PSCALE


def _cover(img, tw, th):
    w, h = img.size
    ta, a = tw / th, w / h
    if a > ta:
        nw = int(h * ta); x = (w - nw) // 2; box = (x, 0, x + nw, h)
    else:
        nh = int(w / ta); y = (h - nh) // 2; box = (0, y, w, y + nh)
    return img.crop(box).resize((tw, th), Image.LANCZOS)


def draw_image(c, path, x, y, w, h, radius=0, dpi=200, border=0, border_color=None):
    """Dessine une image (cover-crop, coins arrondis optionnels) + contour optionnel.
    Placeholder si absente. `border` = épaisseur du contour (pt), `border_color` sa couleur."""
    def _stroke():
        if border:
            c.setStrokeColor(border_color or HexColor("#000000")); c.setLineWidth(border)
            if radius > 0:
                c.roundRect(x, y, w, h, radius, fill=0, stroke=1)
            else:
                c.rect(x, y, w, h, fill=0, stroke=1)

    if not path or not os.path.exists(path) or Image is None:
        c.setFillColor(PH_BG)
        (c.roundRect(x, y, w, h, radius, fill=1, stroke=0) if radius > 0 else c.rect(x, y, w, h, fill=1, stroke=0))
        c.setFillColor(INK2); c.setFont(F_REG, 8)
        c.drawCentredString(x + w / 2, y + h / 2, "image")
        _stroke()
        return
    tw, th = max(2, int(w / 72 * dpi)), max(2, int(h / 72 * dpi))
    im = _cover(_load(path), tw, th)
    if radius > 0:
        r = int(radius / 72 * dpi)
        mask = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=r, fill=255)
        out = Image.new("RGB", (tw, th), (255, 255, 255)); out.paste(im, (0, 0), mask); im = out
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=88); buf.seek(0)
    c.drawImage(ImageReader(buf), x, y, w, h, mask="auto")
    _stroke()


def draw_qr(c, data_str, x, y, size, dark=INK):
    """Dessine un QR code (déterministe, via le widget intégré ReportLab — aucune dépendance).
    `data_str` = URL encodée ; `size` = côté en pt ; `dark` = couleur des modules."""
    if not data_str:
        return
    w = qr.QrCodeWidget(str(data_str))
    w.barFillColor = dark
    b = w.getBounds()
    bw, bh = (b[2] - b[0]) or 1, (b[3] - b[1]) or 1
    dr = Drawing(size, size, transform=[size / bw, 0, 0, size / bh, -b[0] * size / bw, -b[1] * size / bh])
    dr.add(w)
    renderPDF.draw(dr, c, x, y)


def para(c, text, x, y_top, w, font, size, color, leading=None, align=TA_LEFT):
    style = ParagraphStyle("s", fontName=font, fontSize=size, textColor=color,
                           leading=leading or size * 1.32, alignment=align)
    p = Paragraph(text, style); _, h = p.wrap(w, 100000); p.drawOn(c, x, y_top - h)
    return h


# ─────────── Auto-ajustement du texte (garantie ZÉRO débordement) ───────────
def fit_size(c, text, max_w, font, size, min_size=6):
    """Réduit la taille de police jusqu'à ce que `text` tienne dans max_w (une ligne)."""
    s = size
    while s > min_size and c.stringWidth(text, font, s) > max_w:
        s -= 0.5
    return s


def _ellipsize(c, text, max_w, font, size):
    """Tronque avec « … » si le texte dépasse encore à la taille minimale."""
    if c.stringWidth(text, font, size) <= max_w:
        return text
    ell = "…"
    while text and c.stringWidth(text + ell, font, size) > max_w:
        text = text[:-1]
    return (text + ell) if text else ell


def draw_fit(c, text, x, y, max_w, font, size, color, align="l", min_size=6):
    """Dessine une ligne qui NE déborde JAMAIS : on rétrécit puis, en dernier recours, on tronque."""
    text = "" if text is None else str(text)
    if not text:
        return
    s = fit_size(c, text, max_w, font, size, min_size)
    if c.stringWidth(text, font, s) > max_w:
        text = _ellipsize(c, text, max_w, font, s)
    c.setFont(font, s); c.setFillColor(color)
    if align == "c":
        c.drawCentredString(x, y, text)
    elif align == "r":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)
    return s


def para_fit(c, text, x, y_top, w, h, font, size, color, leading_ratio=1.32, align=TA_LEFT, min_size=7):
    """Paragraphe multi-lignes qui tient dans une boîte (w × h) : réduit la police jusqu'à
    rentrer en hauteur. Renvoie la hauteur réellement occupée (≤ h)."""
    s = size
    while s >= min_size:
        style = ParagraphStyle("s", fontName=font, fontSize=s, textColor=color,
                               leading=s * leading_ratio, alignment=align)
        p = Paragraph(text, style); _, ph = p.wrap(w, 100000)
        if ph <= h or s <= min_size:
            p.drawOn(c, x, y_top - ph)
            return ph
        s -= 0.5
    return h


# ── Dessin par SLOT (override de position appliqué — miroir du jumeau PPTX) ──
def _line(c, slot, box, text, font, size_pt, color, align="l", padx=0.0, min_size=6):
    """Ligne de texte centrée verticalement dans la boîte PPTX `box` (override `LAYOUT[slot]`)."""
    text = "" if text is None else str(text)
    if not text:
        return
    rx, ry, rw, rh = pbox(*ovr(LAYOUT, slot, *box))
    base = ry + rh / 2 - pfont(size_pt) * 0.34
    pad = PSc(padx)
    if align == "c":
        draw_fit(c, text, rx + rw / 2, base, rw - 2 * pad, font, pfont(size_pt), color, align="c", min_size=min_size)
    elif align == "r":
        draw_fit(c, text, rx + rw - pad, base, rw - 2 * pad, font, pfont(size_pt), color, align="r", min_size=min_size)
    else:
        draw_fit(c, text, rx + pad, base, rw - 2 * pad, font, pfont(size_pt), color, align="l", min_size=min_size)


def _cell(c, slot, box, text, fill, fg, size=12):
    """Cellule de grille : rectangle plein + texte aligné à gauche (override `LAYOUT[slot]`)."""
    rx, ry, rw, rh = pbox(*ovr(LAYOUT, slot, *box))
    c.setFillColor(fill); c.rect(rx, ry, rw, rh, fill=1, stroke=0)
    draw_fit(c, text, rx + 10, ry + rh / 2 - pfont(size) * 0.34, rw - 18, F_REG, pfont(size), fg, min_size=7.5)


# ───────────────────────────── Thèmes (par modèle de brochure) ─────────────────────────────
THEMES = {
    "unifamilial": {
        "banner": "medal", "banner_bg": BLUE, "title_fg": WHITE, "title_upper": False, "sub_fg": WHITE,
        "label_bg": BLUE_LABEL, "label_fg": WHITE, "value_bg": VAL, "value_fg": INK,
        "rule": LINE, "price_bg": RED, "price_fg": WHITE, "bar": RED, "qr_color": RED,
        "p2_banner_bg": RED, "p2_title_fg": WHITE, "desc_bg": HexColor("#C6D1E6"),
        "th_bg": BLUE, "th_fg": WHITE, "row_alt": VAL, "row": HexColor("#EEF1F7"), "row_fg": INK,
        # Actifs : logo eXp (bannière), médaille « Propriété Sélectionnée », héros « SuperPierre » (bas p.2).
        "logo_default": asset("unifamilial", "exp_logo_white.png"),
        "medal_default": asset("unifamilial", "certificat.png"),
        "hero_default": asset("unifamilial", "superpierre.png"),
    },
    "luxe": {
        "banner": "luxe", "banner_bg": LX_BLACK, "title_fg": LX_GOLD, "title_upper": True, "sub_fg": WHITE,
        "label_bg": LX_GOLD, "label_fg": WHITE, "value_bg": LX_CREAM, "value_fg": INK,
        "rule": LX_GOLD, "price_bg": LX_BLACK, "price_fg": WHITE, "bar": LX_GOLD, "qr_color": LX_GOLD_D,
        "p2_banner_bg": LX_GOLD_D, "p2_title_fg": WHITE, "desc_bg": LX_CREAM,
        "th_bg": LX_GOLD_D, "th_fg": WHITE, "row_alt": LX_CREAM, "row": HexColor("#F7F3EA"), "row_fg": INK,
        # Actifs de marque eXp Luxury (verrou « eXp · COLLECTION DE LUXE » + héros courtier).
        "logo_default": asset("luxe", "exp_luxury_white.png"),
        "hero_default": asset("luxe", "superpierre_luxury.png"),
    },
}


def _theme(banner_bg, price, *, p2=None, desc="#E8EDEF", value="#DDE3E6"):
    """Construit un thème « bannière simple » (logo + titre, sans médaille) — RPA/commercial/industriel.
    Couleurs par défaut éditables ; la disposition reste celle du modèle unifamilial."""
    bb = HexColor(banner_bg); pr = HexColor(price); p2c = HexColor(p2 or banner_bg)
    return {
        "banner": "medal", "banner_bg": bb, "title_fg": WHITE, "title_upper": False, "sub_fg": WHITE,
        "label_bg": bb, "label_fg": WHITE, "value_bg": HexColor(value), "value_fg": INK,
        "rule": bb, "price_bg": pr, "price_fg": WHITE, "bar": pr, "qr_color": pr,
        "p2_banner_bg": p2c, "p2_title_fg": WHITE, "desc_bg": HexColor(desc),
        "th_bg": bb, "th_fg": WHITE, "row_alt": HexColor(value), "row": HexColor("#F1F4F5"), "row_fg": INK,
        "logo_default": asset("unifamilial", "exp_logo_white.png"),
        "hero_default": asset("unifamilial", "superpierre.png"),
    }


THEMES["rpa"] = _theme("#2E6E5E", "#C25E3A", desc="#DCE9E5", value="#DCE9E5")          # résidence aînés (vert/terracotta)
THEMES["commercial"] = _theme("#243B53", "#C0392B", desc="#DCE2EC", value="#DCE2EC")    # corporatif (marine/rouge)
THEMES["industriel"] = _theme("#37474F", "#E07B2C", desc="#E0E4E6", value="#E0E4E6")    # industriel (acier/orange)


# ───────────────────────────── Page 1 ─────────────────────────────
# Positions issues du gabarit PowerPoint (espace 540×720), projetées en Lettre via pbox().
def _luxe_header(c, d, th, title):
    """Bannière luxe : titre or à gauche + verrou logo « eXp · COLLECTION DE LUXE » à droite."""
    img = d.get("images", {})
    tl = title_lines(LAYOUT, key="luxe_title")
    _line(c, "title", tl["title"], title, F_BOLD, 20, th["title_fg"], min_size=12)
    _line(c, "city", tl["city"], d.get("city", ""), F_REG, 12, th["sub_fg"], min_size=8)
    _line(c, "summary_line", tl["summary_line"], d.get("summary_line", ""), F_REG, 12, th["sub_fg"], min_size=8)
    logo = img.get("logo") or th.get("logo_default")
    lkx, lky, lkw, lkh = ovr(LAYOUT, "luxe_lock", *LAYOUT["luxe_lock"])
    if logo and os.path.exists(logo):
        # Verrou aligné à droite de sa boîte (marge intérieure incluse dans la boîte).
        lim = _load(logo, rgb=False); dw = PSc(lkw); dh = dw * (lim.size[1] / lim.size[0])
        c.drawImage(ImageReader(lim), PX(lkx + lkw) - dw, PY(lky + lkh / 2) - dh / 2, dw, dh, mask="auto")
    else:
        c.setFillColor(LX_GOLD); c.setFont(F_REG, pfont(17))
        c.drawRightString(PX(lkx + lkw), PY(lky + 6), "COLLECTION"); c.drawRightString(PX(lkx + lkw), PY(lky + 26), "DE LUXE")


def page1(c, d, th):
    L = LAYOUT
    img = d.get("images", {}); broker = d.get("broker", {})
    title = d.get("title", "")
    if th["title_upper"]:
        title = title.upper()

    bx, by, bw, bh = pbox(*ovr(L, "banner", *L["banner"]))  # bannière
    c.setFillColor(th["banner_bg"]); c.rect(bx, by, bw, bh, fill=1, stroke=0)

    if th["banner"] == "luxe":
        _luxe_header(c, d, th, title)
    else:
        logo = img.get("logo") or th.get("logo_default")  # logo eXp (ajusté par hauteur)
        lx, ly, lw0, lh = pbox(*ovr(L, "logo", *L["logo"]))
        if logo and os.path.exists(logo):
            lim = _trim_alpha(_load(logo, rgb=False))
            c.drawImage(ImageReader(lim), lx, ly, lh * (lim.size[0] / lim.size[1]), lh, mask="auto")
        tl = title_lines(L)  # titre / ville / résumé (lignes individuelles, déplaçables)
        _line(c, "title", tl["title"], title, F_BOLD, 20, th["title_fg"], min_size=12)
        _line(c, "city", tl["city"], d.get("city", ""), F_REG, 12, th["sub_fg"], min_size=8)
        _line(c, "summary_line", tl["summary_line"], d.get("summary_line", ""), F_REG, 12, th["sub_fg"], min_size=8)

    draw_image(c, img.get("hero"), *pbox(*ovr(L, "hero", *L["hero"])), border=0.8)  # photo + carte
    draw_image(c, img.get("map"), *pbox(*ovr(L, "map", *L["map"])), border=0.8)

    if th["banner"] == "medal":  # médaille (sommet débordant la bannière)
        medal = img.get("medal") or th.get("medal_default")
        mbx, mby, mbw, mbh = ovr(L, "medal", *L["medal"]); mx = PX(mbx); mw = PSc(mbw)
        if medal and os.path.exists(medal):
            mim = _load(medal, rgb=False); dh = mw * (mim.size[1] / mim.size[0])
            c.drawImage(ImageReader(mim), mx, PY(mby) - dh, mw, dh, mask="auto")

    al = address_lines(L)  # adresse + MLS (lignes individuelles) + filet
    _line(c, "address", al["address"], d.get("address", ""), F_BOLD, 16, INK, min_size=11)
    if d.get("mls"):
        _line(c, "mls", al["mls"], "MLS : %s" % d["mls"], F_REG, 11, INK2, min_size=8)
    rlx, rly, rlw, rlh = ovr(L, "rule", *L["rule"])
    c.setStrokeColor(th["rule"]); c.setLineWidth(2.2); c.line(PX(rlx), PY(rly), PX(rlx + rlw), PY(rly))

    left = d.get("specs_left", []); right = d.get("specs_right", [])  # grille (chaque cellule = slot)
    for i in range(5):
        for ci, specs in enumerate((left, right)):
            if i < len(specs):
                lab = specs[i][0]; val = "" if specs[i][1] is None else str(specs[i][1])
                _cell(c, grid_slot(i, ci, "label"), grid_cell(L, i, ci, "label"), lab, th["label_bg"], th["label_fg"])
                _cell(c, grid_slot(i, ci, "value"), grid_cell(L, i, ci, "value"), val, th["value_bg"], th["value_fg"])

    px_, py_, pw_, ph_ = pbox(*ovr(L, "price_text", *L["price"]))  # bloc prix (texte éditable)
    c.setFillColor(th["price_bg"]); c.rect(px_, py_, pw_, ph_, fill=1, stroke=0)
    price = d.get("price")
    ptxt = d.get("price_text") or (("Prix : %s $" % format(int(price), ",d").replace(",", " ")) if price else "Prix sur demande")
    draw_fit(c, ptxt, px_ + pw_ / 2, py_ + ph_ / 2 - pfont(28) * 0.34, pw_ - 20, F_BOLD, pfont(28),
             th["price_fg"], align="c", min_size=14)

    bphoto = broker.get("photo") or asset("broker", "portrait.png")  # courtier (photo + 5 lignes)
    draw_image(c, bphoto, *pbox(*ovr(L, "broker_photo", *L["broker_photo"])))
    bl = broker_lines(L)
    _line(c, "broker.name", bl["broker.name"], broker.get("name", ""), F_BOLD, 15, INK, min_size=10)
    for key, txt, fnt, col in [
        ("broker.title", broker.get("title", ""), F_REG, INK2),
        ("broker.subtitle", broker.get("subtitle", ""), F_REG, INK2),
        ("broker.agency", broker.get("agency", ""), F_REG, INK2),
        ("broker.phone", ("T : %s" % broker["phone"]) if broker.get("phone") else "", F_BOLD, INK),
    ]:
        _line(c, key, bl[key], txt, fnt, 9.5, col, min_size=7)

    c.setFillColor(th["bar"]); c.rect(*pbox(*ovr(L, "bottom_bar", *L["bottom_bar"])), fill=1, stroke=0)  # barre
    _compliance_footer(c, d)


# ───────────────────────────── Page 2 ─────────────────────────────
ROOM_COLS = [0.46, 0.27, 0.27]  # largeurs relatives : Pièce / Étage / Dimension


def _table_header(c, th, yp, hhp, cwp, tx0, tw0):
    """En-tête du tableau (coords PPTX, top→bas) ; renvoie le yp sous l'en-tête."""
    c.setFillColor(th["th_bg"]); c.rect(*pbox(tx0, yp, tw0, hhp), fill=1, stroke=0)
    xs = tx0
    for i, htxt in enumerate(["Pièce", "Étage", "Dimension"]):
        x, y, w, h = pbox(xs, yp, cwp[i], hhp)
        draw_fit(c, htxt, x + 10, y + h / 2 - pfont(11) * 0.34, w - 18, F_SB, pfont(11), th["th_fg"], min_size=8)
        xs += cwp[i]
    return yp + hhp


def _table_rows(c, th, rows, yp, rhp, cwp, tx0, tw0, start_index=0):
    """Rangées du tableau à partir de yp (PPTX) ; `start_index` préserve l'alternance des couleurs."""
    for ri, room in enumerate(rows):
        c.setFillColor(th["row_alt"] if (start_index + ri) % 2 else th["row"])
        c.rect(*pbox(tx0, yp, tw0, rhp), fill=1, stroke=0)
        xs = tx0
        for i in range(3):
            v = str(room[i]) if i < len(room) and room[i] is not None else ""
            x, y, w, h = pbox(xs, yp, cwp[i], rhp)
            draw_fit(c, v, x + 10, y + h / 2 - pfont(10) * 0.34, w - 18, F_REG, pfont(10), th["row_fg"], min_size=7.5)
            xs += cwp[i]
        yp += rhp
    return yp


def page2(c, d, th):
    """Page 2 (+ page(s) de suite si trop de pièces). Positions issues du gabarit PowerPoint.
    Le nombre de pièces est dynamique : les rangées sont comprimées dans la zone fixe du tableau ;
    si même comprimées elles ne tiennent pas, les pièces restantes + le pied passent en page 3."""
    L = LAYOUT
    rooms = d.get("rooms", [])

    bx, by, bw, bhh = pbox(*ovr(L, "headline", *L["p2_title"]))  # bandeau titre (texte éditable)
    c.setFillColor(th["p2_banner_bg"]); c.rect(bx, by, bw, bhh, fill=1, stroke=0)
    draw_fit(c, d.get("headline", d.get("title", "")), bx + PSc(13), by + bhh / 2 - pfont(16) * 0.34,
             bw - PSc(26), F_BOLD, pfont(16), th["p2_title_fg"], min_size=11)

    if d.get("description"):  # description (boîte + texte cadré avec retrait)
        dbx, dby, dbw, dbh = ovr(L, "description", *L["desc"])
        c.setFillColor(th["desc_bg"]); c.rect(*pbox(dbx, dby, dbw, dbh), fill=1, stroke=0)
        tx, ty, tw, thh = pbox(dbx + 12.8, dby + 0.5, dbw - 25, dbh - 0.5)
        para_fit(c, d["description"], tx, ty + thh, tw, thh, F_REG, pfont(12), INK,
                 leading_ratio=1.34, align=TA_JUSTIFY, min_size=8)

    interior = (d.get("interior", []) + [None, None, None])  # 3 photos (contour noir fin)
    for idx2 in range(3):
        box = ovr(L, "photo.%d" % idx2, *L["photos"][idx2])
        draw_image(c, interior[idx2], *pbox(*box), border=0.8)

    # Tableau des pièces (zone fixe) — rangées comprimées ; page de suite si trop nombreuses.
    tbx, tby, tbw, tbh = ovr(L, "table", *L["table"])
    cwp = [c0 * tbw for c0 in ROOM_COLS]
    TBL_TOP, TBL_BOT, HHP, PAGE_BOT = tby, tby + tbh, 24.0, PPTX_H - 20.0
    if not rooms:
        _page2_footer(c, d, th); return
    n = len(rooms); avail = (TBL_BOT - TBL_TOP) - HHP
    if n * 15 <= avail:                          # tient sur la page 2 (rangées comprimées au besoin)
        rhp = min(26.0, avail / n)
        yh = _table_header(c, th, TBL_TOP, HHP, cwp, tbx, tbw)
        _table_rows(c, th, rooms, yh, rhp, cwp, tbx, tbw, 0)
        _page2_footer(c, d, th); return
    # Débordement : page 2 remplie sans pied ; suite + pied en page(s) suivante(s).
    rhp = 24.0
    yh = _table_header(c, th, TBL_TOP, HHP, cwp, tbx, tbw)
    k = max(1, int((PAGE_BOT - yh) / rhp))
    _table_rows(c, th, rooms[:k], yh, rhp, cwp, tbx, tbw, 0); idx = k
    footer_drawn = False
    while idx < n:
        c.showPage(); yh = _table_header(c, th, 40.0, HHP, cwp, tbx, tbw)
        if (n - idx) <= int((TBL_BOT - yh) / rhp):
            _table_rows(c, th, rooms[idx:], yh, rhp, cwp, tbx, tbw, idx); idx = n
            _page2_footer(c, d, th); footer_drawn = True
        else:
            k = max(1, int((PAGE_BOT - yh) / rhp))
            _table_rows(c, th, rooms[idx:idx + k], yh, rhp, cwp, tbx, tbw, idx); idx += k
    if not footer_drawn:
        c.showPage(); _page2_footer(c, d, th)


def _compliance_footer(c, d):
    """Mention centrée en pied (agence + courtier). LCI/OACIQ. Utilisée en page 1."""
    broker = d.get("broker", {})
    bits = [broker.get("name"), broker.get("agency"), broker.get("phone")]
    draw_fit(c, "  ·  ".join([b for b in bits if b]), PW / 2, 14, PW - 80, F_REG, 7, INK2, align="c", min_size=5)


def _page2_footer(c, d, th):
    """Pied page 2/3 (positions PPTX) : héros (Image 61, gauche) + coordonnées (ZoneTexte 1)
    + QR (Image 45, droite). Satisfait aussi les mentions LCI/OACIQ (courtier + agence)."""
    broker = d.get("broker", {})
    img = d.get("images", {}) or {}

    # Héros « SuperPierre » : ajusté par hauteur (aspect préservé), ancré au coin bas-gauche de
    # la boîte PPTX — même hauteur et même position pour tous les modèles (unifamilial, luxe…).
    hero = img.get("brand_hero") or th.get("hero_default")
    hx, hy, hw, hh = pbox(*ovr(LAYOUT, "hero2", *LAYOUT["hero2"]))
    if hero and os.path.exists(hero) and Image is not None:
        him = _trim_alpha(_load(hero, rgb=False))
        dw = hh * (him.size[0] / him.size[1])
        c.drawImage(ImageReader(him), hx, hy, dw, hh, mask="auto")

    # Bloc coordonnées du courtier (5 lignes individuelles, déplaçables ; texte issu du profil)
    bl = broker2_lines(LAYOUT)
    _line(c, "broker2.name", bl["broker2.name"], broker.get("name", ""), F_BOLD, 13, INK, min_size=9)
    title_line = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
    if title_line:
        _line(c, "broker2.titles", bl["broker2.titles"], title_line, F_BOLD, 9, INK, min_size=6.5)
    agency = broker.get("agency", "")
    if broker.get("company"):
        agency = (agency + " | " + broker["company"]) if agency else broker["company"]
    if agency:
        _line(c, "broker2.agency", bl["broker2.agency"], agency, F_REG, 9, INK2, min_size=6.5)
    contact = []
    if broker.get("phone"):
        contact.append("T : %s" % broker["phone"])
    if broker.get("email"):
        contact.append("E : %s" % broker["email"])
    if contact:
        _line(c, "broker2.contact", bl["broker2.contact"], "  |  ".join(contact), F_REG, 9, INK2, min_size=6.5)
    web = broker.get("web") or broker.get("website")
    if web:
        _line(c, "broker2.web", bl["broker2.web"], "W : %s" % web, F_REG, 9, INK2, min_size=6.5)

    # QR code — encode l'URL de la fiche / du site du courtier.
    qr_url = d.get("listing_url") or broker.get("web") or broker.get("website")
    if qr_url and not str(qr_url).startswith(("http://", "https://")):
        qr_url = "https://" + str(qr_url)
    if qr_url:
        qbx, qby, qbw, qbh = ovr(LAYOUT, "qr", *LAYOUT["qr"])
        qx, qy, qw, qh = pbox(qbx, qby, qbw, qbw)
        draw_qr(c, qr_url, qx, qy, qw, dark=th.get("qr_color", RED))
        ref = d.get("brochure_ref") or (("MLS %s" % d["mls"]) if d.get("mls") else "")
        if ref:
            rfx, rfy, rfw, rfh = pbox(*ovr(LAYOUT, "brochure_ref", qbx - 10, qby + qbw + 1, qbw + 20, 12))
            draw_fit(c, ref, rfx + rfw / 2, rfy + rfh / 2 - 7 * 0.34, rfw, F_REG, 7, INK2, align="c", min_size=5)


def render(data, out):
    global LAYOUT
    tpl = data.get("template") or "unifamilial"
    LAYOUT = load_layout(tpl, override=data.get("layout"))  # surcharge propriété éventuelle
    th = THEMES.get(tpl, THEMES["unifamilial"])
    c = canvas.Canvas(out, pagesize=letter)
    page1(c, data, th); c.showPage()
    page2(c, data, th); c.showPage()
    c.save()
    return out


def main():
    try:
        raw = sys.stdin.buffer.read().decode("utf-8") or "{}"  # forcer UTF-8 (accents)
        payload = json.loads(raw)
        data = payload.get("data") or {}
        out = payload.get("out")
        if not out:
            print(json.dumps({"error": "out requis"})); return
        render(data, out)
        print(json.dumps({"path": out}))
    except Exception as e:  # noqa: BLE001
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()[-500:]}))


if __name__ == "__main__":
    main()
