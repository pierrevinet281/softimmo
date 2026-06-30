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
    "hospitals":   ['amenity=hospital', 'amenity=clinic'],
    "schools":     ['amenity=school', 'amenity=university', 'amenity=college'],
    "childcare":   ['amenity=kindergarten', 'amenity=childcare'],
    "groceries":   ['shop=supermarket', 'shop=grocery', 'shop=convenience'],
    "restaurants": ['amenity=restaurant', 'amenity=fast_food', 'amenity=cafe'],
    "sports":      ['leisure=sports_centre', 'leisure=fitness_centre', 'amenity=gym', 'leisure=fitness_station'],
    "parks":       ['leisure=park'],
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
    try:
        if lat is None or lon is None:
            g = geocode(payload.get("address"), payload.get("city"), payload.get("region"))
            if not g:
                print(json.dumps({"error": "geocoding introuvable"}))
                return
            lat, lon, display = g
            time.sleep(1)  # politesse Nominatim (max 1 req/s)
        lat, lon = float(lat), float(lon)

        ql = overpass_query(lat, lon, radius_m, road_radius_m)
        raw = _get(OVERPASS, data=urllib.parse.urlencode({"data": ql}).encode("utf-8"), timeout=60)
        elements = json.loads(raw).get("elements", [])
    except Exception as e:  # réseau indisponible, quotas, etc.
        print(json.dumps({"error": f"OSM indisponible: {e}"}))
        return

    cats = {c: {"count": 0, "nearest": None} for c in CATS}
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
        cur = cats[cat]["nearest"]
        if nm and (cur is None or dist < cur["dist_m"]):
            cats[cat]["nearest"] = {"name": nm, "dist_m": dist}

    road_list = sorted(roads.values(), key=lambda r: r["dist_m"])[:6]
    print(json.dumps({
        "lat": lat, "lon": lon, "display_name": display,
        "radius_m": radius_m, "road_radius_m": road_radius_m,
        "categories": cats, "roads": road_list,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
