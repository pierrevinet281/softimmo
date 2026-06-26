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

PW, PH = letter  # 612 x 792 pt

# ── Palette (approx. de la brochure de référence ; éditable) ──
BLUE = HexColor("#1C4E8F")     # bannière
BLUE_LABEL = HexColor("#3360A6")  # cellules-libellés de la grille
VAL = HexColor("#D7DEEE")      # cellules-valeurs (gris-bleu clair)
RED = HexColor("#E2231A")      # bloc prix / barres
INK = HexColor("#1A1A1A")
INK2 = HexColor("#5A5A5A")
WHITE = HexColor("#FFFFFF")
LINE = HexColor("#1C4E8F")
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


def T(y):
    """Convertit une coordonnée 'depuis le haut' en coordonnée ReportLab (depuis le bas)."""
    return PH - y


def _cover(img, tw, th):
    w, h = img.size
    ta, a = tw / th, w / h
    if a > ta:
        nw = int(h * ta); x = (w - nw) // 2; box = (x, 0, x + nw, h)
    else:
        nh = int(w / ta); y = (h - nh) // 2; box = (0, y, w, y + nh)
    return img.crop(box).resize((tw, th), Image.LANCZOS)


def draw_image(c, path, x, y, w, h, radius=0, dpi=200):
    """Dessine une image (cover-crop, coins arrondis optionnels). Placeholder si absente."""
    if not path or not os.path.exists(path) or Image is None:
        c.setFillColor(PH_BG); c.roundRect(x, y, w, h, radius or 1, fill=1, stroke=0)
        c.setFillColor(INK2); c.setFont(F_REG, 8)
        c.drawCentredString(x + w / 2, y + h / 2, "image")
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
        "rule": LINE, "price_bg": RED, "price_fg": WHITE, "bar": RED,
        "p2_banner_bg": RED, "p2_title_fg": WHITE, "desc_bg": HexColor("#E9EDF3"),
        "th_bg": BLUE, "th_fg": WHITE, "row_alt": VAL, "row": HexColor("#EEF1F7"), "row_fg": INK,
        # Actifs : logo eXp (bannière), médaille « Propriété Sélectionnée », héros « SuperPierre » (bas p.2).
        "logo_default": asset("unifamilial", "exp_logo_white.png"),
        "medal_default": asset("unifamilial", "certificat.png"),
        "hero_default": asset("unifamilial", "superpierre.png"),
    },
    "luxe": {
        "banner": "luxe", "banner_bg": LX_BLACK, "title_fg": LX_GOLD, "title_upper": True, "sub_fg": WHITE,
        "label_bg": LX_GOLD, "label_fg": WHITE, "value_bg": LX_CREAM, "value_fg": INK,
        "rule": LX_GOLD, "price_bg": LX_BLACK, "price_fg": WHITE, "bar": LX_GOLD,
        "p2_banner_bg": LX_GOLD_D, "p2_title_fg": WHITE, "desc_bg": LX_CREAM,
        "th_bg": LX_GOLD_D, "th_fg": WHITE, "row_alt": LX_CREAM, "row": HexColor("#F7F3EA"), "row_fg": INK,
        # Actifs de marque eXp Luxury (verrou « eXp · COLLECTION DE LUXE » + héros courtier).
        "logo_default": asset("luxe", "exp_luxury_white.png"),
        "hero_default": asset("luxe", "superpierre_luxury.png"),
    },
}


# ───────────────────────────── Page 1 ─────────────────────────────
def page1(c, d, th):
    M = 36
    img = d.get("images", {})
    broker = d.get("broker", {})

    # Bannière (variante selon le thème)
    bh = 96
    c.setFillColor(th["banner_bg"]); c.rect(0, T(bh), PW, bh, fill=1, stroke=0)
    title = d.get("title", "")
    if th["title_upper"]:
        title = title.upper()

    if th["banner"] == "luxe":
        # Titre or à gauche ; verrou logo « eXp · COLLECTION DE LUXE » à droite (pas de médaille).
        tx = M
        title_w = PW / 2 + 10 - tx
        draw_fit(c, title, tx, T(40), title_w, F_BOLD, 24, th["title_fg"], min_size=14)
        draw_fit(c, d.get("city", ""), tx, T(60), title_w, F_REG, 12, th["sub_fg"], min_size=9)
        draw_fit(c, d.get("summary_line", ""), tx, T(78), title_w, F_REG, 12, th["sub_fg"], min_size=9)
        logo = img.get("logo") or th.get("logo_default")
        if logo and os.path.exists(logo):
            lw = 250; lh = lw / 3.69  # ratio du verrou (≈3.69)
            c.drawImage(ImageReader(_load(logo, rgb=False)), PW - M - lw, T(bh / 2 + lh / 2), lw, lh, mask="auto")
        else:
            c.setFillColor(LX_GOLD); c.setFont(F_REG, 17)
            c.drawRightString(PW - M, T(46), "COLLECTION"); c.drawRightString(PW - M, T(66), "DE LUXE")
    else:
        logo = img.get("logo") or th.get("logo_default")
        if logo and os.path.exists(logo):
            lim = _load(logo, rgb=False)
            lw = 140; lh = lw / (lim.size[0] / lim.size[1])  # aspect préservé (pas de recadrage)
            c.drawImage(ImageReader(lim), M, T(bh) + (bh - lh) / 2, lw, lh, mask="auto")
        else:
            c.setFillColor(WHITE); c.setFont(F_BOLD, 30); c.drawString(M, T(bh) + 36, "eXp")
            c.setFont(F_REG, 9); c.drawString(M, T(bh) + 22, "AGENCE IMMOBILIÈRE")
        tx = M + 175
        title_w = PW - M - 112 - tx  # largeur dispo jusqu'à la médaille
        draw_fit(c, title, tx, T(34), title_w, F_BOLD, 24, th["title_fg"], min_size=15)
        draw_fit(c, d.get("city", ""), tx, T(54), title_w, F_REG, 13, th["sub_fg"], min_size=9)
        draw_fit(c, d.get("summary_line", ""), tx, T(74), title_w, F_REG, 13, th["sub_fg"], min_size=9)
        # Médaille « Propriété Sélectionnée » (image si dispo, sinon dessin de repli).
        medal = img.get("medal") or th.get("medal_default")
        if medal and os.path.exists(medal):
            ms = 104
            c.drawImage(ImageReader(_load(medal, rgb=False)), PW - M - ms, T(bh) - 22, ms, ms, mask="auto")
        else:
            mx, my = PW - M - 44, T(48)
            c.setFillColor(HexColor("#0F2E5C")); c.circle(mx, my, 40, fill=1, stroke=0)
            c.setStrokeColor(HexColor("#C9A24B")); c.setLineWidth(3); c.circle(mx, my, 40, fill=0, stroke=1)
            c.setFillColor(WHITE); c.setFont(F_SB, 7.5)
            c.drawCentredString(mx, my + 3, "Propriété"); c.drawCentredString(mx, my - 7, "Sélectionnée")

    # Images : photo (gauche) + carte (droite)
    iy_top = bh + 14; iw_h = 200
    gap = 12; lw = (PW - 2 * M - gap) * 0.56; rw = (PW - 2 * M - gap) - lw
    draw_image(c, img.get("hero"), M, T(iy_top + iw_h), lw, iw_h, radius=4)
    draw_image(c, img.get("map"), M + lw + gap, T(iy_top + iw_h), rw, iw_h, radius=4)

    # Adresse + MLS + filet
    ay = iy_top + iw_h + 30
    draw_fit(c, d.get("address", ""), M, T(ay), PW - 2 * M, F_BOLD, 16, INK, min_size=11)
    if d.get("mls"):
        draw_fit(c, "MLS : %s" % d["mls"], M, T(ay + 18), PW - 2 * M, F_REG, 11, INK2, min_size=8)
    c.setStrokeColor(th["rule"]); c.setLineWidth(2.5); c.line(M, T(ay + 30), PW - M, T(ay + 30))

    # Grille de spécifications (2 colonnes de paires libellé/valeur)
    gy = ay + 48
    left = d.get("specs_left", []); right = d.get("specs_right", [])
    rows = max(len(left), len(right)); rh = 28; rgap = 6
    colw = (PW - 2 * M - 24) / 2  # 2 demi-largeurs (chaque = libellé + valeur)
    lab_w = colw * 0.52; val_w = colw - lab_w

    def cell(x, yt, pair):
        if not pair:
            return
        label, value = pair[0], str(pair[1]) if pair[1] is not None else ""
        ty = T(yt + rh) + rh / 2 - 4
        c.setFillColor(th["label_bg"]); c.rect(x, T(yt + rh), lab_w - 4, rh, fill=1, stroke=0)
        draw_fit(c, label, x + 10, ty, lab_w - 24, F_REG, 10.5, th["label_fg"], min_size=7.5)
        c.setFillColor(th["value_bg"]); c.rect(x + lab_w, T(yt + rh), val_w, rh, fill=1, stroke=0)
        draw_fit(c, value, x + lab_w + 10, ty, val_w - 20, F_REG, 10.5, th["value_fg"], min_size=7.5)

    for i in range(rows):
        yt = gy + i * (rh + rgap)
        if i < len(left):
            cell(M, yt, left[i])
        if i < len(right):
            cell(M + colw + 24, yt, right[i])

    # Pied : courtier (gauche) + bloc prix rouge (droite) + barre rouge
    fy = gy + rows * (rh + rgap) + 28
    # Photo du courtier : fournie, sinon portrait par défaut embarqué (fond blanc).
    bphoto = broker.get("photo") or asset("broker", "portrait.png")
    draw_image(c, bphoto, M, T(fy + 70), 70, 70, radius=4)
    bx = M + 84; bw = PW / 2 - 10 - bx  # largeur dispo avant le bloc prix
    draw_fit(c, broker.get("name", ""), bx, T(fy + 14), bw, F_BOLD, 15, INK, min_size=10)
    for i, ln in enumerate([broker.get("title", ""), broker.get("subtitle", ""), broker.get("agency", "")]):
        if ln:
            draw_fit(c, ln, bx, T(fy + 28 + i * 12), bw, F_REG, 9, INK2, min_size=7)
    if broker.get("phone"):
        draw_fit(c, "T : %s" % broker["phone"], bx, T(fy + 66), bw, F_BOLD, 9, INK, min_size=7)

    pbx = PW / 2 + 10; pbw = PW - M - pbx; pbh = 70
    c.setFillColor(th["price_bg"]); c.rect(pbx, T(fy + pbh), pbw, pbh, fill=1, stroke=0)
    price = d.get("price")
    txt = ("Prix : %s $" % format(int(price), ",d").replace(",", " ")) if price else "Prix sur demande"
    draw_fit(c, txt, pbx + pbw / 2, T(fy + pbh) + pbh / 2 - 9, pbw - 24, F_BOLD, 26, th["price_fg"], align="c", min_size=14)
    c.setFillColor(th["bar"]); c.rect(M, T(fy + pbh + 14), PW - 2 * M, 6, fill=1, stroke=0)

    _compliance_footer(c, d)


# ───────────────────────────── Page 2 ─────────────────────────────
def page2(c, d, th):
    M = 36
    rooms = d.get("rooms", [])
    # Bannière (couleur du thème)
    bh = 40
    c.setFillColor(th["p2_banner_bg"]); c.rect(0, T(bh), PW, bh, fill=1, stroke=0)
    draw_fit(c, d.get("headline", d.get("title", "")), M, T(27), PW - 2 * M, F_BOLD, 18, th["p2_title_fg"], min_size=12)

    # Description (boîte selon le thème, hauteur bornée — le texte s'ajuste pour ne jamais déborder)
    y = bh + 16
    if d.get("description"):
        box_w = PW - 2 * M; pad = 12
        box_h = min(176, max(64, 28 + len(d["description"]) * 0.16))
        c.setFillColor(th["desc_bg"]); c.rect(M, T(y) - box_h, box_w, box_h, fill=1, stroke=0)
        para_fit(c, d["description"], M + pad, T(y) - pad, box_w - 2 * pad, box_h - 2 * pad,
                 F_REG, 11, INK, leading_ratio=1.36, align=TA_JUSTIFY, min_size=8)
        y += box_h + 16

    # 3 photos
    ph = 120; gap = 10; iw = (PW - 2 * M - 2 * gap) / 3
    for i in range(3):
        p = (d.get("interior", []) + [None, None, None])[i]
        draw_image(c, p, M + i * (iw + gap), T(y + ph), iw, ph, radius=4)
    y += ph + 16

    # Tableau des pièces
    if rooms:
        hh = 26; rh = 24
        cols = [0.46, 0.27, 0.27]; cw = [c0 * (PW - 2 * M) for c0 in cols]
        c.setFillColor(th["th_bg"]); c.rect(M, T(y + hh), PW - 2 * M, hh, fill=1, stroke=0)
        xs = M
        for i, htxt in enumerate(["Pièce", "Étage", "Dimension"]):
            draw_fit(c, htxt, xs + 10, T(y + hh) + hh / 2 - 4, cw[i] - 20, F_SB, 11, th["th_fg"], min_size=8); xs += cw[i]
        yy = y + hh
        for ri, room in enumerate(rooms):
            c.setFillColor(th["row_alt"] if ri % 2 else th["row"])
            c.rect(M, T(yy + rh), PW - 2 * M, rh, fill=1, stroke=0)
            xs = M
            for i in range(3):
                v = str(room[i]) if i < len(room) and room[i] is not None else ""
                draw_fit(c, v, xs + 10, T(yy + rh) + rh / 2 - 4, cw[i] - 20, F_REG, 10, th["row_fg"], min_size=7.5); xs += cw[i]
            yy += rh

    # Héros de marque (image transparente, ex. « SuperPierre » luxe) en bas à gauche.
    # Clé distincte de `images.hero` (qui est la photo principale de la page 1).
    hero = (d.get("images", {}) or {}).get("brand_hero") or th.get("hero_default")
    if hero and os.path.exists(hero) and Image is not None:
        him = _load(hero, rgb=False)
        hh2 = 104; hw2 = hh2 * (him.size[0] / him.size[1])
        c.drawImage(ImageReader(him), M, 26, hw2, hh2, mask="auto")

    _compliance_footer(c, d)


def _compliance_footer(c, d):
    """Mentions obligatoires (agence + courtier). LCI/OACIQ."""
    broker = d.get("broker", {})
    bits = [broker.get("name"), broker.get("agency"), broker.get("phone")]
    draw_fit(c, "  ·  ".join([b for b in bits if b]), PW / 2, 16, PW - 80, F_REG, 7, INK2, align="c", min_size=5)


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
