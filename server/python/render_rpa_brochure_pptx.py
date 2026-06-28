# -*- coding: utf-8 -*-
"""Jumeau PPTX éditable de la brochure RPA (format éditorial 6 pages — aller-retour, docs/09).

Le PDF RPA (render_rpa_brochure.py) est un document éditorial riche ; pour permettre l'édition
dans PowerPoint puis la resynchronisation, on génère ici une diapo ÉDITABLE par SECTION, où
CHAQUE feuille de texte modifiable est une forme NOMMÉE « RPA::<chemin.pointé> » (ex.
« RPA::comfort.features.0.label »). `ingest_rpa_brochure_pptx.py` relit ces formes et superpose
le texte édité sur le contenu de base — les ICÔNES et la structure sont préservées (non éditables).

Déterministe, sans IA (CLAUDE.md §3). E/S : lit {"data": {...}, "out": "<chemin.pptx>"} sur stdin,
écrit le PPTX, renvoie {"path"}. Conformité : mentions agence + courtier (désignation) en pied.
"""
import os
import sys
import json

from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

FONT = "Segoe UI"
FONT_BOLD = "Segoe UI Semibold"
PW, PH = 612.0, 792.0   # Lettre portrait (pt), cohérent avec le PDF
M = 50.0
CW = PW - 2 * M

INK = "1A1A1A"
INK2 = "5A5A5A"
INK3 = "8A8A8A"
WHITE = "FFFFFF"
BAND = "2E6E5E"   # vert RPA (cohérent avec le thème du PDF)
GOLD = "BF9A46"

SKIP = {"icon"}

# Libellés FR des clés (le contenu RPA est FR ; cohérent avec l'éditeur web).
LABELS = {
    "running_title": "Titre courant", "cover": "Couverture", "comfort": "Confort",
    "security": "Sécurité", "amenities": "Commodités", "life": "Vie sociale", "contact": "Contact",
    "pill": "Pastille", "eyebrow": "Sur-titre", "title": "Titre", "subtitle": "Sous-titre",
    "chips": "Puces", "text": "Texte", "lead": "Accroche", "kicker": "Intro",
    "features": "Caractéristiques", "label": "Libellé", "desc": "Description", "note": "Note",
    "sub": "Sous-texte", "wide_caption": "Légende (image large)", "panel_title": "Titre du panneau",
    "panel_items": "Éléments du panneau", "panel_caption": "Légende du panneau", "services": "Services",
    "services_title": "Titre des services", "services_kicker": "Intro services", "gallery": "Galerie",
    "caption": "Légende", "pillars": "Piliers", "events": "Événements", "neighborhood": "Quartier",
    "neighborhood_title": "Titre du quartier", "neighborhood_kicker": "Intro quartier",
    "finance": "Avantage financier", "cta": "Appel à l'action", "disclaimer": "Avertissement",
    "running": "Titre courant", "hero_tag": "Étiquette",
}


def _rgb(h):
    return RGBColor.from_string(h.lstrip("#"))


def humanize(k):
    return LABELS.get(k, str(k).replace("_", " ").capitalize())


def _box(slide, x, y, w, h, name=None):
    tb = slide.shapes.add_textbox(Pt(x), Pt(y), Pt(w), Pt(h))
    if name:
        tb.name = name
    tf = tb.text_frame
    tf.word_wrap = True
    return tf


def _para(tf, text, *, size=11, bold=False, italic=False, color=INK, first=False):
    p = tf.paragraphs[0] if first and not tf.paragraphs[0].runs else tf.add_paragraph()
    r = p.add_run()
    r.text = "" if text is None else str(text)
    r.font.size = Pt(size)
    r.font.bold = bool(bold)
    r.font.italic = bool(italic)
    r.font.name = FONT_BOLD if bold else FONT
    r.font.color.rgb = _rgb(color)
    return p


def _footer(slide, broker):
    desig = " ".join([s for s in [broker.get("title"), broker.get("subtitle")] if s])
    agency = broker.get("agency", "")
    if broker.get("company"):
        agency = (agency + " | " + broker["company"]) if agency else broker["company"]
    bits = [broker.get("name"), desig, agency]
    tf = _box(slide, M, PH - 30, CW, 20)
    _para(tf, "  ·  ".join([b for b in bits if b]), size=7.5, color=INK2, first=True)
    _para(tf, "Document de présentation — ne constitue pas un contrat de courtage.", size=6.6, color=INK3)


class Deck:
    def __init__(self, broker):
        self.prs = Presentation()
        self.prs.slide_width = Pt(PW)
        self.prs.slide_height = Pt(PH)
        self.broker = broker or {}
        self.slide = None
        self.y = 0.0
        self.title = ""

    def _blank(self):
        return self.prs.slides.add_slide(self.prs.slide_layouts[6])

    def new_slide(self, title, cont=False):
        self.slide = self._blank()
        self.title = title
        rect = self.slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Pt(0), Pt(0), Pt(PW), Pt(54))
        rect.fill.solid(); rect.fill.fore_color.rgb = _rgb(BAND); rect.line.fill.background()
        rect.name = "RPA::__band"
        tf = _box(self.slide, M, 14, CW, 30)
        _para(tf, title + ("  (suite)" if cont else ""), size=16, bold=True, color=WHITE, first=True)
        self.y = 74.0
        _footer(self.slide, self.broker)

    def _ensure(self, need):
        if self.y + need > PH - 44:
            self.new_slide(self.title, cont=True)

    def subhead(self, text):
        self._ensure(22)
        tf = _box(self.slide, M, self.y, CW, 16)
        _para(tf, text, size=10.5, bold=True, color=BAND, first=True)
        self.y += 20

    def field(self, path, value, label, size=11):
        text = "" if value is None else str(value)
        approx = (len(text) // 88 + 1) if text else 1
        bh = max(size + 9, approx * (size + 5) + 8)
        self._ensure(15 + bh + 8)
        lf = _box(self.slide, M, self.y, CW, 12)
        _para(lf, label, size=8, bold=True, color=INK3, first=True)
        self.y += 14
        bf = _box(self.slide, M, self.y, CW, bh, name="RPA::" + path)
        _para(bf, text, size=size, color=INK, first=True)
        self.y += bh + 9


def emit(deck, path, node, label):
    if node is None or isinstance(node, str):
        deck.field(".".join(path), node, label)
        return
    if isinstance(node, list):
        for i, item in enumerate(node):
            emit(deck, path + [str(i)], item, "%s %d" % (label, i + 1))
        return
    if isinstance(node, dict):
        last = path[-1] if path else ""
        if len(path) >= 2:  # sous-objet nommé ou élément de tableau → en-tête
            deck.subhead(label if not last.isdigit() else label)
        for k, v in node.items():
            if k in SKIP or str(k).startswith("_"):
                continue
            emit(deck, path + [k], v, humanize(k))


def render(data, out):
    content = data.get("content") or {}
    broker = data.get("broker") or {}
    deck = Deck(broker)

    # Chaînes de premier niveau (ex. running_title) regroupées sur une diapo « Général ».
    strs = [(k, v) for k, v in content.items() if isinstance(v, str) and not str(k).startswith("_")]
    if strs:
        deck.new_slide("Général")
        for k, v in strs:
            deck.field(k, v, humanize(k))

    # Une diapo par section (objet de premier niveau).
    for k, v in content.items():
        if str(k).startswith("_") or not isinstance(v, dict):
            continue
        deck.new_slide(humanize(k))
        for kk, vv in v.items():
            if kk in SKIP or str(kk).startswith("_"):
                continue
            emit(deck, [k, kk], vv, humanize(kk))

    deck.prs.save(out)
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
