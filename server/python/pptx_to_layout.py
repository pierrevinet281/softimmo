# -*- coding: utf-8 -*-
"""Convertit un gabarit PowerPoint standard édité → mise en page JSON (round-trip granulaire, docs/09).

Relit les positions de CHAQUE forme nommée « STD::/STDp:: » (taxonomie : brochure_slots) et écrit
un layout { slot: [x, y, w, h] } (pt PPTX, haut-gauche) dans layouts/<template>.json (niveau
MODÈLE) ou le renvoie en ligne (niveau propriété). Les deux moteurs (PDF + jumeau PPTX) le liront
ensuite — sans toucher au code. Déterministe, sans IA.

E/S : lit {"pptx": "<chemin>", "out": "<chemin.json?>"} sur stdin ; renvoie {"path","roles"} (out)
ou {"layout","roles"} (en ligne).
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation  # noqa: E402
from brochure_slots import extract_slots  # noqa: E402


def build_layout(pptx_path):
    """Positions par slot d'un PPTX standard édité (layout granulaire, sans le contenu)."""
    prs = Presentation(pptx_path)
    _content, layout = extract_slots(prs)
    return layout


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
        pptx = payload.get("pptx"); out = payload.get("out")
        if not pptx:
            print(json.dumps({"error": "pptx requis"})); return
        layout = build_layout(pptx)
        if not layout:
            print(json.dumps({"error": "Aucune forme STD:: reconnue dans le gabarit (noms inattendus)."})); return
        if out:  # niveau MODÈLE : écriture dans layouts/<template>.json
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "w", encoding="utf-8") as f:
                json.dump(layout, f, ensure_ascii=False, indent=2)
            print(json.dumps({"path": out, "roles": sorted(layout.keys())}))
        else:  # niveau PROPRIÉTÉ : renvoi en ligne (stocké en DB par l'appelant)
            print(json.dumps({"layout": layout, "roles": sorted(layout.keys())}))
    except Exception as e:  # noqa: BLE001
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()[-600:]}))


if __name__ == "__main__":
    main()
