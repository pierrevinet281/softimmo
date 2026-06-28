# -*- coding: utf-8 -*-
"""Moteur render/ — Brochure RPA (résidence pour aînés / location de logements).

Format ÉDITORIAL 6 pages, TRÈS différent de la brochure standard (spec-sheet) : portage
data-driven et déterministe (sans IA, CLAUDE.md §3) du gabarit « rpa_mlt » apprécié du
courtier (Les Tours Gouin) — palette pétrole/or/crème, titres Oswald, cartes d'avantages,
mosaïque photo, bandeaux info, page contact (QR + héros courtier superposé du logo cie).

Tout le contenu (textes, images, listes) vient de `data` : un champ absent n'est PAS affiché
(ni étiquette ni valeur) pour garder la brochure compacte et élégante.

E/S : lit {"data": {...}, "out": "<chemin.pdf>"} sur stdin, écrit le PDF, renvoie {"path"}.
Conformité : mentions agence + courtier (désignation) en pied de chaque page (LCI/OACIQ).
"""
import os
import io
import sys
import json

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import Color, HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

try:
    from reportlab.lib.utils import ImageReader
    from PIL import Image, ImageDraw
except Exception:  # noqa: BLE001
    Image = None

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
FN = os.path.join(ASSETS, "fonts")
WF = "C:/Windows/Fonts"


def asset(*p):
    return os.path.join(ASSETS, *p)

# ── Palette (du gabarit rpa_mlt ; éditable) ──
INK = HexColor("#21303A")
INK2 = HexColor("#4A5A63")
DEEP = HexColor("#0F3B4C")
DEEP_D = HexColor("#0A2C39")
DEEP2 = HexColor("#1E6478")
GOLD = HexColor("#BF9A46")
GOLD_D = HexColor("#9A7826")
GOLD_LT = HexColor("#E8D9B0")
CREAM = HexColor("#F8F3E8")
CREAM_B = HexColor("#EBE1CB")
MIST = HexColor("#ECF2F3")
MIST_B = HexColor("#D9E5E6")
LINE = HexColor("#E1E5E2")
WHITE = HexColor("#FFFFFF")


def rgb255(c):
    return (int(c.red * 255), int(c.green * 255), int(c.blue * 255))


def _reg(name, path, *fallbacks):
    for p in (path,) + fallbacks:
        if p and os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont(name, p))
                return True
            except Exception:  # noqa: BLE001
                pass
    return False


# Oswald (titres) + Segoe (corps) + Font Awesome (icônes). Repli Helvetica si absent.
F_TL = "Osw-L" if _reg("Osw-L", os.path.join(FN, "Oswald-300.ttf")) else "Helvetica"
F_TM = "Osw-M" if _reg("Osw-M", os.path.join(FN, "Oswald-500.ttf")) else "Helvetica"
F_TSB = "Osw-SB" if _reg("Osw-SB", os.path.join(FN, "Oswald-600.ttf")) else "Helvetica-Bold"
F_TB = "Osw-B" if _reg("Osw-B", os.path.join(FN, "Oswald-700.ttf")) else "Helvetica-Bold"
F_R = "Sg" if _reg("Sg", os.path.join(WF, "segoeui.ttf")) else "Helvetica"
F_L = "Sg-L" if _reg("Sg-L", os.path.join(WF, "segoeuil.ttf")) else F_R
F_SB = "Sg-SB" if _reg("Sg-SB", os.path.join(WF, "seguisb.ttf")) else "Helvetica-Bold"
F_B = "Sg-B" if _reg("Sg-B", os.path.join(WF, "segoeuib.ttf")) else "Helvetica-Bold"
F_I = "Sg-I" if _reg("Sg-I", os.path.join(WF, "segoeuii.ttf")) else "Helvetica-Oblique"
HAS_FA = _reg("FA", os.path.join(FN, "fa-solid-900.ttf"))
HAS_FAB = _reg("FAB", os.path.join(FN, "fa-brands-400.ttf"))

# Icônes Font Awesome (codepoints). Clés stables utilisées dans le modèle de contenu.
IC = {
    "house": 0x1F3E0, "leaf": 0xF06C, "bolt": 0xF0E7, "blender": 0xF517,
    "wifi": 0xF1EB, "car": 0x1F698, "shield": 0xF3ED, "nurse": 0xF82F, "bell": 0x1F6CE,
    "key": 0x1F511, "camera": 0xF03D, "fire": 0x1F525, "steth": 0x1FA7A, "pills": 0xF484,
    "cart": 0x1F6D2, "swim": 0x1F3CA, "dumbbell": 0xF44B, "film": 0x1F39E, "book": 0x1F56E,
    "golf": 0xF450, "dice": 0x1F3B2, "church": 0xF51D, "calendar": 0xF073, "champagne": 0x1F942,
    "utensils": 0x1F374, "pin": 0xF3C5, "bus": 0x1F68D, "hospital": 0x1F3E5, "store": 0xF54E,
    "coins": 0xF51E, "phone": 0x1F57B, "envelope": 0x1F582, "check": 0xF058, "tree": 0x1F332,
    "heart": 0x1F9E1, "couch": 0xF4B8, "water": 0xF773, "masks": 0x1F3AD, "globe": 0x1F310,
    "cake": 0x1F382,
}
ICB = {"linkedin": 0xF0E1}

PW, PH = letter
M = 50
CW = PW - 2 * M

_cache = {}

# ── Override de positions (Phase C — aller-retour PPTX → positions) ──
# data["layout"][slot] = [x, y, w, h] (pt, origine bas-gauche, comme ReportLab). Si présent, il
# remplace la position CALCULÉE de l'élément ; sinon, mise en page adaptative par défaut.
LAYOUT_OV = {}


def ov(slot, x, y, w, h):
    b = LAYOUT_OV.get(slot)
    if isinstance(b, (list, tuple)) and len(b) == 4:
        return float(b[0]), float(b[1]), float(b[2]), float(b[3])
    return x, y, w, h


# Facteurs d'ascendante (alignés sur le jumeau PPTX) pour reconvertir une boîte → ligne de base.
ASC = {"osw": 0.78, "sg": 0.74, "sgb": 0.74}


def tov_text(slot, x, ybase, size, grp="sg"):
    """Texte une ligne : boîte override → (x gauche, ligne de base). y_base = y_bas + h - asc*size."""
    b = LAYOUT_OV.get(slot)
    if isinstance(b, (list, tuple)) and len(b) == 4:
        return float(b[0]), float(b[1]) + float(b[3]) - ASC.get(grp, 0.75) * size
    return x, ybase


def tov_para(slot, x, ytop, w):
    """Paragraphe : boîte override → (x gauche, haut, largeur). y_top = y_bas + h."""
    b = LAYOUT_OV.get(slot)
    if isinstance(b, (list, tuple)) and len(b) == 4:
        return float(b[0]), float(b[1]) + float(b[3]), float(b[2])
    return x, ytop, w


def _exists(p):
    return bool(p) and os.path.exists(p) and Image is not None


def _cover_crop(img, tw, th):
    w, h = img.size
    ta = tw / th
    a = w / h
    if a > ta:
        nw = int(h * ta); x = (w - nw) // 2; box = (x, 0, x + nw, h)
    else:
        nh = int(w / ta); y = (h - nh) // 2; box = (0, y, w, y + nh)
    return img.crop(box).resize((tw, th), Image.LANCZOS)


def _jpeg(pil_rgb, q=87):
    buf = io.BytesIO(); pil_rgb.save(buf, "JPEG", quality=q, optimize=True); buf.seek(0)
    return ImageReader(buf)


def _placeholder_reader(w_pt, h_pt, radius_pt, dpi=120):
    key = ("ph", round(w_pt, 1), round(h_pt, 1), round(radius_pt, 1))
    if key in _cache:
        return _cache[key]
    tw = max(2, int(w_pt / 72 * dpi)); th = max(2, int(h_pt / 72 * dpi))
    base = Image.new("RGB", (tw, th), rgb255(MIST))
    d = ImageDraw.Draw(base)
    d.rectangle([0, 0, tw - 1, th - 1], outline=rgb255(MIST_B), width=max(1, tw // 240))
    if radius_pt > 0:
        r = int(radius_pt / 72 * dpi)
        mask = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=r, fill=255)
        out = Image.new("RGB", (tw, th), (255, 255, 255)); out.paste(base, (0, 0), mask); base = out
    rdr = _jpeg(base, q=80); _cache[key] = rdr
    return rdr


def rounded_reader(path, w_pt, h_pt, radius_pt=10, dpi=300):
    key = ("img", path, round(w_pt, 1), round(h_pt, 1), round(radius_pt, 1))
    if key in _cache:
        return _cache[key]
    tw = max(2, int(w_pt / 72 * dpi)); th = max(2, int(h_pt / 72 * dpi))
    img = Image.open(path).convert("RGB")
    tw = min(tw, int(img.size[0] * 1.05)); th = min(th, int(img.size[1] * 1.05))
    im = _cover_crop(img, tw, th)
    if radius_pt > 0:
        r = int(radius_pt / 72 * dpi)
        mask = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=r, fill=255)
        out = Image.new("RGB", (tw, th), (255, 255, 255)); out.paste(im, (0, 0), mask)
        rdr = _jpeg(out)
    else:
        rdr = _jpeg(im)
    _cache[key] = rdr
    return rdr


def draw_image(c, path, x, y, w, h, radius=10, dpi=300):
    """Image arrondie en cover-crop ; réserve élégante (gris MIST) si l'image est absente."""
    if _exists(path):
        c.drawImage(rounded_reader(path, w, h, radius, dpi), x, y, w, h, mask="auto")
    elif Image is not None:
        c.drawImage(_placeholder_reader(w, h, radius), x, y, w, h, mask="auto")
    else:
        c.setFillColor(MIST); c.roundRect(x, y, w, h, radius, fill=1, stroke=0)


def gradient_reader(w_pt, h_pt, c1, c2, radius_pt=14, vertical=True, dpi=200):
    key = ("grad", round(w_pt, 1), round(h_pt, 1), c1.hexval(), c2.hexval(), round(radius_pt, 1), vertical)
    if key in _cache:
        return _cache[key]
    tw = max(2, int(w_pt / 72 * dpi)); th = max(2, int(h_pt / 72 * dpi))
    base = Image.new("RGB", (tw, th)); px = base.load()
    a = rgb255(c1); b = rgb255(c2)
    n = (th - 1) if vertical else (tw - 1)
    for i in range(th if vertical else tw):
        t = i / max(1, n)
        col = (int(a[0] + (b[0] - a[0]) * t), int(a[1] + (b[1] - a[1]) * t), int(a[2] + (b[2] - a[2]) * t))
        if vertical:
            for xx in range(tw):
                px[xx, i] = col
        else:
            for yy in range(th):
                px[i, yy] = col
    if radius_pt > 0:
        r = int(radius_pt / 72 * dpi)
        mask = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=r, fill=255)
        out = Image.new("RGB", (tw, th), (255, 255, 255)); out.paste(base, (0, 0), mask)
    else:
        out = base
    rdr = _jpeg(out, q=92); _cache[key] = rdr
    return rdr


def draw_gradient(c, x, y, w, h, c1, c2, radius=14, vertical=True):
    if Image is None:
        c.setFillColor(c1); c.roundRect(x, y, w, h, radius, fill=1, stroke=0); return
    c.drawImage(gradient_reader(w, h, c1, c2, radius, vertical), x, y, w, h, mask="auto")


def scrim_reader(w_pt, h_pt, dpi=110, top_alpha=0, bot_alpha=210, base=(8, 30, 40)):
    key = ("scrim", round(w_pt, 1), round(h_pt, 1), top_alpha, bot_alpha, base)
    if key in _cache:
        return _cache[key]
    tw = max(2, int(w_pt / 72 * dpi)); th = max(2, int(h_pt / 72 * dpi))
    img = Image.new("RGBA", (tw, th), (0, 0, 0, 0)); px = img.load()
    for i in range(th):
        t = i / max(1, th - 1)
        a = int(top_alpha + (bot_alpha - top_alpha) * (t ** 1.6))
        for xx in range(tw):
            px[xx, i] = (base[0], base[1], base[2], a)
    rdr = ImageReader(img); _cache[key] = rdr
    return rdr


def draw_scrim(c, x, y, w, h, **kw):
    if Image is None:
        return
    c.drawImage(scrim_reader(w, h, **kw), x, y, w, h, mask="auto")


def img_size(path):
    return Image.open(path).size


def logo_reader(path):
    if path in _cache:
        return _cache[path]
    r = ImageReader(Image.open(path)); _cache[path] = r
    return r


def draw_logo(c, path, x, y, w=None, h=None, anchor="bl"):
    if not _exists(path):
        return 0, 0
    iw, ih = img_size(path); ar = iw / ih
    if w and not h:
        h = w / ar
    if h and not w:
        w = h * ar
    if anchor == "br":
        x -= w
    elif anchor == "tl":
        y -= h
    elif anchor == "tr":
        x -= w; y -= h
    elif anchor == "center":
        x -= w / 2; y -= h / 2
    c.drawImage(logo_reader(path), x, y, w, h, mask="auto")
    return w, h


# ── Texte ──
def fa_icon(c, key, cx, cy, size, color, brand=False):
    cp = (ICB if brand else IC).get(key)
    if cp is None or (brand and not HAS_FAB) or (not brand and not HAS_FA):
        return
    c.setFont("FAB" if brand else "FA", size); c.setFillColor(color)
    c.drawCentredString(cx, cy - size * 0.355, chr(cp))


def tracked(c, x, y, text, font, size, color, tracking, align="l"):
    c.saveState()
    c.setFont(font, size); c.setFillColor(color)
    w = c.stringWidth(text, font, size) + tracking * max(0, len(text) - 1)
    if align == "c":
        x -= w / 2
    elif align == "r":
        x -= w
    t = c.beginText(x, y); t.setCharSpace(tracking); t.textOut(text); c.drawText(t)
    c.restoreState()
    return w


def kicker(c, x, y, text, color=GOLD, size=10.5, tracking=2.6):
    if text:
        tracked(c, x, y, str(text).upper(), F_TSB, size, color, tracking)


def st(font, size, color, leading=None, align=TA_LEFT):
    return ParagraphStyle("s", fontName=font, fontSize=size, textColor=color,
                          leading=leading or size * 1.32, alignment=align, spaceBefore=0, spaceAfter=0)


def draw_para(c, text, style, x, y_top, w):
    if not text:
        return 0
    p = Paragraph(_esc(text), style); _, ph = p.wrap(w, 100000); p.drawOn(c, x, y_top - ph)
    return ph


def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") if s is not None else ""


def title_block(c, x, y_top, kick, title_lines, title_size=30, tcolor=DEEP, rule=True, rule_w=46, kbase=None):
    kicker(c, x, y_top, kick, color=GOLD)
    yy = y_top - 20
    c.setFont(F_TB, title_size); c.setFillColor(tcolor)
    lead = title_size * 1.02
    for i, ln in enumerate(title_lines or []):
        dx, dy = x, yy - title_size * 0.80
        if kbase:
            dx, dy = tov_text("%s.title.%d" % (kbase, i), dx, dy, title_size, "osw")
        c.drawString(dx, dy, ln); yy -= lead
    if rule:
        c.setStrokeColor(GOLD); c.setLineWidth(2.4); c.line(x, yy - 2, x + rule_w, yy - 2); yy -= 8
    return yy


def feature_card(c, x, y, w, h, glyph, label, desc, bg=CREAM, bdr=CREAM_B, icon_color=GOLD_D, label_color=DEEP, slot=None):
    if not label and not desc:
        return
    if slot:
        x, y, w, h = ov(slot, x, y, w, h)  # déplacer la carte → enfants relatifs suivent
    c.setFillColor(bg); c.setStrokeColor(bdr); c.setLineWidth(1); c.roundRect(x, y, w, h, 9, stroke=1, fill=1)
    cxx = x + 26; cyy = y + h - 26
    c.setFillColor(WHITE); c.setStrokeColor(GOLD_LT); c.setLineWidth(1); c.circle(cxx, cyy, 16, stroke=1, fill=1)
    fa_icon(c, glyph, cxx, cyy, 15, icon_color)
    tx = x + 52
    c.setFont(F_TSB, 12.5); c.setFillColor(label_color); c.drawString(tx, y + h - 22, label or "")
    draw_para(c, desc, st(F_R, 9.0, INK2, leading=11.6), tx, y + h - 32, w - (tx - x) - 12)


# ── Chrome (pied / en-tête courant), paramétrés par le courtier ──
def footer(c, page_no, broker):
    y = 34
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(M, y + 10, PW - M, y + 10)
    bits = [broker.get("name"), broker.get("title_line"), broker.get("agency")]
    c.setFont(F_R, 7.6); c.setFillColor(INK2)
    c.drawString(M, y, "  ·  ".join([b for b in bits if b]))
    c.setFont(F_SB, 7.6); c.setFillColor(GOLD_D); c.drawRightString(PW - M, y, "%02d" % page_no)


def running_head(c, label, right_label):
    y = PH - 42
    tracked(c, M, y, str(label).upper(), F_TSB, 8.5, GOLD_D, 2.2)
    if right_label:
        tracked(c, PW - M, y, str(right_label).upper(), F_TSB, 8.5, DEEP, 2.2, align="r")
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(M, y - 8, PW - M, y - 8)


# ════════════════════════════ PAGES ════════════════════════════
def page_cover(c, d):
    A = d["assets"]; broker = d["broker"]; cov = d["content"].get("cover", {})
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    hero_h = 440; hero_y = PH - hero_h
    draw_image(c, cov.get("hero"), *ov("cover.hero", 0, hero_y, PW, hero_h), radius=0, dpi=200)
    draw_scrim(c, 0, hero_y, PW, 180, bot_alpha=200)
    draw_scrim(c, 0, PH - 90, PW, 90, top_alpha=150, bot_alpha=0)
    draw_logo(c, A.get("agency_logo_white"), M, PH - 34, h=30, anchor="tl")
    if cov.get("pill"):
        c.setFont(F_SB, 9); pw = c.stringWidth(str(cov["pill"]).upper(), F_TSB, 9) + 1.4 * (len(str(cov["pill"])) - 1)
        pill_w = max(150, pw + 42); px = PW - M - pill_w; py = PH - 46
        c.setFillColor(Color(1, 1, 1, 0.16)); c.setStrokeColor(Color(1, 1, 1, 0.7)); c.setLineWidth(1)
        c.roundRect(px, py, pill_w, 22, 11, stroke=1, fill=1)
        fa_icon(c, "check", px + 15, py + 11, 11, WHITE)
        tracked(c, px + 27, py + 7, str(cov["pill"]).upper(), F_TSB, 9, WHITE, 1.4)
    if cov.get("hero_tag"):
        c.setFillColor(WHITE); c.setFont(F_TSB, 12)
        hx, hy = tov_text("cover.hero_tag", M, hero_y + 24, 12, "osw")
        c.drawString(hx, hy, cov["hero_tag"])
    ly = hero_y; x = M
    kicker(c, x, ly - 36, cov.get("eyebrow", ""), color=GOLD_D, size=11)
    tl = cov.get("title", [])
    c.setFont(F_TB, 46); c.setFillColor(DEEP)
    yy = ly - 78
    for i, ln in enumerate(tl[:2]):
        dx, dy = tov_text("cover.title.%d" % i, x, yy, 46, "osw")
        c.drawString(dx, dy, ln); yy -= 42
    c.setStrokeColor(GOLD); c.setLineWidth(2.6); c.line(x, yy + 8, x + 54, yy + 8)
    sub_top = yy - 4; sub_h = 0
    if cov.get("subtitle"):
        sx, sy, sw = tov_para("cover.subtitle", x, sub_top, CW * 0.90)
        sub_h = draw_para(c, cov["subtitle"], st(F_L, 13, INK, leading=17), sx, sy, sw)
    chips = cov.get("chips", [])
    # Pastilles ancrées SOUS le sous-titre (hauteur 30 + marge), quel que soit le nombre de
    # lignes du sous-titre — anti-chevauchement. Chaque pastille = unité déplaçable (slot).
    cy = max(96, (sub_top - sub_h) - 14 - 30); cx = x
    for i, chip in enumerate(chips[:3]):
        txt = chip.get("text", "")
        c.setFont(F_SB, 10); tw = c.stringWidth(txt, F_SB, 10); cw = tw + 42
        bx, by, bw, bh = ov("cover.chips.%d" % i, cx, cy, cw, 30)
        c.setFillColor(MIST); c.setStrokeColor(MIST_B); c.setLineWidth(1); c.roundRect(bx, by, bw, bh, 15, stroke=1, fill=1)
        fa_icon(c, chip.get("icon"), bx + 17, by + 15, 12, GOLD_D)
        c.setFillColor(DEEP); c.setFont(F_SB, 10); c.drawString(bx + 31, by + 10.5, txt)
        cx += cw + 11
    by = 46
    c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, by + 34, PW - M, by + 34)
    draw_logo(c, A.get("agency_logo_black"), M, by, h=26, anchor="bl")
    c.setFont(F_R, 9.5); c.setFillColor(INK2)
    c.drawRightString(PW - M, by + 16, " · ".join([b for b in [broker.get("name"), broker.get("title_line")] if b]))
    c.setFont(F_SB, 9.5); c.setFillColor(DEEP)
    contact = "   ·   ".join([b for b in [broker.get("phone"), broker.get("email")] if b])
    c.drawRightString(PW - M, by + 2, contact)
    c.showPage()


def _intro(c, sec, rt, num, kbase=None):
    running_head(c, sec.get("running", num or ""), rt)
    yb = title_block(c, M, PH - 70, sec.get("kicker", ""), sec.get("title", []), title_size=30, kbase=kbase)
    lx, ly, lw = tov_para("%s.lead" % kbase, M, yb - 8, CW) if kbase else (M, yb - 8, CW)
    lh = draw_para(c, sec.get("lead"), st(F_R, 11.5, INK, leading=17), lx, ly, lw)
    return yb - 8 - lh - 16


def page_comfort(c, d, page_no):
    sec = d["content"].get("comfort", {}); rt = d["content"].get("running_title")
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    top = _intro(c, sec, rt, "01 · " + sec.get("running", ""), "comfort")
    if sec.get("wide_image") is not None or True:
        ih = 178
        draw_image(c, sec.get("wide_image"), *ov("comfort.wide_image", M, top - ih, CW, ih), radius=12)
        cap = sec.get("wide_caption") or {}
        if cap.get("text"):
            draw_scrim(c, M, top - ih, CW, 48, bot_alpha=150)
            fa_icon(c, cap.get("icon"), M + 18, top - ih + 15, 11, GOLD_LT)
            c.setFont(F_SB, 9.5); c.setFillColor(WHITE); c.drawString(M + 33, top - ih + 11, cap["text"])
        gy = top - ih - 22
    feats = sec.get("features", [])
    gap = 14; cardw = (CW - gap) / 2; cardh = 66
    for i, f in enumerate(feats[:6]):
        r = i // 2; col = i % 2
        x = M + col * (cardw + gap); y = gy - cardh - r * (cardh + gap)
        feature_card(c, x, y, cardw, cardh, f.get("icon"), f.get("label"), f.get("desc"), slot="comfort.features.%d.card" % i)
    rows = (min(len(feats[:6]), 6) + 1) // 2
    note = sec.get("note") or {}
    if note.get("title"):
        ny = gy - rows * (cardh + gap) - 6
        nx, nyy, nw, nh = ov("comfort.note.card", M, ny - 46, CW, 46)
        draw_gradient(c, nx, nyy, nw, nh, DEEP, DEEP2, radius=12, vertical=False)
        fa_icon(c, "check", nx + 26, nyy + nh - 23, 15, GOLD_LT)
        c.setFont(F_TSB, 12.5); c.setFillColor(WHITE); c.drawString(nx + 48, nyy + nh - 19, note["title"])
        if note.get("sub"):
            c.setFont(F_R, 9.5); c.setFillColor(GOLD_LT); c.drawString(nx + 48, nyy + nh - 32, note["sub"])
    footer(c, page_no, d["broker"]); c.showPage()


def page_security(c, d, page_no):
    sec = d["content"].get("security", {}); rt = d["content"].get("running_title")
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    top = _intro(c, sec, rt, "02 · " + sec.get("running", ""), "security")
    panel_w = CW * 0.605; img_w = CW - panel_w - 16; panel_h = 236
    px, py, pw, ph = ov("security.panel", M, top - panel_h, panel_w, panel_h)
    draw_gradient(c, px, py, pw, ph, DEEP, DEEP_D, radius=14, vertical=True)
    if sec.get("panel_title"):
        tracked(c, px + 22, py + ph - 26, str(sec["panel_title"]).upper(), F_TSB, 12, GOLD_LT, 1.6)
    iy = py + ph - 50
    for it in sec.get("panel_items", [])[:5]:
        fa_icon(c, it.get("icon"), px + 30, iy - 2, 14, GOLD)
        draw_para(c, it.get("text"), st(F_R, 10, WHITE, leading=13.0), px + 50, iy + 6, pw - 50 - 18)
        iy -= 37
    draw_image(c, sec.get("panel_image"), *ov("security.panel_image", M + panel_w + 16, top - panel_h, img_w, panel_h), radius=14)
    if sec.get("panel_caption"):
        draw_scrim(c, M + panel_w + 16, top - panel_h, img_w, 70, bot_alpha=150)
        c.setFont(F_SB, 9); c.setFillColor(WHITE); c.drawString(M + panel_w + 16 + 12, top - panel_h + 12, sec["panel_caption"])
    sy = top - panel_h - 26
    kicker(c, M, sy, sec.get("services_kicker", ""), color=GOLD_D, size=10.5)
    if sec.get("services_title"):
        c.setFont(F_TB, 21); c.setFillColor(DEEP); c.drawString(M, sy - 26, str(sec["services_title"]).upper())
    svcs = sec.get("services", [])
    gap = 14; cw = (CW - 2 * gap) / 3; chh = 92; sc_y = sy - 40
    for i, s in enumerate(svcs[:3]):
        x = M + i * (cw + gap); y = sc_y - chh
        bx, by, bw, bh = ov("security.services.%d.card" % i, x, y, cw, chh)
        c.setFillColor(CREAM); c.setStrokeColor(CREAM_B); c.setLineWidth(1); c.roundRect(bx, by, bw, bh, 10, stroke=1, fill=1)
        c.setFillColor(WHITE); c.setStrokeColor(GOLD_LT); c.circle(bx + 26, by + bh - 26, 17, stroke=1, fill=1)
        fa_icon(c, s.get("icon"), bx + 26, by + bh - 26, 16, GOLD_D)
        c.setFont(F_TSB, 13); c.setFillColor(DEEP); c.drawString(bx + 52, by + bh - 30, s.get("label", ""))
        draw_para(c, s.get("desc"), st(F_R, 9.2, INK2, leading=11.8), bx + 16, by + bh - 48, bw - 30)
    footer(c, page_no, d["broker"]); c.showPage()


def page_amenities(c, d, page_no):
    sec = d["content"].get("amenities", {}); rt = d["content"].get("running_title")
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    top = _intro(c, sec, rt, "03 · " + sec.get("running", ""), "amenities")
    gallery = sec.get("gallery", [])

    def cap(x, y, w, item):
        if not item.get("caption"):
            return
        draw_scrim(c, x, y, w, 42, bot_alpha=165)
        fa_icon(c, item.get("icon"), x + 15, y + 13, 11, GOLD_LT)
        c.setFont(F_SB, 9.5); c.setFillColor(WHITE); c.drawString(x + 30, y + 9, item["caption"])
    gap = 12; big_w = CW * 0.60; big_h = 196; sm_w = CW - big_w - gap; sm_h = (196 - gap) / 2
    g = (gallery + [{}] * 6)[:6]
    bx, by = M, top - big_h
    b = ov("amenities.gallery.0.image", bx, by, big_w, big_h); draw_image(c, g[0].get("image"), *b, radius=12); cap(b[0], b[1], b[2], g[0])
    rx = M + big_w + gap
    b = ov("amenities.gallery.1.image", rx, top - sm_h, sm_w, sm_h); draw_image(c, g[1].get("image"), *b, radius=12); cap(b[0], b[1], b[2], g[1])
    b = ov("amenities.gallery.2.image", rx, top - big_h, sm_w, sm_h); draw_image(c, g[2].get("image"), *b, radius=12); cap(b[0], b[1], b[2], g[2])
    r2y = by - gap; cw3 = (CW - 2 * gap) / 3; h3 = 150
    for i in range(3):
        item = g[3 + i]
        x = M + i * (cw3 + gap); y = r2y - h3
        b = ov("amenities.gallery.%d.image" % (3 + i), x, y, cw3, h3); draw_image(c, item.get("image"), *b, radius=12); cap(b[0], b[1], b[2], item)
    pillars = sec.get("pillars", [])
    sy = r2y - h3 - 22; gap = 14; cw = (CW - 2 * gap) / 3; chh = 66
    for i, p in enumerate(pillars[:3]):
        x = M + i * (cw + gap); y = sy - chh
        feature_card(c, x, y, cw, chh, p.get("icon"), p.get("label"), p.get("desc"), bg=MIST, bdr=MIST_B, slot="amenities.pillars.%d.card" % i)
    footer(c, page_no, d["broker"]); c.showPage()


def page_life(c, d, page_no):
    sec = d["content"].get("life", {}); rt = d["content"].get("running_title")
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    top = _intro(c, sec, rt, "04 · " + sec.get("running", ""), "life")
    gap = 14; cw = (CW - 2 * gap) / 3; ch_img = 82; chh = 150
    for i, ev in enumerate(sec.get("events", [])[:3]):
        x = M + i * (cw + gap); y = top - chh
        bx, by, bw, bh = ov("life.events.%d.card" % i, x, y, cw, chh)
        c.setFillColor(WHITE); c.setStrokeColor(CREAM_B); c.setLineWidth(1); c.roundRect(bx, by, bw, bh, 10, stroke=1, fill=1)
        draw_image(c, ev.get("image"), bx, by + bh - ch_img, bw, ch_img, radius=10)
        fa_icon(c, ev.get("icon"), bx + 18, by + bh - ch_img - 14, 14, GOLD_D)
        c.setFont(F_TSB, 12.5); c.setFillColor(DEEP); c.drawString(bx + 34, by + bh - ch_img - 18, ev.get("label", ""))
        draw_para(c, ev.get("desc"), st(F_R, 9.0, INK2, leading=11.6), bx + 14, by + bh - ch_img - 30, bw - 26)
    qy = top - chh - 24
    kicker(c, M, qy, sec.get("neighborhood_kicker", ""), color=GOLD_D, size=10.5)
    if sec.get("neighborhood_title"):
        c.setFont(F_TB, 21); c.setFillColor(DEEP); c.drawString(M, qy - 26, str(sec["neighborhood_title"]).upper())
    qcards = sec.get("neighborhood", [])
    gap = 14; cw2 = (CW - gap) / 2; chh2 = 58; gy = qy - 38
    for i, q in enumerate(qcards[:4]):
        r = i // 2; col = i % 2
        x = M + col * (cw2 + gap); y = gy - chh2 - r * (chh2 + gap)
        feature_card(c, x, y, cw2, chh2, q.get("icon"), q.get("label"), q.get("desc"), bg=MIST, bdr=MIST_B, slot="life.neighborhood.%d.card" % i)
    fin = sec.get("finance") or {}
    if fin.get("title"):
        nrows = (min(len(qcards), 4) + 1) // 2
        fy = gy - nrows * (chh2 + gap) - 8; fh = 58
        fx, fyy, fw, fhh = ov("life.finance.card", M, fy - fh, CW, fh)
        draw_gradient(c, fx, fyy, fw, fhh, GOLD_D, GOLD, radius=14, vertical=False)
        c.setFillColor(Color(1, 1, 1, 0.92)); c.circle(fx + 34, fyy + fhh / 2, 19, fill=1, stroke=0)
        fa_icon(c, fin.get("icon", "coins"), fx + 34, fyy + fhh / 2, 18, GOLD_D)
        c.setFont(F_TB, 16); c.setFillColor(WHITE); c.drawString(fx + 66, fyy + fhh - 24, str(fin["title"]).upper())
        draw_para(c, fin.get("text"), st(F_SB, 9.6, WHITE, leading=12), fx + 66, fyy + fhh - 30, fw - 150)
    footer(c, page_no, d["broker"]); c.showPage()


def page_contact(c, d, page_no):
    A = d["assets"]; broker = d["broker"]; sec = d["content"].get("contact", {})
    c.setFillColor(WHITE); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    txt_ref = PH - 250; band_bottom = PH - 308; band_h = PH - band_bottom
    draw_image(c, sec.get("hero"), *ov("contact.hero", 0, band_bottom, PW, band_h), radius=0, dpi=200)
    draw_scrim(c, 0, band_bottom, PW, band_h, top_alpha=120, bot_alpha=225)
    draw_logo(c, A.get("agency_logo_white"), M, PH - 34, h=28, anchor="tl")
    kicker(c, M, txt_ref + 150, sec.get("kicker", ""), color=GOLD_LT, size=11)
    tl = sec.get("title", [])
    c.setFont(F_TB, 38); c.setFillColor(WHITE)
    yy = txt_ref + 108
    for i, ln in enumerate(tl[:2]):
        dx, dy = tov_text("contact.title.%d" % i, M, yy, 38, "osw")
        c.drawString(dx, dy, ln); yy -= 38
    c.setStrokeColor(GOLD); c.setLineWidth(2.6); c.line(M, yy + 6, M + 54, yy + 6)
    cx2, cy2, cw2 = tov_para("contact.cta", M, yy - 6, CW * 0.74)
    draw_para(c, sec.get("cta"), st(F_L, 13, WHITE, leading=18), cx2, cy2, cw2)
    # carte contact (tous les enfants sont relatifs à cardx/cardy/cardw/cardh → 1 override déplace tout)
    cardx = M; cardw = CW * 0.57; cardy = 148; cardh = band_bottom - 148 - 26
    cardx, cardy, cardw, cardh = ov("contact.card", cardx, cardy, cardw, cardh)
    c.setFillColor(WHITE); c.setStrokeColor(LINE); c.setLineWidth(1.2); c.roundRect(cardx, cardy, cardw, cardh, 14, stroke=1, fill=1)
    c.setFillColor(GOLD); c.roundRect(cardx, cardy + cardh - 6, cardw, 6, 3, stroke=0, fill=1)
    ix = cardx + 28; iy = cardy + cardh - 42
    c.setFont(F_TB, 26); c.setFillColor(DEEP); c.drawString(ix, iy, str(broker.get("name", "")).upper())
    c.setFont(F_SB, 10.5); c.setFillColor(GOLD_D); c.drawString(ix, iy - 17, broker.get("title_line", ""))
    agency = "  ·  ".join([b for b in [broker.get("agency"), broker.get("company")] if b])
    c.setFont(F_R, 9.5); c.setFillColor(INK2); c.drawString(ix, iy - 32, agency)
    c.setStrokeColor(LINE); c.setLineWidth(1); c.line(ix, iy - 46, cardx + cardw - 28, iy - 46)
    rows = []
    if broker.get("phone"):
        rows.append(("phone", broker["phone"], False))
    if broker.get("email"):
        rows.append(("envelope", broker["email"], False))
    if broker.get("linkedin"):
        rows.append(("linkedin", broker["linkedin"], True))
    ry = iy - 68
    for g, txt, brand in rows:
        c.setFillColor(DEEP); c.circle(ix + 13, ry, 13, fill=1, stroke=0)
        fa_icon(c, g, ix + 13, ry, 12, WHITE, brand=brand)
        c.setFont(F_SB, 11.5); c.setFillColor(INK); c.drawString(ix + 36, ry - 4.5, txt)
        ry -= 31
    EXP_W = 118
    draw_logo(c, A.get("agency_logo_black"), ix, cardy + 20, w=EXP_W, anchor="bl")
    qr = A.get("qr")
    if _exists(qr):
        qrs = 70; qx = cardx + cardw - 28 - qrs; qy = cardy + 18
        c.drawImage(logo_reader(qr), qx, qy, qrs, qrs, mask="auto")
        if broker.get("linkedin_label"):
            c.setFont(F_R, 7.4); c.setFillColor(INK2); c.drawCentredString(qx + qrs / 2, qy - 9, broker["linkedin_label"])
    if sec.get("disclaimer"):
        draw_para(c, sec["disclaimer"], st(F_R, 7.4, INK2, leading=9.6), M, 92, CW * 0.50)
    footer(c, page_no, broker)
    # héros courtier (SuperPierre) + logo compagnie superposé, dessinés en dernier (devant le pied)
    sp = A.get("broker_hero")
    if _exists(sp):
        iw, ih = img_size(sp); ar = iw / ih; sp_h = 312; sp_w = sp_h * ar
        sp_x = PW - sp_w + 26; sp_y = 0
        c.drawImage(logo_reader(sp), sp_x, sp_y, sp_w, sp_h, mask="auto")
        if _exists(A.get("company_logo")):
            pv_w = EXP_W * 1.5
            draw_logo(c, A["company_logo"], sp_x + sp_w * 0.56, sp_y + sp_h * 0.245, w=pv_w, anchor="center")
    c.showPage()


def render(data, out):
    broker = data.setdefault("broker", {})
    broker.setdefault("title_line", " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s]))
    data.setdefault("assets", {})
    data.setdefault("content", {})
    global LAYOUT_OV
    LAYOUT_OV = data.get("layout") or {}
    c = canvas.Canvas(out, pagesize=letter)
    c.setTitle((data["content"].get("cover", {}) or {}).get("title", ["Brochure RPA"])[0] if data["content"].get("cover", {}).get("title") else "Brochure RPA")
    c.setAuthor(broker.get("name", "Softimmo"))
    page_cover(c, data)
    n = 2
    if data["content"].get("comfort"):
        page_comfort(c, data, n); n += 1
    if data["content"].get("security"):
        page_security(c, data, n); n += 1
    if data["content"].get("amenities"):
        page_amenities(c, data, n); n += 1
    if data["content"].get("life"):
        page_life(c, data, n); n += 1
    page_contact(c, data, n)
    c.save()
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
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()[-700:]}))


if __name__ == "__main__":
    main()
