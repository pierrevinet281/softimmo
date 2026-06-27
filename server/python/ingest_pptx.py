# -*- coding: utf-8 -*-
"""Ingestion d'un PPTX édité → mise en page (layout) + CONTENU (texte) (round-trip, docs/09 b).

Niveau PROPRIÉTÉ : le courtier édite le texte ET/OU la disposition du PPTX d'une propriété ;
ce worker en extrait les positions (via pptx_to_layout) ET le texte des formes nommées
(titre/ville/résumé, adresse/MLS, prix, accroche, description, tableau des pièces), pour que
le rendu (PDF + PPTX) de CETTE propriété reflète les modifications — sans toucher au modèle.

E/S : lit {"pptx": "<chemin>"} sur stdin ; renvoie {"layout", "content", "roles"}.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation  # noqa: E402
from brochure_layout import NAME_MAP  # noqa: E402
from pptx_to_layout import build_layout  # noqa: E402


def _index(prs):
    idx = {}

    def walk(shapes):
        for sh in shapes:
            idx[sh.name] = sh
            try:
                if sh.shape_type == 6:  # GROUP
                    walk(sh.shapes)
            except Exception:  # noqa: BLE001
                pass

    for slide in prs.slides:
        walk(slide.shapes)
    return idx


def _paras(sh):
    try:
        if sh is not None and sh.has_text_frame:
            return [p.text for p in sh.text_frame.paragraphs]
    except Exception:  # noqa: BLE001
        pass
    return []


def _text(sh):
    ps = _paras(sh)
    return "\n".join(ps).strip()


def build_content(prs):
    idx = _index(prs)
    g = lambda role: idx.get(NAME_MAP.get(role))  # noqa: E731
    content = {}

    tb = g("title") or g("luxe_title")  # titre / ville / résumé (3 paragraphes)
    ps = _paras(tb)
    if ps:
        if ps[0].strip():
            content["title"] = ps[0].strip()
        if len(ps) >= 2 and ps[1].strip():
            content["city"] = ps[1].strip()
        if len(ps) >= 3 and ps[2].strip():
            content["summary_line"] = ps[2].strip()

    ps = _paras(g("address"))  # adresse + MLS
    if ps:
        if ps[0].strip():
            content["address"] = ps[0].strip()
        if len(ps) >= 2 and ps[1].strip():
            m = ps[1].strip()
            if ":" in m and m.lower().startswith("mls"):
                m = m.split(":", 1)[1].strip()
            content["mls"] = m

    pt = _text(g("price"))   # prix (texte libre : « Prix : 595 000 $ » ou « Prix sur demande »)
    if pt:
        content["price_text"] = pt
    h = _text(g("p2_title"))
    if h:
        content["headline"] = h
    d = _text(g("desc"))
    if d:
        content["description"] = d

    tab = g("table")  # tableau des pièces
    try:
        if tab is not None and tab.has_table:
            t = tab.table
            ncol = min(3, len(t.columns))
            rows = []
            for r in range(1, len(t.rows)):  # ignore l'en-tête
                cells = [t.cell(r, c).text.strip() for c in range(ncol)]
                if any(cells):
                    rows.append(cells)
            if rows:
                content["rooms"] = rows
    except Exception:  # noqa: BLE001
        pass

    return content


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
        pptx = payload.get("pptx")
        if not pptx:
            print(json.dumps({"error": "pptx requis"})); return
        layout = build_layout(pptx)
        prs = Presentation(pptx)
        content = build_content(prs)
        roles = sorted(set(list(layout.keys()) + list(content.keys())))
        _emit({"layout": layout, "content": content, "roles": roles})
    except Exception as e:  # noqa: BLE001
        import traceback
        _emit({"error": str(e), "trace": traceback.format_exc()[-600:]})


def _emit(obj):
    # Écrit l'UTF-8 explicitement (le contenu contient des accents — éviter le cp1252 Windows).
    sys.stdout.buffer.write(json.dumps(obj, ensure_ascii=False).encode("utf-8"))
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
