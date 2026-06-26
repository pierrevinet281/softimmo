"""ACM — extraction des ratios APCIQ (« STATS_MUNGENRE ») depuis le PDF de statistiques.

Lit {"path", "municipality", "genre"} sur stdin, renvoie les ratios « prix de vente vs prix
inscrit » et « prix de vente vs évaluation » pour la municipalité et le genre demandés.
Déterministe : on localise la municipalité via les SIGNETS du PDF (pypdf), on lit la page
correspondante (pdfplumber) et on parse la ligne du genre. Le PDF couvre toutes les régions
pour une période — il est réutilisable pour plusieurs propriétés.

Sortie : {"sale_to_list_ratio", "sale_to_assessment_ratio", "matched_municipality",
"genre_label", "page", "period"} ou {"error"|"not_found"}.
"""
import sys
import json
import re
import unicodedata

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def norm(s):
    """minuscule, sans accents/mojibake, alphanum -> espaces compressés."""
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("�", " ")
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return s.strip()


# property.genre -> libellés candidats (normalisés) dans le PDF, par ordre de préférence.
GENRE_CANDIDATES = {
    "unifamilial": ["unifamiliale"],
    "condo": ["coprop app", "copropriete", "copropri"],
    "plex": ["duplex", "triplex", "prop revenus"],
    "multi": ["quintuplex", "quadruplex", "triplex", "duplex", "prop revenus"],
    "commercial": ["commerciale", "com ind ent", "com ind"],
    "industriel": ["industrielle", "com ind ent"],
    "terrain": ["terrain", "terre terrain"],
    "rpa": ["unifamiliale"],
    "autre": ["unifamiliale"],
}


def line_columns(num_words):
    """Regroupe des mots numériques (x-triés) en colonnes par écart en x.

    Les chiffres d'un même nombre (« 14 695 500 ») sont rapprochés (~13 px) ; les colonnes
    distinctes sont séparées de ~27 px+. Seuil 20 px → chaque colonne = un nombre entier.
    """
    # Écart intra-nombre (chiffres d'un même montant) ≈ 0-5 px ; inter-colonne ≥ ~17 px.
    cols = []
    cur = []
    last_x1 = None
    for w in num_words:
        if last_x1 is not None and (w["x0"] - last_x1) > 8:
            cols.append(cur)
            cur = []
        cur.append(w["text"])
        last_x1 = w["x1"]
    if cur:
        cols.append(cur)
    return [int("".join(c)) for c in cols]


def page_lines(page):
    """Lignes de la page : { label, norm, cols(list[int]) } regroupées par position y."""
    words = page.extract_words()
    by_top = {}
    for w in words:
        key = round(w["top"] / 3)  # bucket ~3 px
        by_top.setdefault(key, []).append(w)
    lines = []
    for key in sorted(by_top):
        ws = sorted(by_top[key], key=lambda w: w["x0"])
        label_words = [w["text"] for w in ws if re.search(r"[A-Za-z�]", w["text"])]
        num_words = [w for w in ws if re.fullmatch(r"\d+", w["text"])]
        label = " ".join(label_words)
        lines.append({"label": label, "norm": norm(label), "cols": line_columns(num_words)})
    return lines


def flatten_outline(reader):
    items = []

    def walk(node, depth):
        for it in node:
            if isinstance(it, list):
                walk(it, depth + 1)
            else:
                try:
                    pg = reader.get_destination_page_number(it)
                except Exception:
                    pg = None
                title = re.sub(r"\s*\(p\.\s*\d+\)\s*$", "", str(it.title)).strip()
                if pg is not None:
                    items.append({"title": title, "norm": norm(title), "page": pg, "depth": depth})
    walk(reader.outline, 0)
    return items


def find_municipality(items, municipality):
    q = norm(municipality)
    if not q:
        return None
    idxs = [i for i, it in enumerate(items) if it["norm"] == q and not it["norm"].startswith("total")]
    if not idxs:
        idxs = [i for i, it in enumerate(items) if q in it["norm"] and not it["norm"].startswith("total")]
    if not idxs:
        return None
    # La municipalité (niveau le plus profond homonyme, p. ex. vs la zone/MRC du même nom).
    idxs.sort(key=lambda i: (-items[i]["depth"], items[i]["page"]))
    return idxs[0]


def _row_ratio(cols):
    """cols = colonnes numériques d'une ligne de genre. Renvoie (vs_ins, vs_eval) en %.

    Période courante : [nouv, envig, nombre, volume, jsm, moyen, median, vs_ins, vs_eval]
    puis l'année précédente (mêmes 9). Repli sur l'an dernier si aucune vente courante.
    """
    if len(cols) < 9:
        return None
    vs_ins, vs_eval = cols[7], cols[8]
    if vs_ins == 0 and len(cols) >= 18:
        vs_ins = cols[16]
        vs_eval = cols[17] if vs_eval == 0 else vs_eval
    if vs_ins == 0:
        return None
    return vs_ins, vs_eval


def parse_genre_row(lines, genre, muni_norm=""):
    candidates = GENRE_CANDIDATES.get(genre, ["unifamiliale"])
    for cand in candidates:
        pre_quartier = None
        total = None
        first = None
        seen_quartier = False
        after_total = False
        for ln in lines:
            if ln["norm"].startswith("quartier"):
                seen_quartier = True
            if ln["norm"].startswith("total pour") and (not muni_norm or muni_norm in ln["norm"]):
                after_total = True
            if not ln["norm"].startswith(cand):
                continue
            r = _row_ratio(ln["cols"])
            if not r:
                continue
            hit = {"label": ln["label"], "vs_ins": r[0], "vs_eval": r[1]}
            if first is None:
                first = hit
            if not seen_quartier and pre_quartier is None:
                pre_quartier = hit   # agrégat municipal (avant le premier quartier)
            if after_total and total is None:
                total = hit          # agrégat « Total pour <muni> »
        # Préfère l'agrégat municipal (avant quartiers, ou « Total pour … »), sinon le 1er.
        chosen = pre_quartier or total or first
        if chosen:
            return chosen
    return None


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        path = payload.get("path")
        municipality = payload.get("municipality")
        genre = (payload.get("genre") or "unifamilial").lower()
        if not path or not municipality:
            print(json.dumps({"error": "path et municipality requis"}))
            return

        from pypdf import PdfReader
        import pdfplumber

        reader = PdfReader(path)
        items = flatten_outline(reader)
        mi = find_municipality(items, municipality)
        if mi is None:
            print(json.dumps({"not_found": True, "reason": f"Municipalité « {municipality} » introuvable dans les signets."}))
            return
        muni = items[mi]

        # Plage de la municipalité : de sa page jusqu'au prochain signet de niveau <= (le total
        # municipal vient après ses quartiers, donc avant la prochaine municipalité/zone).
        start = muni["page"]
        end = len(reader.pages)
        for it in items[mi + 1:]:
            if it["depth"] <= muni["depth"] and it["page"] > start:
                end = it["page"] + 1
                break
        end = min(end, len(reader.pages))

        lines = []
        period = None
        with pdfplumber.open(path) as pdf:
            for i in range(start, end):
                pg = pdf.pages[i]
                lines.extend(page_lines(pg))
                if period is None:
                    pm = re.search(r"([A-Z][a-z�]+\s*-\s*[a-z�]+\s+\d{4})", pg.extract_text() or "")
                    if pm:
                        period = pm.group(1)

        row = parse_genre_row(lines, genre, muni["norm"])
        if not row:
            print(json.dumps({"not_found": True, "reason": f"Aucune donnée de genre « {genre} » pour {muni['title']}.", "matched_municipality": muni["title"], "page": start + 1}))
            return

        print(json.dumps({
            "matched_municipality": muni["title"],
            "genre_label": row["label"],
            "page": start + 1,
            "period": period,
            "sale_to_list_ratio": round(row["vs_ins"] / 100, 4),
            "sale_to_assessment_ratio": round(row["vs_eval"] / 100, 4) if row["vs_eval"] else None,
        }, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    main()
