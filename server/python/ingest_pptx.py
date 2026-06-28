# -*- coding: utf-8 -*-
"""Ingestion d'un PPTX standard édité → layout + CONTENU (round-trip granulaire, docs/09 b).

Relit les formes nommées « STD::<slot> » (texte éditable + position) et « STDp::<slot> »
(position seule) écrites par render_brochure_pptx.py (taxonomie : brochure_slots) et renvoie, pour
CETTE propriété/variante :
- layout  : { slot: [x, y, w, h] } (pt PPTX, haut-gauche) pour CHAQUE élément déplacé ;
- content : surcharges de texte (titre/ville/résumé, adresse/MLS, prix, accroche, description,
            tableau des pièces) + images remplacées (hero/map/intérieurs/photo courtier).
Le rendu (PDF + PPTX) reflète ces éditions sans toucher au code. Déterministe, sans IA.

E/S : lit {"pptx": "<chemin>", "images_dir": "<dir?>"} sur stdin ; renvoie {"layout","content","roles"}.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation  # noqa: E402
from brochure_slots import extract_slots  # noqa: E402

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
try:
    with open(os.path.join(ASSETS, "_placeholder.png"), "rb") as _f:
        PLACEHOLDER_BYTES = _f.read()
except Exception:  # noqa: BLE001
    PLACEHOLDER_BYTES = b""


def _emit(obj):
    # UTF-8 explicite (le contenu contient des accents — éviter le cp1252 Windows).
    sys.stdout.buffer.write(json.dumps(obj, ensure_ascii=False).encode("utf-8"))
    sys.stdout.buffer.flush()


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
        pptx = payload.get("pptx")
        if not pptx:
            _emit({"error": "pptx requis"}); return
        prs = Presentation(pptx)
        content, layout = extract_slots(prs, images_dir=payload.get("images_dir"),
                                        placeholder_bytes=PLACEHOLDER_BYTES)
        roles = sorted(set(list(layout.keys()) + list(content.keys())))
        _emit({"layout": layout, "content": content, "roles": roles})
    except Exception as e:  # noqa: BLE001
        import traceback
        _emit({"error": str(e), "trace": traceback.format_exc()[-600:]})


if __name__ == "__main__":
    main()
