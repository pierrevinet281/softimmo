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


# ───────────────────────────── Page 1 ─────────────────────────────
# Positions issues du gabarit PowerPoint (espace 540×720), projetées en Lettre via pbox().
def _luxe_header(c, d, th, title):
    """Bannière luxe : titre or à gauche + verrou logo « eXp · COLLECTION DE LUXE » à droite."""
    img = d.get("images", {})
    tx = PX(33.75); tw = PSc(282.0)
    draw_fit(c, title, tx, PY(44), tw, F_BOLD, pfont(20), th["title_fg"], min_size=12)
    draw_fit(c, d.get("city", ""), tx, PY(62), tw, F_REG, pfont(12), th["sub_fg"], min_size=8)
    draw_fit(c, d.get("summary_line", ""), tx, PY(79), tw, F_REG, pfont(12), th["sub_fg"], min_size=8)
    logo = img.get("logo") or th.get("logo_default")
    if logo and os.path.exists(logo):
        # Verrou aligné à droite avec une marge intérieure (bord droit à pptx 500, pas 520).
        lim = _load(logo, rgb=False); dw = PSc(150); dh = dw * (lim.size[1] / lim.size[0])
        c.drawImage(ImageReader(lim), PX(500.0) - dw, PY(58) - dh / 2, dw, dh, mask="auto")
    else:
        c.setFillColor(LX_GOLD); c.setFont(F_REG, pfont(17))
        c.drawRightString(PX(520.15), PY(52), "COLLECTION"); c.drawRightString(PX(520.15), PY(72), "DE LUXE")


def page1(c, d, th):
    img = d.get("images", {}); broker = d.get("broker", {})
    title = d.get("title", "")
    if th["title_upper"]:
        title = title.upper()

    # Bannière (Rectangle 7)
    c.setFillColor(th["banner_bg"]); c.rect(*pbox(19.84, 16.76, 500.31, 82.49), fill=1, stroke=0)

    if th["banner"] == "luxe":
        _luxe_header(c, d, th, title)
    else:
        # Logo eXp (Image 8) — ajusté par hauteur, aspect préservé, ancré sur la boîte PPTX.
        logo = img.get("logo") or th.get("logo_default")
        lx, ly, lw0, lh = pbox(33.75, 30.38, 84.39, 53.79)
        if logo and os.path.exists(logo):
            lim = _trim_alpha(_load(logo, rgb=False))
            c.drawImage(ImageReader(lim), lx, ly, lh * (lim.size[0] / lim.size[1]), lh, mask="auto")
        # Titre / ville / résumé (ZoneTexte 21)
        tx = PX(132.04); tw = PSc(282.0)
        draw_fit(c, title, tx, PY(42), tw, F_BOLD, pfont(20), th["title_fg"], min_size=12)
        draw_fit(c, d.get("city", ""), tx, PY(61), tw, F_REG, pfont(12), th["sub_fg"], min_size=8)
        draw_fit(c, d.get("summary_line", ""), tx, PY(78), tw, F_REG, pfont(12), th["sub_fg"], min_size=8)

    # Photo (Image 9) + carte (Image 20) — contour noir fin.
    draw_image(c, img.get("hero"), *pbox(19.84, 110.54, 299.94, 224.96), border=0.8)
    draw_image(c, img.get("map"), *pbox(328.0, 110.54, 192.16, 224.96), border=0.8)

    # Médaille (badge Image 26 + rubans Image 36) — son sommet déborde au-dessus de la bannière.
    if th["banner"] == "medal":
        medal = img.get("medal") or th.get("medal_default")
        mx = PX(387.34); mw = PSc(146.72)
        if medal and os.path.exists(medal):
            mim = _load(medal, rgb=False)
            dh = mw * (mim.size[1] / mim.size[0])
            c.drawImage(ImageReader(mim), mx, PY(12.14) - dh, mw, dh, mask="auto")

    # Adresse + MLS (Rectangle 47) + filet (Connecteur 99)
    draw_fit(c, d.get("address", ""), PX(26.72), PY(356), PSc(486.41), F_BOLD, pfont(16), INK, min_size=11)
    if d.get("mls"):
        draw_fit(c, "MLS : %s" % d["mls"], PX(26.72), PY(374), PSc(486.41), F_REG, pfont(11), INK2, min_size=8)
    c.setStrokeColor(th["rule"]); c.setLineWidth(2.2)
    c.line(PX(19.58), PY(392.9), PX(19.58 + 500.69), PY(392.9))

    # Grille de spécifications — colonnes/rangées issues du PPTX (Rectangles 48-88).
    ch = 24.13
    rows_y = [413.43 + i * 29.7 for i in range(5)]
    cols = [(31.69, 136.89, 175.06, 87.15), (277.16, 136.89, 421.22, 86.45)]
    left = d.get("specs_left", []); right = d.get("specs_right", [])

    def cell(px, pw, ry, text, fill, fg):
        x, y, w, h = pbox(px, ry, pw, ch)
        c.setFillColor(fill); c.rect(x, y, w, h, fill=1, stroke=0)
        draw_fit(c, text, x + 10, y + h / 2 - pfont(12) * 0.34, w - 18, F_REG, pfont(12), fg, min_size=7.5)

    for i, ry in enumerate(rows_y):
        for col, specs in zip(cols, (left, right)):
            if i < len(specs):
                lab = specs[i][0]; val = "" if specs[i][1] is None else str(specs[i][1])
                cell(col[0], col[1], ry, lab, th["label_bg"], th["label_fg"])
                cell(col[2], col[3], ry, val, th["value_bg"], th["value_fg"])

    # Bloc prix (Rectangle 40 / ZoneTexte 96)
    px_, py_, pw_, ph_ = pbox(279.04, 608.5, 241.11, 71.18)
    c.setFillColor(th["price_bg"]); c.rect(px_, py_, pw_, ph_, fill=1, stroke=0)
    price = d.get("price")
    ptxt = ("Prix : %s $" % format(int(price), ",d").replace(",", " ")) if price else "Prix sur demande"
    draw_fit(c, ptxt, px_ + pw_ / 2, py_ + ph_ / 2 - pfont(28) * 0.34, pw_ - 20, F_BOLD, pfont(28),
             th["price_fg"], align="c", min_size=14)

    # Courtier : photo (Image 119) + bloc texte (ZoneTexte 46)
    bphoto = broker.get("photo") or asset("broker", "portrait.png")
    draw_image(c, bphoto, *pbox(43.03, 605.0, 59.31, 60.29))
    btx = PX(106.85); btw = PSc(172.2)
    draw_fit(c, broker.get("name", ""), btx, PY(620), btw, F_BOLD, pfont(15), INK, min_size=10)
    yb = 634
    for ln in [broker.get("title", ""), broker.get("subtitle", ""), broker.get("agency", "")]:
        if ln:
            draw_fit(c, ln, btx, PY(yb), btw, F_REG, pfont(9.5), INK2, min_size=7); yb += 11.5
    if broker.get("phone"):
        draw_fit(c, "T : %s" % broker["phone"], btx, PY(yb), btw, F_BOLD, pfont(9.5), INK, min_size=7)

    # Barre rouge de pied (Connecteur 102) + mention de conformité centrée.
    c.setFillColor(th["bar"]); c.rect(*pbox(33.75, 678, 486.41, 2.6), fill=1, stroke=0)
    _compliance_footer(c, d)


# ───────────────────────────── Page 2 ─────────────────────────────
ROOM_COLS = [0.46, 0.27, 0.27]  # largeurs relatives : Pièce / Étage / Dimension
TBL_X, TBL_W = 20.07, 500.31    # Tableau 43 (coords PPTX)


def _table_header(c, th, yp, hhp, cwp):
    """En-tête du tableau (coords PPTX, top→bas) ; renvoie le yp sous l'en-tête."""
    c.setFillColor(th["th_bg"]); c.rect(*pbox(TBL_X, yp, TBL_W, hhp), fill=1, stroke=0)
    xs = TBL_X
    for i, htxt in enumerate(["Pièce", "Étage", "Dimension"]):
        x, y, w, h = pbox(xs, yp, cwp[i], hhp)
        draw_fit(c, htxt, x + 10, y + h / 2 - pfont(11) * 0.34, w - 18, F_SB, pfont(11), th["th_fg"], min_size=8)
        xs += cwp[i]
    return yp + hhp


def _table_rows(c, th, rows, yp, rhp, cwp, start_index=0):
    """Rangées du tableau à partir de yp (PPTX) ; `start_index` préserve l'alternance des couleurs."""
    for ri, room in enumerate(rows):
        c.setFillColor(th["row_alt"] if (start_index + ri) % 2 else th["row"])
        c.rect(*pbox(TBL_X, yp, TBL_W, rhp), fill=1, stroke=0)
        xs = TBL_X
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
    rooms = d.get("rooms", [])

    # Bandeau titre (Rectangle 20)
    bx, by, bw, bhh = pbox(19.84, 20.82, 500.31, 24.72)
    c.setFillColor(th["p2_banner_bg"]); c.rect(bx, by, bw, bhh, fill=1, stroke=0)
    draw_fit(c, d.get("headline", d.get("title", "")), PX(32.67), by + bhh / 2 - pfont(16) * 0.34,
             PSc(475), F_BOLD, pfont(16), th["p2_title_fg"], min_size=11)

    # Description (Rectangle 64 ; texte cadré dans Rectangle 54)
    if d.get("description"):
        c.setFillColor(th["desc_bg"]); c.rect(*pbox(19.84, 50.57, 500.31, 169.32), fill=1, stroke=0)
        tx, ty, tw, thh = pbox(32.67, 51.06, 475.33, 168.84)
        para_fit(c, d["description"], tx, ty + thh, tw, thh, F_REG, pfont(12), INK,
                 leading_ratio=1.34, align=TA_JUSTIFY, min_size=8)

    # 3 photos (Groupe 15) — contour noir fin
    photos = [(20.14, 161.0), (189.25, 160.7), (358.36, 162.1)]
    interior = (d.get("interior", []) + [None, None, None])
    for (px, pw), p in zip(photos, interior):
        draw_image(c, p, *pbox(px, 228.58, pw, 131.9), border=0.8)

    # Tableau des pièces (Tableau 43 : zone fixe 368.48→585) — rangées comprimées ; 3e page si trop.
    cwp = [c0 * TBL_W for c0 in ROOM_COLS]
    TBL_TOP, TBL_BOT, HHP, PAGE_BOT = 368.48, 585.0, 24.0, 700.0
    if not rooms:
        _page2_footer(c, d, th); return
    n = len(rooms); avail = (TBL_BOT - TBL_TOP) - HHP
    if n * 15 <= avail:                          # tient sur la page 2 (rangées comprimées au besoin)
        rhp = min(26.0, avail / n)
        yh = _table_header(c, th, TBL_TOP, HHP, cwp)
        _table_rows(c, th, rooms, yh, rhp, cwp, 0)
        _page2_footer(c, d, th); return
    # Débordement : page 2 remplie sans pied ; suite + pied en page(s) suivante(s).
    rhp = 24.0
    yh = _table_header(c, th, TBL_TOP, HHP, cwp)
    k = max(1, int((PAGE_BOT - yh) / rhp))
    _table_rows(c, th, rooms[:k], yh, rhp, cwp, 0); idx = k
    footer_drawn = False
    while idx < n:
        c.showPage(); yh = _table_header(c, th, 40.0, HHP, cwp)
        if (n - idx) <= int((TBL_BOT - yh) / rhp):
            _table_rows(c, th, rooms[idx:], yh, rhp, cwp, idx); idx = n
            _page2_footer(c, d, th); footer_drawn = True
        else:
            k = max(1, int((PAGE_BOT - yh) / rhp))
            _table_rows(c, th, rooms[idx:idx + k], yh, rhp, cwp, idx); idx += k
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
    hx, hy, hw, hh = pbox(19.84, 589.52, 192.82, 109.66)
    if hero and os.path.exists(hero) and Image is not None:
        him = _trim_alpha(_load(hero, rgb=False))
        dw = hh * (him.size[0] / him.size[1])
        c.drawImage(ImageReader(him), hx, hy, dw, hh, mask="auto")

    # Bloc coordonnées du courtier (ZoneTexte 1)
    btx = PX(213.58); btw = PSc(226.18)
    draw_fit(c, broker.get("name", ""), btx, PY(633), btw, F_BOLD, pfont(13), INK, min_size=9)
    title_line = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
    if title_line:
        draw_fit(c, title_line, btx, PY(645), btw, F_BOLD, pfont(9), INK, min_size=6.5)
    agency = broker.get("agency", "")
    if broker.get("company"):
        agency = (agency + " | " + broker["company"]) if agency else broker["company"]
    if agency:
        draw_fit(c, agency, btx, PY(656), btw, F_REG, pfont(9), INK2, min_size=6.5)
    contact = []
    if broker.get("phone"):
        contact.append("T : %s" % broker["phone"])
    if broker.get("email"):
        contact.append("E : %s" % broker["email"])
    if contact:
        draw_fit(c, "  |  ".join(contact), btx, PY(667), btw, F_REG, pfont(9), INK2, min_size=6.5)
    web = broker.get("web") or broker.get("website")
    if web:
        draw_fit(c, "W : %s" % web, btx, PY(678), btw, F_REG, pfont(9), INK2, min_size=6.5)

    # QR code (Image 45) — encode l'URL de la fiche / du site du courtier.
    qr_url = d.get("listing_url") or broker.get("web") or broker.get("website")
    if qr_url and not str(qr_url).startswith(("http://", "https://")):
        qr_url = "https://" + str(qr_url)
    if qr_url:
        qx, qy, qw, qh = pbox(422.0, 604.83, 100.46, 100.46)
        draw_qr(c, qr_url, qx, qy, qw, dark=th.get("qr_color", RED))
        ref = d.get("brochure_ref") or (("MLS %s" % d["mls"]) if d.get("mls") else "")
        if ref:
            draw_fit(c, ref, qx + qw / 2, PY(712), qw + 24, F_REG, 7, INK2, align="c", min_size=5)


def render(data, out):
    th = THEMES.get(data.get("template") or "unifamilial", THEMES["unifamilial"])
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
