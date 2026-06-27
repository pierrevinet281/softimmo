# -*- coding: utf-8 -*-
"""Moteur render/ — Offre de services (Module 3, PDF professionnel, ReportLab).

Déterministe, sans IA (CLAUDE.md §3). Document à contenu variable (à la différence de la
brochure à mise en page fixe) : on utilise donc le moteur de flux Platypus. Inspiré et
amélioré de « Offre Ubee Rive-Nord Rehaussée.pdf » : profil/bio du courtier, garantie,
services, plan de mise en marché, calendrier, honoraires, valeur ajoutée, témoignages,
prochaines étapes, coordonnées.

Conformité (CLAUDE.md §0.2) :
- bilingue (FR prééminent) : data["langs"] = ["fr"] | ["en"] | ["fr","en"] ;
- mentions agence + courtier (désignation) en pied de CHAQUE page (LCI/OACIQ) ;
- « opinion de la valeur marchande » — jamais « évaluation » (le contenu par défaut respecte) ;
- avertissement : document de présentation, ne constitue pas un contrat de courtage.

E/S : lit {"data": {...}, "out": "<chemin.pdf>"} sur stdin, écrit le PDF et renvoie {"path"}.
"""
import sys
import os
import json

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, Flowable,
)

PW, PH = letter

# ── Palette (cohérente avec la brochure ; éditable) ──
BLUE = HexColor("#314897")
BLUE_D = HexColor("#26356F")
RED = HexColor("#E2231A")
INK = HexColor("#1A1A1A")
INK2 = HexColor("#5A5A5A")
INK3 = HexColor("#8A8A8A")
WHITE = HexColor("#FFFFFF")
SOFT = HexColor("#EEF1F7")     # fond doux (encarts)
SOFT_LINE = HexColor("#D7DEEE")

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")

try:
    from PIL import Image as PILImage, ImageDraw  # noqa: F401  (bannière/asset image optionnels)
except Exception:  # noqa: BLE001
    PILImage = None

# Thème éditable par le courtier (Profil du courtier) : couleur des bannières/blocs et des
# titres de section ; image de bannière facultative. Peuplé par render() à chaque rendu.
THEME = {"band": BLUE, "title": BLUE, "band_text": WHITE}
BANNER_IMG = None


def _lum(c):
    return 0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue


def _on(color):
    """Couleur de texte lisible (blanc/encre) sur un fond donné."""
    return INK if _lum(color) > 0.62 else WHITE


def asset(*p):
    return os.path.join(ASSETS, *p)


def _reg(name, *cands):
    for p in cands:
        if p and os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont(name, p))
                return True
            except Exception:  # noqa: BLE001
                pass
    return False


WF = "C:/Windows/Fonts"
F_REG = "Sg" if _reg("Sg", os.path.join(WF, "segoeui.ttf")) else "Helvetica"
F_BOLD = "Sg-B" if _reg("Sg-B", os.path.join(WF, "segoeuib.ttf")) else "Helvetica-Bold"
F_SB = "Sg-SB" if _reg("Sg-SB", os.path.join(WF, "seguisb.ttf")) else F_BOLD
F_IT = "Sg-I" if _reg("Sg-I", os.path.join(WF, "segoeuii.ttf")) else "Helvetica-Oblique"

MARGIN = 16 * mm
CONTENT_W = PW - 2 * MARGIN

# ── Styles ──
S_H1 = ParagraphStyle("h1", fontName=F_BOLD, fontSize=16, textColor=BLUE, leading=20,
                      spaceBefore=14, spaceAfter=7)
S_H2 = ParagraphStyle("h2", fontName=F_SB, fontSize=11.5, textColor=INK, leading=15,
                      spaceBefore=9, spaceAfter=3)
S_BODY = ParagraphStyle("body", fontName=F_REG, fontSize=10.2, textColor=INK, leading=15,
                        alignment=TA_JUSTIFY, spaceAfter=4)
S_BULLET = ParagraphStyle("bul", fontName=F_REG, fontSize=10.2, textColor=INK, leading=14.5,
                          leftIndent=15, bulletIndent=3, spaceAfter=2.5)
S_META = ParagraphStyle("meta", fontName=F_REG, fontSize=10, textColor=INK2, leading=15)
S_QUOTE = ParagraphStyle("quote", fontName=F_IT, fontSize=10.5, textColor=INK, leading=15,
                         leftIndent=12, spaceAfter=1)
S_QAUTH = ParagraphStyle("qauth", fontName=F_SB, fontSize=9.5, textColor=INK2, leftIndent=12,
                         spaceAfter=8)


def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")) if s is not None else ""


def _bullets(items):
    return [Paragraph(_esc(it), S_BULLET, bulletText="•") for it in items if it]


# ── Bandeau de marque (cover) — Table pleine largeur, fond bleu ──
def _banner_reader(path, w_pt, h_pt, dpi=150):
    """Image de bannière (cover-crop) assombrie d'un voile pour lisibilité du texte blanc."""
    if PILImage is None or not (path and os.path.exists(path)):
        return None
    try:
        tw = max(2, int(w_pt / 72 * dpi)); th = max(2, int(h_pt / 72 * dpi))
        im = PILImage.open(path).convert("RGB")
        w, h = im.size; ta = tw / th; a = w / h
        if a > ta:
            nw = int(h * ta); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
        else:
            nh = int(w / ta); y = (h - nh) // 2; im = im.crop((0, y, w, y + nh))
        im = im.resize((tw, th), PILImage.LANCZOS)
        veil = PILImage.new("RGB", (tw, th), (15, 24, 52))
        im = PILImage.blend(im, veil, 0.45)
        import io as _io
        buf = _io.BytesIO(); im.save(buf, "JPEG", quality=86); buf.seek(0)
        return ImageReader(buf)
    except Exception:  # noqa: BLE001
        return None


class BrandHeader(Flowable):
    """Bandeau de marque (cover) : image de bannière OU couleur de bannière du thème ;
    logo (gauche) + titre/sous-titre/courtier (droite). Texte adapté au fond."""
    H = 78

    def __init__(self, data, content, width=CONTENT_W):
        super().__init__()
        self.width = width
        self.height = self.H
        self.logo = data.get("logo")
        self.title = content.get("doc_title", "Proposition d'offre de services")
        self.subtitle = content.get("subtitle")
        broker = data.get("broker", {})
        desig = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
        self.broker_line = "%s — %s" % (broker.get("name", ""), desig)
        self._bimg = _banner_reader(BANNER_IMG, width, self.H) if BANNER_IMG else None
        self.fg = WHITE if self._bimg else _on(THEME["band"])

    def wrap(self, *a):
        return self.width, self.height

    def draw(self):
        c = self.canv; w = self.width; h = self.height
        if self._bimg:
            c.drawImage(self._bimg, 0, 0, w, h, mask="auto")
        else:
            c.setFillColor(THEME["band"]); c.rect(0, 0, w, h, fill=1, stroke=0)
        pad = 16; tx = pad
        if self.logo and os.path.exists(self.logo):
            try:
                ir = ImageReader(self.logo); iw, ih = ir.getSize(); lh = 38.0; lw = lh * iw / ih
                c.drawImage(ir, pad, (h - lh) / 2, lw, lh, mask="auto"); tx = pad + lw + 16
            except Exception:  # noqa: BLE001
                pass
        sub = self.fg if self.fg == WHITE else INK2
        c.setFillColor(self.fg); c.setFont(F_BOLD, 17)
        c.drawString(tx, h - 28, self.title)
        y = h - 44
        if self.subtitle:
            c.setFillColor(sub); c.setFont(F_REG, 10.5); c.drawString(tx, y, self.subtitle); y -= 15
        c.setFillColor(self.fg); c.setFont(F_SB, 10); c.drawString(tx, y, self.broker_line)


def _brand_header(data, content):
    return BrandHeader(data, content)


MONTHS = {
    "fr": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
           "septembre", "octobre", "novembre", "décembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December"],
}


def _fmt_date(data, lang):
    """Date localisée : si data['date'] est fourni (texte libre), on l'utilise tel quel ;
    sinon on formate data['date_iso'] (AAAA-MM-JJ) selon la langue."""
    if data.get("date"):
        return str(data["date"])
    iso = data.get("date_iso")
    if not iso:
        return ""
    try:
        y, m, dd = str(iso)[:10].split("-")
        mon = MONTHS[lang][int(m) - 1]
        return ("%d %s %s" % (int(dd), mon, y)) if lang == "fr" else ("%s %d, %s" % (mon, int(dd), y))
    except Exception:  # noqa: BLE001
        return str(iso)


def _meta_block(data, lang):
    L = LABELS[lang]
    broker = data.get("broker", {})
    rows = []
    if data.get("client_name"):
        rows.append("<b>%s :</b> %s" % (L["prepared_for"], _esc(data["client_name"])))
    if data.get("property_line"):
        rows.append("<b>%s :</b> %s" % (L["property"], _esc(data["property_line"])))
    rows.append("<b>%s :</b> %s" % (L["prepared_by"], _esc(broker.get("name", ""))))
    dt = _fmt_date(data, lang)
    if dt:
        rows.append("<b>%s :</b> %s" % (L["date"], _esc(dt)))
    flow = [Spacer(1, 8)]
    for r in rows:
        flow.append(Paragraph(r, S_META))
    return flow


# ── Encart « garantie » (bandeau accent) ──
class Band(Flowable):
    """Bandeau coloré pleine largeur avec titre + corps centrés (ex. garantie)."""
    def __init__(self, title, body, bg=INK, fg=WHITE, width=CONTENT_W):
        super().__init__()
        self.title, self.body, self.bg, self.fg, self.width = title, body, bg, fg, width
        self._ph = ParagraphStyle("bandh", fontName=F_BOLD, fontSize=14, textColor=fg,
                                  leading=17, alignment=TA_CENTER)
        self._pb = ParagraphStyle("bandb", fontName=F_REG, fontSize=9.8, textColor=fg,
                                  leading=13, alignment=TA_CENTER)
        self._titlep = Paragraph(_esc(title), self._ph)
        self._bodyp = Paragraph(_esc(body), self._pb)
        self.height = 0

    def wrap(self, aw, ah):
        pad = 12
        inner = self.width - 2 * pad
        _, th = self._titlep.wrap(inner, ah)
        _, bh = self._bodyp.wrap(inner, ah)
        self.height = th + bh + 2 * pad + 6
        return self.width, self.height

    def draw(self):
        c = self.canv
        pad = 12
        c.setFillColor(self.bg)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        inner = self.width - 2 * pad
        _, th = self._titlep.wrap(inner, self.height)
        _, bh = self._bodyp.wrap(inner, self.height)
        y = self.height - pad
        self._titlep.drawOn(c, pad, y - th)
        self._bodyp.drawOn(c, pad, y - th - 6 - bh)


def _section_groups(heading, intro, groups):
    """Section avec sous-groupes (label gras + puces)."""
    flow = [Paragraph(_esc(heading), S_H1)]
    if intro:
        flow.append(Paragraph(_esc(intro), S_BODY))
    for g in groups or []:
        sub = [Paragraph(_esc(g.get("label", "")), S_H2)] + _bullets(g.get("items", []))
        flow.append(KeepTogether(sub))
    return flow


def _section_list(heading, items):
    return [KeepTogether([Paragraph(_esc(heading), S_H1)] + _bullets(items))] if items else []


def _timeline(heading, steps):
    if not steps:
        return []
    rows = []
    for s in steps:
        rows.append([
            Paragraph(_esc(s.get("label", "")), ParagraphStyle("tl", fontName=F_SB, fontSize=10, textColor=THEME["title"], leading=13)),
            Paragraph(_esc(s.get("text", "")), ParagraphStyle("tr", fontName=F_REG, fontSize=10, textColor=INK, leading=14)),
        ])
    t = Table(rows, colWidths=[150, CONTENT_W - 150])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, SOFT_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 12),
    ]))
    return [Paragraph(_esc(heading), S_H1), t]


def _fees(heading, body, note):
    flow = [Paragraph(_esc(heading), S_H1)]
    if body:
        flow.append(Paragraph(_esc(body), S_BODY))
    if note:
        flow.append(Spacer(1, 2))
        flow.append(Paragraph("<i>%s</i>" % _esc(note),
                    ParagraphStyle("note", fontName=F_IT, fontSize=8.8, textColor=INK2, leading=12)))
    return [KeepTogether(flow)]


def _testimonials(heading, items):
    if not items:
        return []
    flow = [Paragraph(_esc(heading), S_H1)]
    for it in items:
        q = it.get("quote") or it.get("text") or ""
        a = it.get("author") or it.get("name") or ""
        if not q:
            continue
        flow.append(Paragraph("« %s »" % _esc(q), S_QUOTE))
        if a:
            flow.append(Paragraph("— %s" % _esc(a), S_QAUTH))
    return [KeepTogether(flow)] if len(flow) > 1 else []


def _contact(data, lang):
    L = LABELS[lang]
    broker = data.get("broker", {})
    photo = data.get("broker_photo")
    lines = [Paragraph(_esc(broker.get("name", "")),
             ParagraphStyle("cn", fontName=F_BOLD, fontSize=14, textColor=THEME["title"], leading=18))]
    desig = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
    if desig:
        lines.append(Paragraph(_esc(desig), ParagraphStyle("cd", fontName=F_SB, fontSize=10, textColor=INK, leading=14)))
    agency = broker.get("agency", "")
    if broker.get("company"):
        agency = (agency + " | " + broker["company"]) if agency else broker["company"]
    if agency:
        lines.append(Paragraph(_esc(agency), ParagraphStyle("ca", fontName=F_REG, fontSize=9.5, textColor=INK2, leading=14)))
    lines.append(Spacer(1, 3))
    for lab, key in [("T", "phone"), ("E", "email")]:
        if broker.get(key):
            lines.append(Paragraph("%s : %s" % (lab, _esc(broker[key])),
                         ParagraphStyle("cc", fontName=F_REG, fontSize=9.5, textColor=INK2, leading=14)))
    web = broker.get("web") or broker.get("website")
    if web:
        lines.append(Paragraph("W : %s" % _esc(web),
                     ParagraphStyle("cw", fontName=F_REG, fontSize=9.5, textColor=INK2, leading=14)))

    left = ""
    if photo and os.path.exists(photo):
        try:
            left = Image(photo, width=92, height=110)
        except Exception:  # noqa: BLE001
            left = ""
    cells = [[left, lines]] if left else [["", lines]]
    t = Table(cells, colWidths=[110 if left else 0, CONTENT_W - (110 if left else 0)])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [Spacer(1, 6), t]


# ── Libellés bilingues (chrome : pied, méta) ──
LABELS = {
    "fr": {
        "prepared_for": "Préparée pour", "prepared_by": "Préparée par", "property": "Propriété",
        "date": "Date", "page": "Page",
        "disclaimer": "Document de présentation — ne constitue pas un contrat de courtage. "
                      "Les repères de marché sont fournis à titre indicatif et sont éditables.",
    },
    "en": {
        "prepared_for": "Prepared for", "prepared_by": "Prepared by", "property": "Property",
        "date": "Date", "page": "Page",
        "disclaimer": "Presentation document — does not constitute a brokerage contract. "
                      "Market benchmarks are provided for guidance only and are editable.",
    },
}


# Ordre canonique des sections intégrées (sert de repli si aucun ordre fourni).
CANON_SECTIONS = ["why", "guarantee", "services", "marketing", "opportunities",
                  "timeline", "fees", "value_add", "testimonials", "next_steps"]


# Rendu d'une section INTÉGRÉE (renvoie une liste de flowables ; [] si vide).
def _render_builtin(key, sec):
    if not sec:
        return []
    if key == "guarantee":
        return [Spacer(1, 8), Band(sec.get("heading", ""), sec["body"], bg=THEME["band"], fg=_on(THEME["band"]))] if sec.get("body") else []
    if key in ("why", "services"):
        return _section_groups(sec.get("heading", ""), sec.get("intro"), sec.get("groups")) if sec.get("groups") else []
    if key == "marketing":
        return _section_groups(sec.get("heading", ""), None, sec.get("subgroups")) if sec.get("subgroups") else []
    if key == "timeline":
        return _timeline(sec.get("heading", ""), sec.get("steps"))
    if key == "fees":
        return _fees(sec.get("heading", ""), sec["body"], sec.get("note")) if sec.get("body") else []
    if key in ("opportunities", "value_add"):
        return _section_list(sec.get("heading", ""), sec.get("items"))
    if key == "testimonials":
        return _testimonials(sec.get("heading", ""), sec.get("items"))
    if key == "next_steps":
        return _fees(sec.get("heading", ""), sec["body"], None) if sec.get("body") else []
    return []


# Image (asset) insérée dans l'offre — pleine largeur, hauteur plafonnée, légende optionnelle.
def _render_asset(sec):
    img = sec.get("image")
    if not img or not os.path.exists(img):
        return []
    iw, ih = (1000, 600)
    if PILImage is not None:
        try:
            iw, ih = PILImage.open(img).size
        except Exception:  # noqa: BLE001
            pass
    w = CONTENT_W
    h = w * ih / iw
    if h > 300:
        h = 300; w = h * iw / ih
    flow = [Spacer(1, 8), Image(img, width=w, height=h)]
    if sec.get("caption"):
        flow.append(Paragraph(_esc(sec["caption"]),
                    ParagraphStyle("cap", fontName=F_IT, fontSize=8.5, textColor=INK2, leading=11, spaceBefore=3)))
    return [KeepTogether(flow)]


# Rendu d'une section PERSONNALISÉE selon son type (asset|text|list|groups).
def _render_custom(sec):
    if not sec:
        return []
    kind = sec.get("kind") or ("asset" if sec.get("image") else "groups" if sec.get("groups") else "list" if sec.get("items") else "text")
    if kind == "asset":
        return _render_asset(sec)
    if kind == "groups":
        return _section_groups(sec.get("heading", ""), sec.get("intro"), sec.get("groups") or [])
    if kind == "list":
        return _section_list(sec.get("heading", ""), sec.get("items") or [])
    return _fees(sec.get("heading", ""), sec.get("body", ""), sec.get("note")) if sec.get("body") else (
        [Paragraph(_esc(sec.get("heading", "")), S_H1)] if sec.get("heading") else [])


def _section_order(content):
    """Liste ordonnée [{key, hidden, custom, kind}] : explicite si fournie, sinon canonique."""
    secs = content.get("sections")
    if isinstance(secs, list) and secs:
        return secs
    return [{"key": k, "hidden": False} for k in CANON_SECTIONS if content.get(k)]


def _story(data, lang):
    content = (data.get("content") or {}).get(lang) or {}
    flow = [_brand_header(data, content)]
    flow += _meta_block(data, lang)
    flow.append(Spacer(1, 6))

    for s in _section_order(content):
        if not isinstance(s, dict) or s.get("hidden"):
            continue
        key = s.get("key")
        if not key:
            continue
        sec = content.get(key) or {}
        flow += _render_custom(sec) if s.get("custom") else _render_builtin(key, sec)

    flow += _contact(data, lang)
    return flow


def render(data, out):
    global BANNER_IMG
    langs = data.get("langs") or ["fr"]
    langs = [l for l in langs if l in ("fr", "en")] or ["fr"]
    broker = data.get("broker", {})

    # Thème éditable (Profil du courtier) : couleurs bannière/blocs + titres de section.
    th = data.get("theme") or {}
    def _c(v, d):
        try:
            return HexColor(v) if v else d
        except Exception:  # noqa: BLE001
            return d
    THEME["band"] = _c(th.get("band_color"), BLUE)
    THEME["title"] = _c(th.get("title_color"), BLUE)
    S_H1.textColor = THEME["title"]
    BANNER_IMG = data.get("banner_image") or None

    def footer(c, doc):
        c.saveState()
        # Filet + mentions agence + courtier (désignation) — LCI/OACIQ, sur CHAQUE page.
        lang = doc._offre_lang
        L = LABELS[lang]
        c.setStrokeColor(SOFT_LINE)
        c.setLineWidth(0.6)
        c.line(MARGIN, 22 * mm, PW - MARGIN, 22 * mm)
        desig = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
        agency = broker.get("agency", "")
        if broker.get("company"):
            agency = (agency + " | " + broker["company"]) if agency else broker["company"]
        bits = [broker.get("name"), desig, agency]
        line1 = "  ·  ".join([b for b in bits if b])
        c.setFillColor(INK2)
        c.setFont(F_SB, 7.5)
        c.drawString(MARGIN, 17.5 * mm, line1)
        c.setFont(F_REG, 6.6)
        c.setFillColor(INK3)
        c.drawString(MARGIN, 14.2 * mm, L["disclaimer"])
        c.setFont(F_REG, 7.5)
        c.setFillColor(INK2)
        c.drawRightString(PW - MARGIN, 17.5 * mm, "%s %d" % (L["page"], doc.page))
        c.restoreState()

    doc = BaseDocTemplate(out, pagesize=letter,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=26 * mm,
                          title=(data.get("content", {}).get(langs[0], {}) or {}).get("doc_title", "Offre de services"),
                          author=broker.get("name", "Softimmo"))
    frame = Frame(MARGIN, 26 * mm, CONTENT_W, PH - MARGIN - 26 * mm, id="main",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="offre", frames=[frame], onPage=footer)])

    story = []
    for i, lang in enumerate(langs):
        if i > 0:
            story.append(PageBreak())
        # marque la langue active pour le pied (via attribut consulté par footer())
        story.append(_LangMark(doc, lang))
        story += _story(data, lang)
    doc._offre_lang = langs[0]
    doc.build(story)
    return out


class _LangMark(Flowable):
    """Flowable invisible : bascule la langue du pied de page au fil du document (FR puis EN)."""
    def __init__(self, doc, lang):
        super().__init__()
        self.width = self.height = 0
        self._doc = doc
        self._lang = lang

    def wrap(self, *a):
        self._doc._offre_lang = self._lang
        return 0, 0

    def draw(self):
        pass


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
