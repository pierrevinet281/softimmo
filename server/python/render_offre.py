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
def _brand_header(data, content):
    broker = data.get("broker", {})
    logo = data.get("logo")
    desig = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
    right = [
        Paragraph(_esc(content.get("doc_title", "Proposition d'offre de services")),
                  ParagraphStyle("ht", fontName=F_BOLD, fontSize=17, textColor=WHITE, leading=20)),
    ]
    if content.get("subtitle"):
        right.append(Paragraph(_esc(content["subtitle"]),
                     ParagraphStyle("hs", fontName=F_REG, fontSize=10.5, textColor=HexColor("#D7DEEE"), leading=14, spaceBefore=2)))
    right.append(Spacer(1, 4))
    right.append(Paragraph("%s — %s" % (_esc(broker.get("name", "")), _esc(desig)),
                 ParagraphStyle("hb", fontName=F_SB, fontSize=10, textColor=WHITE, leading=13)))

    left = ""
    if logo and os.path.exists(logo):
        try:
            ir = ImageReader(logo)
            iw, ih = ir.getSize()
            h = 38.0
            left = Image(logo, width=h * iw / ih, height=h)
        except Exception:  # noqa: BLE001
            left = ""

    t = Table([[left, right]], colWidths=[120, CONTENT_W - 120])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
    ]))
    return t


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
            Paragraph(_esc(s.get("label", "")), ParagraphStyle("tl", fontName=F_SB, fontSize=10, textColor=BLUE, leading=13)),
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
             ParagraphStyle("cn", fontName=F_BOLD, fontSize=14, textColor=BLUE, leading=18))]
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


def _story(data, lang):
    content = (data.get("content") or {}).get(lang) or {}
    flow = []
    flow.append(_brand_header(data, content))
    flow += _meta_block(data, lang)
    flow.append(Spacer(1, 6))

    why = content.get("why") or {}
    if why.get("groups"):
        flow += _section_groups(why.get("heading", ""), why.get("intro"), why["groups"])

    g = content.get("guarantee") or {}
    if g.get("body"):
        flow.append(Spacer(1, 8))
        flow.append(Band(g.get("heading", ""), g["body"], bg=INK, fg=WHITE))

    sv = content.get("services") or {}
    if sv.get("groups"):
        flow += _section_groups(sv.get("heading", ""), sv.get("intro"), sv["groups"])

    mk = content.get("marketing") or {}
    if mk.get("subgroups"):
        flow += _section_groups(mk.get("heading", ""), None, mk["subgroups"])

    op = content.get("opportunities") or {}
    flow += _section_list(op.get("heading", ""), op.get("items"))

    tl = content.get("timeline") or {}
    flow += _timeline(tl.get("heading", ""), tl.get("steps"))

    fe = content.get("fees") or {}
    if fe.get("body"):
        flow += _fees(fe.get("heading", ""), fe["body"], fe.get("note"))

    va = content.get("value_add") or {}
    flow += _section_list(va.get("heading", ""), va.get("items"))

    te = content.get("testimonials") or {}
    flow += _testimonials(te.get("heading", ""), te.get("items"))

    ns = content.get("next_steps") or {}
    if ns.get("body"):
        flow += _fees(ns.get("heading", ""), ns["body"], None)

    flow += _contact(data, lang)
    return flow


def render(data, out):
    langs = data.get("langs") or ["fr"]
    langs = [l for l in langs if l in ("fr", "en")] or ["fr"]
    broker = data.get("broker", {})

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
