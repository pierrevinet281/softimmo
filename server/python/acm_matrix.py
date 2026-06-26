"""ACM — extraction des comparables d'un PDF Matrix « 4 par page courtier ».

Lit {"path": "<fichier.pdf>"} sur stdin, renvoie {"comparables": [...]} sur stdout.
Déterministe (pdfplumber, sans IA). Le format Matrix est régulier : chaque comparable
commence par une ligne « <PRIX> $ No Centris <NUMERO>(<CODE>) ». On localise ces en-têtes,
on découpe le texte en blocs entre deux en-têtes, puis on extrait les champs par regex.

Repli : si pdfplumber échoue, renvoie {"error": "..."} (le serveur gère l'erreur).
"""
import sys
import json
import re

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Espaces (normaux + insécables) utilisés comme séparateurs de milliers.
SP = "  \t"
# Nombre sur une seule ligne (chiffres + espaces, PAS de saut de ligne).
PRICE = r"\d[\d" + SP + r"]*"
# Nombre pouvant inclure des espaces (multi-ligne tolérée pour les libellés internes).
NUM = r"[\d\s ]+"
HEADER = re.compile(r"(" + PRICE + r")\$\s*No Centris\s*(\d+)\((\w+)\)")


def _int(s):
    if s is None:
        return None
    d = re.sub(r"[^\d]", "", s)
    return int(d) if d else None


def _search(pat, text, group=1, flags=0):
    m = re.search(pat, text, flags)
    return m.group(group) if m else None


def _kind(code):
    c = (code or "").upper()
    if c.startswith("VE"):
        return "sold"
    if c.startswith("EX"):
        return "expired"
    return "active"  # EV / en vigueur / autres


def _inclusions(block):
    """Détection best-effort des inclusions avec quantités (docs/12)."""
    incl = {}
    low = block.lower()

    g = re.search(r"garage\s*\((\d+)\)", low)
    if g:
        incl["garage"] = int(g.group(1))
    elif "garage" in low:
        incl["garage"] = 1

    p = re.search(r"(\d+)\s*piscines?", low)
    if "piscine" in low:
        qty = int(p.group(1)) if p else 1
        key = "piscine_hors_terre" if "hors" in low else "piscine_creusee"
        incl[key] = qty

    f = re.search(r"(\d+)\s*foyers?", low)
    if "foyer" in low or "poele" in low or "po�le" in low:
        incl["foyer"] = int(f.group(1)) if f else 1

    if "spa" in low:
        incl["spa"] = 1
    if "climatis" in low:
        incl["climatisation"] = 1
    if "thermopompe" in low:
        incl["thermopompe"] = 1
    if re.search(r"sous-?sol[^.]*fini", low):
        incl["sous_sol_fini"] = 1
    if "abri" in low and "auto" in low:
        incl["abri_auto"] = 1
    return incl


def parse_block(block, price, centris_no, code):
    kind = _kind(code)

    addr = city = postal = None
    am = re.search(r"\n\s*(.+?),\s*([^,\n]+?),\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d)", block)
    if am:
        addr, city, postal = am.group(1).strip(), am.group(2).strip(), am.group(3).strip()

    list_price = _int(_search(r"Dernier prix\s*(" + NUM + r")\$", block))
    original_price = _int(_search(r"Prix original\s*(" + NUM + r")\$", block))
    inscription = _search(r"Inscription\s*(\d{4}-\d{2}-\d{2})", block)

    sale_date = None
    dom = None
    vm = re.search(r"Vendu[^\n]*?(\d{4}-\d{2})(?:[^\n]*?,\s*(\d+)\s*j)?", block)
    if vm:
        sale_date = vm.group(1) + "-01"
        dom = _int(vm.group(2))

    year_built = _int(_search(r"Cons\.\s*(\d{4})", block))
    livable_area = _int(_search(r"Sup\. hab\.\s*(" + NUM + r")pc", block))
    lot_area = _int(_search(r"Sup\. ter\.\s*(" + NUM + r")pc", block))
    assessment = _int(_search(r"val\. tot\.\s*\(\d{4}\)\s*(" + NUM + r")\$", block))

    bedrooms = None
    cac = _search(r"CAC\s*([\d+]+)", block)
    if cac:
        bedrooms = sum(int(x) for x in re.findall(r"\d+", cac))

    sold_price = price if kind == "sold" else None
    if kind != "sold" and not list_price:
        list_price = price

    return {
        "centris_no": centris_no,
        "kind": kind,
        "address": addr,
        "city": city,
        "postal_code": postal,
        "price": price,
        "sold_price": sold_price,
        "list_price": list_price,
        "original_price": original_price,
        "date": inscription,
        "sale_date": sale_date,
        "days_on_market": dom,
        "year_built": year_built,
        "livable_area": livable_area,
        "area": lot_area,
        "municipal_assessment": assessment,
        "bedrooms": bedrooms,
        "inclusions": _inclusions(block),
        "source": "Matrix PDF",
    }


def extract(path):
    import pdfplumber
    parts = []
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            parts.append(pg.extract_text() or "")
    text = "\n".join(parts)

    matches = list(HEADER.finditer(text))
    comps = []
    for i, mt in enumerate(matches):
        start = mt.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start:end]
        rec = parse_block(block, _int(mt.group(1)), mt.group(2), mt.group(3))
        if rec:
            comps.append(rec)
    return comps


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        path = payload.get("path")
        if not path:
            print(json.dumps({"error": "path requis"}))
            return
        comps = extract(path)
        print(json.dumps({"comparables": comps, "count": len(comps)}, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    main()
