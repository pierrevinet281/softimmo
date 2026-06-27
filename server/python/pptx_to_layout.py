# -*- coding: utf-8 -*-
"""Convertit un gabarit PowerPoint édité → mise en page JSON (round-trip, docs/09).

Le courtier ajuste les positions dans PowerPoint puis téléverse le .pptx : ce worker lit
les formes (par NOM, via NAME_MAP), reconstruit une mise en page partielle et l'écrit dans
`layouts/<template>.json`. Les deux moteurs (PDF + jumeau PPTX) la liront ensuite — sans
toucher au code. Seuls les rôles RÉELLEMENT trouvés sont écrits (fusion avec les défauts).

E/S : lit {"pptx": "<chemin>", "out": "<chemin.json>"} sur stdin ; renvoie {"path", "roles"}.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_pptx_layout import extract  # noqa: E402
from brochure_layout import NAME_MAP  # noqa: E402

SIMPLE_ROLES = [
    "banner", "logo", "title", "hero", "map", "medal", "address", "rule", "price",
    "broker_photo", "broker_text", "bottom_bar", "p2_title", "desc", "table",
    "hero2", "broker2_text", "qr", "luxe_title", "luxe_lock",
]


def build_layout(pptx_path):
    data = extract(pptx_path)
    idx = {}

    def walk(shapes):
        for sh in shapes:
            idx[sh["name"]] = sh
            if sh.get("children"):
                walk(sh["children"])

    for slide in data["slides"]:
        walk(slide)

    def box(role):
        name = NAME_MAP.get(role)
        sh = idx.get(name) if name else None
        if not sh or sh.get("x") is None:
            return None
        return [sh["x"], sh["y"], sh["w"], sh["h"]]

    layout = {}
    for role in SIMPLE_ROLES:
        b = box(role)
        if b:
            layout[role] = b

    photos = [box("photo1"), box("photo2"), box("photo3")]
    if all(photos):
        layout["photos"] = photos

    cl, cv = box("grid_c1_label"), box("grid_c1_value")
    cl2, cv2 = box("grid_c2_label"), box("grid_c2_value")
    cl2r1 = box("grid_c2_label_r1")
    if cl and cv and cl2 and cv2:
        grid = {
            "cols": [[cl[0], cl[2], cv[0], cv[2]], [cl2[0], cl2[2], cv2[0], cv2[2]]],
            "row0_y": cl2[1], "h": cl2[3],
        }
        if cl2r1:
            grid["pitch"] = round(cl2r1[1] - cl2[1], 3)
        layout["grid"] = grid

    return layout


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
        pptx = payload.get("pptx"); out = payload.get("out")
        if not pptx:
            print(json.dumps({"error": "pptx requis"})); return
        layout = build_layout(pptx)
        if not layout:
            print(json.dumps({"error": "Aucune forme reconnue dans le gabarit (noms inattendus)."})); return
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
