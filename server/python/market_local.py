#!/usr/bin/env python3
"""Analyse de marché — couche locale (secteur) via données ouvertes gratuites.

Lit {"address","city","region","lat"?,"lon"?,"radius_m"?} sur stdin.
1) Géocode l'adresse via Nominatim (OpenStreetMap) si lat/lon absents.
2) Interroge Overpass (OpenStreetMap, ODbL) pour les commodités du secteur + accès routiers.
Renvoie {"lat","lon","display_name","radius_m","categories":{...},"roads":[...]} sur stdout.
Aucune clé API. En cas d'échec réseau : {"error": "..."} (le serveur retombe sur l'analyse de base).
"""
import sys
import json
import math
import time
import urllib.parse
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

UA = "Softimmo/1.0 (analyse de marche immobilier; contact: courtier)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
OVERPASS = "https://overpass-api.de/api/interpreter"

# Catégories OSM : clé interne -> liste de filtres Overpass (tag=value).
CATS = {
    "groceries":   ['shop=supermarket', 'shop=grocery', 'shop=convenience'],
    "pharmacy":    ['amenity=pharmacy', 'shop=chemist'],
    "gas":         ['amenity=fuel'],
    "restaurants": ['amenity=restaurant', 'amenity=fast_food', 'amenity=cafe'],
    "schools":     ['amenity=school', 'amenity=university', 'amenity=college'],
    "childcare":   ['amenity=kindergarten', 'amenity=childcare'],
    "hospitals":   ['amenity=hospital', 'amenity=clinic'],
    "parks":       ['leisure=park'],
    "sports":      ['leisure=sports_centre', 'leisure=fitness_centre', 'amenity=gym', 'leisure=fitness_station'],
}
ROAD_TYPES = ['motorway', 'trunk', 'primary']  # axes structurants


def _get(url, data=None, timeout=45):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def _geocode_one(q):
    url = NOMINATIM + "?" + urllib.parse.urlencode({"q": q, "format": "json", "limit": 1, "countrycodes": "ca"})
    out = json.loads(_get(url, timeout=30))
    if not out:
        return None
    return float(out[0]["lat"]), float(out[0]["lon"]), out[0].get("display_name", "")


def geocode(address, city, region):
    # Du plus précis au moins précis : adresse exacte → ville → ville+région. Nominatim échoue
    # souvent sur l'adresse civique exacte au Québec ; on retombe alors sur le centre municipal.
    candidates = []
    if address and city:
        candidates.append(f"{address}, {city}, Québec, Canada")
    if city:
        candidates.append(f"{city}, Québec, Canada")
    if city and region:
        candidates.append(f"{city}, {region}, Canada")
    for i, q in enumerate(candidates):
        try:
            r = _geocode_one(q)
        except Exception:
            r = None
        if r:
            return r
        if i < len(candidates) - 1:
            time.sleep(1)  # politesse Nominatim entre tentatives
    return None


def haversine(la1, lo1, la2, lo2):
    r = 6371000.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1)
    dl = math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def overpass_query(lat, lon, radius_m, road_radius_m):
    parts = []
    for filters in CATS.values():
        for f in filters:
            k, v = f.split("=", 1)
            parts.append(f'nwr["{k}"="{v}"](around:{radius_m},{lat},{lon});')
    for rt in ROAD_TYPES:
        parts.append(f'way["highway"="{rt}"](around:{road_radius_m},{lat},{lon});')
    return "[out:json][timeout:40];(" + "".join(parts) + ");out center tags;"


def classify(tags):
    for cat, filters in CATS.items():
        for f in filters:
            k, v = f.split("=", 1)
            if tags.get(k) == v:
                return cat
    return None


WIKI_FR = "https://fr.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"


def _wiki(host, params):
    return json.loads(_get(host + "?" + urllib.parse.urlencode(params), timeout=20))


import re as _re
_MAP_RX = _re.compile(r"(location|locator|_map|carte|_in_)", _re.I)
_BAD_RX = _re.compile(r"(flag|drapeau|blason|coat|arms|logo|sceau|seal|icon|wikidata|commons|edit-|symbol|\.ogg)", _re.I)
_RAST_RX = _re.compile(r"\.(jpg|jpeg|png)$", _re.I)


def _imginfo(fn):
    """Info Commons d'un fichier + filtre licence STRICT (usage commercial : CC0/domaine public/
    CC-BY/CC-BY-SA ; rejet NC/ND/inconnu). Renvoie {url,license,credit} ou None."""
    try:
        d = _wiki(COMMONS, {"action": "query", "format": "json", "titles": "File:" + fn,
                            "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": "700",
                            "iiextmetadatafilter": "LicenseShortName|Artist"})
        p = next(iter(d["query"]["pages"].values()))
        ii = p.get("imageinfo")
        if not ii:
            return None
        info = ii[0]; em = info.get("extmetadata", {})
        lic = (em.get("LicenseShortName") or {}).get("value")
        art = (em.get("Artist") or {}).get("value")
        credit = _re.sub("<[^>]+>", "", art).strip()[:80] if art else None
        ll = (lic or "").lower()
        if not any(k in ll for k in ["cc0", "public domain", "cc by", "cc-by", "attribution"]):
            return None
        if "nc" in ll or "-nd" in ll or "noderiv" in ll:
            return None
        return {"url": info.get("thumburl") or info.get("url"), "license": lic, "credit": credit}
    except Exception:
        return None


def _page_images(title):
    for host in (WIKI_FR, "https://en.wikipedia.org/w/api.php"):
        try:
            d = _wiki(host, {"action": "query", "format": "json", "redirects": "1", "titles": title,
                             "prop": "images", "imlimit": "40"})
            p = next(iter(d["query"]["pages"].values()))
            ims = p.get("images")
            if ims:
                return [i["title"].split(":", 1)[1] for i in ims if ":" in i["title"]]
        except Exception:
            pass
    return []


def entity_photo(*titles):
    """Photo landmark (RASTER, non-carte/drapeau) d'un article Wikipédia, licence commerciale OK.
    Borné (max ~4 vérifications) pour rester dans le budget temps."""
    for title in titles:
        tried = 0
        for fn in _page_images(title):
            if _RAST_RX.search(fn) and not _BAD_RX.search(fn) and not _MAP_RX.search(fn):
                info = _imginfo(fn)
                if info:
                    return info
                tried += 1
                if tried >= 4:
                    break
    return None


def autoroute_sign(name):
    """Écusson d'autoroute du Québec depuis Wikimedia Commons (domaine public)."""
    import re as _re
    m = _re.search(r"(\d+)", str(name))
    if not m:
        return None
    try:
        d = _wiki(COMMONS, {"action": "query", "format": "json", "iiprop": "url", "iiurlwidth": "96",
                            "titles": f"File:Quebec Autoroute {m.group(1)}.svg", "prop": "imageinfo"})
        p = next(iter(d["query"]["pages"].values()))
        if "imageinfo" in p:
            return p["imageinfo"][0].get("thumburl") or p["imageinfo"][0].get("url")
    except Exception:
        pass
    return None


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except Exception:
        payload = {}
    radius_m = int(payload.get("radius_m") or 2500)
    road_radius_m = int(payload.get("road_radius_m") or 6000)

    lat = payload.get("lat")
    lon = payload.get("lon")
    display = payload.get("display_name", "")
    # 1) Géocodage (requis) — seul échec fatal (sans coordonnées, rien n'est possible).
    try:
        if lat is None or lon is None:
            g = geocode(payload.get("address"), payload.get("city"), payload.get("region"))
            if not g:
                print(json.dumps({"error": "geocoding introuvable"}))
                return
            lat, lon, display = g
            time.sleep(1)  # politesse Nominatim (max 1 req/s)
        lat, lon = float(lat), float(lon)
    except Exception as e:
        print(json.dumps({"error": f"géocodage indisponible: {e}"}))
        return

    # 2) POI OSM/Overpass (best-effort) — un échec (504, quota) n'empêche PAS le reste (cartes/photos).
    elements = []; osm_ok = False
    try:
        ql = overpass_query(lat, lon, radius_m, road_radius_m)
        raw = _get(OVERPASS, data=urllib.parse.urlencode({"data": ql}).encode("utf-8"), timeout=60)
        elements = json.loads(raw).get("elements", [])
        osm_ok = True
    except Exception:
        elements = []; osm_ok = False

    cats = {c: {"count": 0, "items": [], "nearest": None} for c in CATS}
    roads = {}
    for el in elements:
        tags = el.get("tags", {}) or {}
        c = el.get("center") or {}
        plat = el.get("lat", c.get("lat"))
        plon = el.get("lon", c.get("lon"))
        if plat is None or plon is None:
            continue
        dist = round(haversine(lat, lon, float(plat), float(plon)))
        hw = tags.get("highway")
        if hw in ROAD_TYPES:
            name = tags.get("ref") or tags.get("name")
            if not name:
                continue
            cur = roads.get(name)
            if not cur or dist < cur["dist_m"]:
                roads[name] = {"name": name, "type": hw, "dist_m": dist}
            continue
        cat = classify(tags)
        if not cat:
            continue
        cats[cat]["count"] += 1
        nm = tags.get("name") or tags.get("operator")
        if nm:
            cats[cat]["items"].append({"name": nm, "dist_m": dist, "lat": round(float(plat), 6), "lon": round(float(plon), 6)})

    # Top 5 par catégorie (par distance) + plus proche.
    for c in cats.values():
        c["items"].sort(key=lambda x: x["dist_m"])
        c["items"] = c["items"][:5]
        c["nearest"] = c["items"][0] if c["items"] else None

    road_list = sorted(roads.values(), key=lambda r: r["dist_m"])[:6]
    # Écussons d'autoroute (best-effort) + photos de ville/région (Wikipédia, best-effort).
    for r in road_list:
        if r.get("type") == "motorway":
            s = autoroute_sign(r["name"])
            if s:
                r["sign"] = s
    # Imagerie par entité : carte de contour/localisation (Commons) + photo landmark (Wikipédia).
    images = {}
    city = payload.get("city"); region = payload.get("region"); mrc = payload.get("mrc")
    if city:
        ph = entity_photo(city, f"{city} (Québec)")
        if ph:
            images["municipality"] = {"map": None, "photo": ph}
    if mrc:
        mp = _imginfo(f"Quebec MRC {mrc} location map.svg")
        ph = entity_photo(f"{mrc} (municipalité régionale de comté)", f"MRC de {mrc}", mrc)
        if mp or ph:
            images["mrc"] = {"map": mp, "photo": ph}
    if region:
        mp = _imginfo(f"{region} in Quebec.svg") or _imginfo(f"Quebec {region} location map.svg")
        ph = entity_photo(f"{region} (région administrative)", region)
        if mp or ph:
            images["region"] = {"map": mp, "photo": ph}

    print(json.dumps({
        "lat": lat, "lon": lon, "display_name": display,
        "radius_m": radius_m, "road_radius_m": road_radius_m,
        "categories": cats if osm_ok else {}, "roads": road_list if osm_ok else [], "images": images,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
