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
    from PIL import Image, ImageDraw
except Exception:  # noqa: BLE001
    Image = None

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

WF = "C:/Windows/Fonts"


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
    im = _cover(Image.open(path).convert("RGB"), tw, th)
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


# ───────────────────────────── Page 1 ─────────────────────────────
def page1(c, d):
    M = 36
    img = d.get("images", {})
    broker = d.get("broker", {})

    # Bannière
    bh = 96
    c.setFillColor(BLUE); c.rect(0, T(bh), PW, bh, fill=1, stroke=0)
    logo = img.get("logo")
    if logo and os.path.exists(logo):
        draw_image(c, logo, M, T(bh) + 18, 150, 60)
    else:
        c.setFillColor(WHITE); c.setFont(F_BOLD, 30); c.drawString(M, T(bh) + 36, "eXp")
        c.setFont(F_REG, 9); c.drawString(M, T(bh) + 22, "AGENCE IMMOBILIÈRE")
    tx = M + 175
    c.setFillColor(WHITE); c.setFont(F_BOLD, 24); c.drawString(tx, T(34), d.get("title", ""))
    c.setFont(F_REG, 13); c.drawString(tx, T(54), d.get("city", ""))
    c.setFont(F_REG, 13); c.drawString(tx, T(74), d.get("summary_line", ""))

    # Médaille « Propriété Sélectionnée »
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
    c.setFillColor(INK); c.setFont(F_BOLD, 16); c.drawString(M, T(ay), d.get("address", ""))
    c.setFillColor(INK2); c.setFont(F_REG, 11)
    if d.get("mls"):
        c.drawString(M, T(ay + 18), "MLS : %s" % d["mls"])
    c.setStrokeColor(LINE); c.setLineWidth(2.5); c.line(M, T(ay + 30), PW - M, T(ay + 30))

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
        c.setFillColor(BLUE_LABEL); c.rect(x, T(yt + rh), lab_w - 4, rh, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont(F_REG, 10.5)
        c.drawString(x + 10, T(yt + rh) + rh / 2 - 4, label)
        c.setFillColor(VAL); c.rect(x + lab_w, T(yt + rh), val_w, rh, fill=1, stroke=0)
        c.setFillColor(INK); c.setFont(F_REG, 10.5)
        c.drawString(x + lab_w + 10, T(yt + rh) + rh / 2 - 4, value)

    for i in range(rows):
        yt = gy + i * (rh + rgap)
        if i < len(left):
            cell(M, yt, left[i])
        if i < len(right):
            cell(M + colw + 24, yt, right[i])

    # Pied : courtier (gauche) + bloc prix rouge (droite) + barre rouge
    fy = gy + rows * (rh + rgap) + 28
    draw_image(c, broker.get("photo"), M, T(fy + 70), 70, 70, radius=4)
    bx = M + 84
    c.setFillColor(INK); c.setFont(F_BOLD, 15); c.drawString(bx, T(fy + 14), broker.get("name", ""))
    c.setFillColor(INK2); c.setFont(F_REG, 9)
    for i, ln in enumerate([broker.get("title", ""), broker.get("subtitle", ""), broker.get("agency", "")]):
        if ln:
            c.drawString(bx, T(fy + 28 + i * 12), ln)
    if broker.get("phone"):
        c.setFillColor(INK); c.setFont(F_BOLD, 9); c.drawString(bx, T(fy + 66), "T : %s" % broker["phone"])

    pbx = PW / 2 + 10; pbw = PW - M - pbx; pbh = 70
    c.setFillColor(RED); c.rect(pbx, T(fy + pbh), pbw, pbh, fill=1, stroke=0)
    price = d.get("price")
    txt = ("Prix : %s $" % format(int(price), ",d").replace(",", " ")) if price else "Prix sur demande"
    c.setFillColor(WHITE); c.setFont(F_BOLD, 26)
    c.drawCentredString(pbx + pbw / 2, T(fy + pbh) + pbh / 2 - 9, txt)
    c.setFillColor(RED); c.rect(M, T(fy + pbh + 14), PW - 2 * M, 6, fill=1, stroke=0)

    _compliance_footer(c, d)


# ───────────────────────────── Page 2 ─────────────────────────────
def page2(c, d):
    M = 36
    rooms = d.get("rooms", [])
    # Bannière rouge
    bh = 40
    c.setFillColor(RED); c.rect(0, T(bh), PW, bh, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont(F_BOLD, 18)
    c.drawString(M, T(27), d.get("headline", d.get("title", "")))

    # Description (boîte bleu clair)
    y = bh + 16
    if d.get("description"):
        dh = para(c, d["description"], M + 12, T(y) - 12, PW - 2 * M - 24, F_REG, 11, INK, leading=15, align=TA_JUSTIFY)
        c.setFillColor(HexColor("#E9EDF3"))
        c.rect(M, T(y) - (dh + 24), PW - 2 * M, dh + 24, fill=1, stroke=0)
        para(c, d["description"], M + 12, T(y) - 12, PW - 2 * M - 24, F_REG, 11, INK, leading=15, align=TA_JUSTIFY)
        y += dh + 24 + 16

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
        c.setFillColor(BLUE); c.rect(M, T(y + hh), PW - 2 * M, hh, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont(F_SB, 11)
        xs = M
        for i, htxt in enumerate(["Pièce", "Étage", "Dimension"]):
            c.drawString(xs + 10, T(y + hh) + hh / 2 - 4, htxt); xs += cw[i]
        yy = y + hh
        for ri, room in enumerate(rooms):
            c.setFillColor(VAL if ri % 2 else HexColor("#EEF1F7"))
            c.rect(M, T(yy + rh), PW - 2 * M, rh, fill=1, stroke=0)
            c.setFillColor(INK); c.setFont(F_REG, 10); xs = M
            for i in range(3):
                v = str(room[i]) if i < len(room) and room[i] is not None else ""
                c.drawString(xs + 10, T(yy + rh) + rh / 2 - 4, v); xs += cw[i]
            yy += rh

    _compliance_footer(c, d)


def _compliance_footer(c, d):
    """Mentions obligatoires (agence + courtier). LCI/OACIQ."""
    broker = d.get("broker", {})
    c.setFillColor(INK2); c.setFont(F_REG, 7)
    bits = [broker.get("name"), broker.get("agency"), broker.get("phone")]
    c.drawCentredString(PW / 2, 16, "  ·  ".join([b for b in bits if b]))


def render(data, out):
    c = canvas.Canvas(out, pagesize=letter)
    page1(c, data); c.showPage()
    page2(c, data); c.showPage()
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
