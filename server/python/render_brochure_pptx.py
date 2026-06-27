# -*- coding: utf-8 -*-
"""Jumeau PowerPoint éditable de la brochure (docs/09).

Produit un .pptx FIDÈLE et MODIFIABLE, aux MÊMES coordonnées que le PDF (espace 540×720 pt
= 7,5×10 po, natif PowerPoint). Le courtier ajuste les positions dans PowerPoint, puis
`extract_pptx_layout.py` permet de reporter les changements dans `render_brochure.py`.

Déterministe, sans IA (CLAUDE.md §3). E/S : lit {"data": {...}, "out": "<chemin.pptx>"} sur
stdin, écrit le PPTX et renvoie {"path"}.
"""
import sys
import os
import io
import json

from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

try:
    from reportlab.graphics.barcode import qr
    from PIL import Image
except Exception:  # noqa: BLE001
    qr = None
    Image = None

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


def asset(*p):
    return os.path.join(ASSETS, *p)


FONT = "Segoe UI"

# Thèmes (mêmes couleurs que le moteur PDF render_brochure.py).
THEMES = {
    "unifamilial": {
        "banner": "314897", "title_fg": "FFFFFF", "sub_fg": "FFFFFF", "title_upper": False, "luxe": False,
        "label_bg": "314897", "label_fg": "FFFFFF", "value_bg": "D7DEEE", "value_fg": "1A1A1A",
        "rule": "314897", "price_bg": "E2231A", "price_fg": "FFFFFF", "bar": "E2231A", "qr": "E2231A",
        "p2_banner": "E2231A", "p2_title_fg": "FFFFFF", "desc_bg": "C6D1E6",
        "th_bg": "314897", "th_fg": "FFFFFF", "row": "EEF1F7", "row_alt": "D7DEEE", "row_fg": "1A1A1A",
        "logo": asset("unifamilial", "exp_logo_white.png"), "medal": asset("unifamilial", "certificat.png"),
        "hero": asset("unifamilial", "superpierre.png"),
    },
    "luxe": {
        "banner": "221F1C", "title_fg": "B79A5B", "sub_fg": "FFFFFF", "title_upper": True, "luxe": True,
        "label_bg": "B79A5B", "label_fg": "FFFFFF", "value_bg": "F2EDE2", "value_fg": "1A1A1A",
        "rule": "B79A5B", "price_bg": "221F1C", "price_fg": "FFFFFF", "bar": "B79A5B", "qr": "9C8246",
        "p2_banner": "9C8246", "p2_title_fg": "FFFFFF", "desc_bg": "F2EDE2",
        "th_bg": "9C8246", "th_fg": "FFFFFF", "row": "F7F3EA", "row_alt": "F2EDE2", "row_fg": "1A1A1A",
        "logo": asset("luxe", "exp_luxury_white.png"), "medal": None,
        "hero": asset("luxe", "superpierre_luxury.png"),
    },
}

PLACEHOLDER = "E9EDF3"


def _rgb(h):
    return RGBColor.from_string(h)


def _rect(slide, x, y, w, h, fill=None, line=None, text=None, size=12, bold=False,
          color="000000", align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, padx=2.0):
    sp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Pt(x), Pt(y), Pt(w), Pt(h))
    try:
        sp.shadow.inherit = False
    except Exception:  # noqa: BLE001
        pass
    if fill:
        sp.fill.solid(); sp.fill.fore_color.rgb = _rgb(fill)
    else:
        sp.fill.background()
    if line:
        sp.line.color.rgb = _rgb(line); sp.line.width = Pt(0.75)
    else:
        sp.line.fill.background()
    if text is not None:
        tf = sp.text_frame; tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = Pt(1); tf.margin_left = tf.margin_right = Pt(padx)
        tf.vertical_anchor = anchor
        p = tf.paragraphs[0]; p.alignment = align
        r = p.add_run(); r.text = text
        r.font.size = Pt(size); r.font.bold = bold; r.font.name = FONT; r.font.color.rgb = _rgb(color)
    return sp


def _textbox(slide, x, y, w, h, lines, anchor=MSO_ANCHOR.TOP, wrap=True):
    """lines : liste de (texte, taille, gras, couleur_hex, alignement)."""
    tb = slide.shapes.add_textbox(Pt(x), Pt(y), Pt(w), Pt(h))
    tf = tb.text_frame; tf.word_wrap = wrap
    tf.margin_top = tf.margin_bottom = Pt(0); tf.margin_left = tf.margin_right = Pt(0)
    tf.vertical_anchor = anchor
    for i, (text, size, bold, color, align) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align or PP_ALIGN.LEFT
        r = p.add_run(); r.text = text
        r.font.size = Pt(size); r.font.bold = bool(bold); r.font.name = FONT
        if color:
            r.font.color.rgb = _rgb(color)
    return tb


def _pic(slide, path, x, y, w, h):
    """Image au cadre exact (peut légèrement déformer) ; cadre gris « image » si absente."""
    if path and os.path.exists(path):
        slide.shapes.add_picture(path, Pt(x), Pt(y), Pt(w), Pt(h))
    else:
        _rect(slide, x, y, w, h, fill=PLACEHOLDER, text="image", size=8, color="5A5A5A")


def _pic_fit(slide, path, x, y, w=None, h=None):
    """Image en préservant l'aspect (largeur OU hauteur imposée), ancrée en (x, y)."""
    if path and os.path.exists(path):
        slide.shapes.add_picture(path, Pt(x), Pt(y),
                                 width=Pt(w) if w else None, height=Pt(h) if h else None)


def _qr_stream(url, dark="E2231A"):
    """Génère un PNG de QR code (matrice ReportLab rasterisée via PIL) → BytesIO."""
    if not (url and qr and Image):
        return None
    w = qr.QrCodeWidget(str(url)); w.draw()
    m = w.qr.modules; n = len(m); scale, border = 10, 4
    side = (n + 2 * border) * scale
    rgb = tuple(int(dark[i:i + 2], 16) for i in (0, 2, 4))
    im = Image.new("RGB", (side, side), "white"); px = im.load()
    for r in range(n):
        for cI in range(n):
            if m[r][cI]:
                for dy in range(scale):
                    for dx in range(scale):
                        px[(cI + border) * scale + dx, (r + border) * scale + dy] = rgb
    buf = io.BytesIO(); im.save(buf, "PNG"); buf.seek(0)
    return buf


def _broker_url(d, broker):
    u = d.get("listing_url") or broker.get("web") or broker.get("website")
    if u and not str(u).startswith(("http://", "https://")):
        u = "https://" + str(u)
    return u


# ───────────────────────────── Page 1 ─────────────────────────────
def slide1(prs, d, th):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    img = d.get("images", {}) or {}; broker = d.get("broker", {})
    title = d.get("title", "")
    if th["title_upper"]:
        title = title.upper()

    _rect(s, 19.84, 16.76, 500.31, 82.49, fill=th["banner"])  # bannière
    if th["luxe"]:
        _textbox(s, 33.75, 26, 282, 60, [
            (title, 20, True, th["title_fg"], PP_ALIGN.LEFT),
            (d.get("city", ""), 12, False, th["sub_fg"], PP_ALIGN.LEFT),
            (d.get("summary_line", ""), 12, False, th["sub_fg"], PP_ALIGN.LEFT)])
        _pic_fit(s, img.get("logo") or th.get("logo"), 360, 44, w=160)
    else:
        _pic_fit(s, img.get("logo") or th.get("logo"), 33.75, 30.38, h=53.79)
        _textbox(s, 132.04, 24.56, 282, 65.43, [
            (title, 20, True, th["title_fg"], PP_ALIGN.LEFT),
            (d.get("city", ""), 12, False, th["sub_fg"], PP_ALIGN.LEFT),
            (d.get("summary_line", ""), 12, False, th["sub_fg"], PP_ALIGN.LEFT)])

    _pic(s, img.get("hero"), 19.84, 110.54, 299.94, 224.96)   # photo
    _pic(s, img.get("map"), 328.0, 110.54, 192.16, 224.96)    # carte
    if th.get("medal"):  # médaille (déborde le haut de la bannière)
        _pic_fit(s, img.get("medal") or th["medal"], 387.34, 12.14, w=146.72)

    _textbox(s, 26.72, 340, 486.41, 40, [   # adresse + MLS
        (d.get("address", ""), 16, True, "1A1A1A", PP_ALIGN.LEFT),
        ("MLS : %s" % d["mls"] if d.get("mls") else "", 11, False, "5A5A5A", PP_ALIGN.LEFT)])
    _rect(s, 19.58, 392.9, 500.69, 1.6, fill=th["rule"])      # filet

    # Grille de spécifications
    rows_y = [413.43 + i * 29.7 for i in range(5)]
    cols = [(31.69, 136.89, 175.06, 87.15), (277.16, 136.89, 421.22, 86.45)]
    ch = 24.13
    left = d.get("specs_left", []); right = d.get("specs_right", [])
    for i, ry in enumerate(rows_y):
        for col, specs in zip(cols, (left, right)):
            if i < len(specs):
                lab = specs[i][0]; val = "" if specs[i][1] is None else str(specs[i][1])
                _rect(s, col[0], ry, col[1], ch, fill=th["label_bg"], text=lab, size=12,
                      color=th["label_fg"], align=PP_ALIGN.LEFT, padx=8)
                _rect(s, col[2], ry, col[3], ch, fill=th["value_bg"], text=val, size=12,
                      color=th["value_fg"], align=PP_ALIGN.LEFT, padx=8)

    # Bloc prix
    price = d.get("price")
    ptxt = ("Prix : %s $" % format(int(price), ",d").replace(",", " ")) if price else "Prix sur demande"
    _rect(s, 279.04, 608.5, 241.11, 71.18, fill=th["price_bg"], text=ptxt, size=28, bold=True,
          color=th["price_fg"], align=PP_ALIGN.CENTER)

    _pic(s, broker.get("photo") or asset("broker", "portrait.png"), 43.03, 605.0, 59.31, 60.29)
    _textbox(s, 106.85, 605.0, 172.2, 67.86, [
        (broker.get("name", ""), 15, True, "1A1A1A", PP_ALIGN.LEFT),
        (broker.get("title", ""), 9.5, False, "5A5A5A", PP_ALIGN.LEFT),
        (broker.get("subtitle", ""), 9.5, False, "5A5A5A", PP_ALIGN.LEFT),
        (broker.get("agency", ""), 9.5, False, "5A5A5A", PP_ALIGN.LEFT),
        ("T : %s" % broker["phone"] if broker.get("phone") else "", 9.5, True, "1A1A1A", PP_ALIGN.LEFT)])
    _rect(s, 33.75, 678, 486.41, 2.6, fill=th["bar"])  # barre rouge


# ───────────────────────────── Page 2 ─────────────────────────────
def _room_table(s, rooms, th, y, max_h):
    rows = len(rooms) + 1
    gt = s.shapes.add_table(rows, 3, Pt(20.07), Pt(y), Pt(500.31), Pt(max_h)).table
    gt.first_row = False; gt.horz_banding = False
    gt.columns[0].width = Pt(500.31 * 0.46)
    gt.columns[1].width = Pt(500.31 * 0.27)
    gt.columns[2].width = Pt(500.31 * 0.27)

    def fill_cell(cell, text, size, bold, color, bg):
        cell.fill.solid(); cell.fill.fore_color.rgb = _rgb(bg)
        cell.margin_top = cell.margin_bottom = Pt(1); cell.margin_left = Pt(8); cell.margin_right = Pt(4)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf = cell.text_frame; tf.word_wrap = True
        p = tf.paragraphs[0]; r = p.add_run(); r.text = text
        r.font.size = Pt(size); r.font.bold = bold; r.font.name = FONT; r.font.color.rgb = _rgb(color)

    for ci, htext in enumerate(["Pièce", "Étage", "Dimension"]):
        fill_cell(gt.cell(0, ci), htext, 11, True, th["th_fg"], th["th_bg"])
    for ri, room in enumerate(rooms):
        for ci in range(3):
            v = str(room[ci]) if ci < len(room) and room[ci] is not None else ""
            fill_cell(gt.cell(ri + 1, ci), v, 10, False, th["row_fg"], th["row_alt"] if ri % 2 else th["row"])


def _footer(s, d, th):
    broker = d.get("broker", {}); img = d.get("images", {}) or {}
    _pic_fit(s, img.get("brand_hero") or th.get("hero"), 19.84, 589.52, h=109.66)  # héros
    lines = [(broker.get("name", ""), 13, True, "1A1A1A", PP_ALIGN.LEFT)]
    tl = " ".join([x for x in [broker.get("title"), broker.get("subtitle")] if x])
    if tl:
        lines.append((tl, 9, True, "1A1A1A", PP_ALIGN.LEFT))
    agency = broker.get("agency", "")
    if broker.get("company"):
        agency = (agency + " | " + broker["company"]) if agency else broker["company"]
    if agency:
        lines.append((agency, 9, False, "5A5A5A", PP_ALIGN.LEFT))
    contact = [x for x in [("T : %s" % broker["phone"]) if broker.get("phone") else None,
                           ("E : %s" % broker["email"]) if broker.get("email") else None] if x]
    if contact:
        lines.append(("  |  ".join(contact), 9, False, "5A5A5A", PP_ALIGN.LEFT))
    web = broker.get("web") or broker.get("website")
    if web:
        lines.append(("W : %s" % web, 9, False, "5A5A5A", PP_ALIGN.LEFT))
    _textbox(s, 213.58, 621.56, 226.18, 63.01, lines)
    qbuf = _qr_stream(_broker_url(d, broker), th["qr"])  # QR
    if qbuf:
        s.shapes.add_picture(qbuf, Pt(422.0), Pt(604.83), Pt(100.46), Pt(100.46))
        ref = d.get("brochure_ref") or (("MLS %s" % d["mls"]) if d.get("mls") else "")
        if ref:
            _textbox(s, 412, 706, 120, 12, [(ref, 7, False, "5A5A5A", PP_ALIGN.CENTER)])


def slide2(prs, d, th):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rooms = d.get("rooms", [])
    _rect(s, 19.84, 20.82, 500.31, 24.72, fill=th["p2_banner"],
          text=d.get("headline", d.get("title", "")), size=16, bold=True, color=th["p2_title_fg"],
          align=PP_ALIGN.LEFT, padx=12)
    if d.get("description"):
        _rect(s, 19.84, 50.57, 500.31, 169.32, fill=th["desc_bg"], text=d["description"], size=12,
              color="1A1A1A", align=PP_ALIGN.JUSTIFY, anchor=MSO_ANCHOR.TOP, padx=12)
    photos = [(20.14, 161.0), (189.25, 160.7), (358.36, 162.1)]
    interior = (d.get("interior", []) + [None, None, None])
    for (px, pw), p in zip(photos, interior):
        _pic(s, p, px, 228.58, pw, 131.9)
    # Tableau (zone fixe 368.48→585 ; hauteur ajustée au nombre de pièces)
    if rooms:
        max_h = min(216.0, max(48.0, (len(rooms) + 1) * 18.0))
        _room_table(s, rooms, th, 368.48, max_h)
    _footer(s, d, th)


def render(data, out):
    th = THEMES.get(data.get("template") or "unifamilial", THEMES["unifamilial"])
    prs = Presentation()
    prs.slide_width = Pt(540); prs.slide_height = Pt(720)
    slide1(prs, data, th)
    slide2(prs, data, th)
    prs.save(out)
    return out


def main():
    try:
        raw = sys.stdin.buffer.read().decode("utf-8") or "{}"
        payload = json.loads(raw)
        data = payload.get("data") or {}
        out = payload.get("out")
        if not out:
            print(json.dumps({"error": "out requis"})); return
        render(data, out)
        print(json.dumps({"path": out}))
    except Exception as e:  # noqa: BLE001
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()[-600:]}))


if __name__ == "__main__":
    main()
