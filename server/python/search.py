"""Web search worker — multi-provider, resilient, free-first.

Input  : {
  "queries": ["..."], "limit": 8,
  "engines": ["google_cse","duckduckgo","bing","mojeek","searxng"],
  "cse_key": "...", "cse_cx": "...",       # optional Google Programmable Search
  "searx_url": "https://searx.example"     # optional self-host / instance
}
Output : {"results": [{"query","url","title","snippet","engine","rank"}], "errors":[...]}

Owned re-implementation of the original Colab `google` step. Free scrapers
(DuckDuckGo/Bing/Mojeek) are best-effort and degrade gracefully; Google CSE and
SearXNG (keyed/self-host) are reliable. The enrichment engine never depends on
search alone — direct domain crawl + email-pattern + verify work without it.
"""
import sys
import os
import time
import json
from urllib.parse import quote_plus

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.io import run  # noqa: E402
from shared.net import fetch  # noqa: E402
from shared.patterns import unwrap_ddg  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

DDG_LITE = "https://lite.duckduckgo.com/lite/"
DDG_HTML = "https://html.duckduckgo.com/html/"
BING_URL = "https://www.bing.com/search?q={q}&count={n}&setlang=en"
MOJEEK_URL = "https://www.mojeek.com/search?q={q}"
CSE_URL = "https://www.googleapis.com/customsearch/v1?key={k}&cx={cx}&q={q}&num={n}"

BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}


def _abs(url):
    if url and url.startswith("//"):
        return "https:" + url
    return url


def search_duckduckgo(query, limit):
    """DuckDuckGo via POST. Try the lite endpoint (clean to parse) then html."""
    # 1) lite endpoint — results are plain <a class="result-link"> in a table
    status, html, _, err = fetch(DDG_LITE, timeout=15, method="POST",
                                 data={"q": query, "kl": "us-en"})
    if status == 200 and html:
        soup = BeautifulSoup(html, "html.parser")
        out = []
        for a in soup.select("a.result-link"):
            href = unwrap_ddg(_abs(a.get("href", "")))
            if not href or not href.startswith("http"):
                continue
            out.append({"url": href, "title": a.get_text(" ", strip=True), "snippet": ""})
            if len(out) >= limit:
                break
        if out:
            return out, None

    # 2) html endpoint fallback
    status, html, _, err2 = fetch(DDG_HTML, timeout=15, method="POST",
                                  data={"q": query, "kl": "us-en"})
    if status != 200 or not html:
        return [], (err2 or err or f"status {status}")
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.select("a.result__a"):
        href = unwrap_ddg(_abs(a.get("href", "")))
        if not href or not href.startswith("http"):
            continue
        snippet = ""
        block = a.find_parent(class_="result")
        if block:
            s = block.select_one(".result__snippet")
            if s:
                snippet = s.get_text(" ", strip=True)
        out.append({"url": href, "title": a.get_text(" ", strip=True), "snippet": snippet})
        if len(out) >= limit:
            break
    return out, None


def search_bing(query, limit):
    status, html, _, err = fetch(BING_URL.format(q=quote_plus(query), n=limit),
                                 timeout=15, headers=BROWSER_HEADERS)
    if status != 200 or not html:
        return [], err or f"status {status}"
    if "captcha" in html.lower():
        return [], "captcha/blocked"
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for li in soup.select("li.b_algo"):
        a = li.select_one("h2 a")
        if not a or not a.get("href", "").startswith("http"):
            continue
        p = li.select_one(".b_caption p")
        out.append({"url": a["href"], "title": a.get_text(" ", strip=True),
                    "snippet": p.get_text(" ", strip=True) if p else ""})
        if len(out) >= limit:
            break
    return out, None


def search_mojeek(query, limit):
    status, html, _, err = fetch(MOJEEK_URL.format(q=quote_plus(query)),
                                 timeout=15, headers=BROWSER_HEADERS)
    if status != 200 or not html:
        return [], err or f"status {status}"
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.select("ul.results-standard li a.title, a.ob, .results a.title"):
        href = a.get("href", "")
        if not href.startswith("http"):
            continue
        out.append({"url": href, "title": a.get_text(" ", strip=True), "snippet": ""})
        if len(out) >= limit:
            break
    return out, None


def search_google_cse(query, limit, key, cx):
    if not key or not cx:
        return [], "missing cse_key/cse_cx"
    url = CSE_URL.format(k=key, cx=cx, q=quote_plus(query), n=min(limit, 10))
    status, body, _, err = fetch(url, timeout=15)
    if status != 200 or not body:
        return [], err or f"status {status}"
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return [], "invalid cse json"
    out = [{"url": it.get("link"), "title": it.get("title", ""), "snippet": it.get("snippet", "")}
           for it in data.get("items", []) if it.get("link")]
    return out[:limit], None


def search_searxng(query, limit, base_url):
    if not base_url:
        return [], "missing searx_url"
    url = f"{base_url.rstrip('/')}/search?q={quote_plus(query)}&format=json"
    status, body, _, err = fetch(url, timeout=15, headers=BROWSER_HEADERS)
    if status != 200 or not body:
        return [], err or f"status {status}"
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return [], "searx returned non-json (json output disabled?)"
    out = [{"url": r.get("url"), "title": r.get("title", ""), "snippet": r.get("content", "")}
           for r in data.get("results", []) if r.get("url")]
    return out[:limit], None


def build_engines(data):
    """Return ordered list of (name, callable(query, limit))."""
    key, cx = data.get("cse_key"), data.get("cse_cx")
    searx = data.get("searx_url")
    registry = {
        "google_cse": lambda q, n: search_google_cse(q, n, key, cx),
        "searxng": lambda q, n: search_searxng(q, n, searx),
        "duckduckgo": search_duckduckgo,
        "bing": search_bing,
        "mojeek": search_mojeek,
    }
    # Default order prefers reliable keyed providers when configured.
    requested = data.get("engines")
    if not requested:
        requested = []
        if key and cx:
            requested.append("google_cse")
        if searx:
            requested.append("searxng")
        requested += ["duckduckgo", "bing", "mojeek"]
    return [(name, registry[name]) for name in requested if name in registry]


def handler(data):
    queries = data.get("queries") or ([data["query"]] if data.get("query") else [])
    limit = int(data.get("limit", 8))
    delay = float(data.get("delay", 1.2))
    engines = build_engines(data)

    results = []
    errors = []
    seen = set()
    for qi, query in enumerate(queries):
        got_for_query = 0
        for eng, fn in engines:
            items, err = fn(query, limit)
            if err:
                errors.append({"query": query, "engine": eng, "error": err})
            for rank, it in enumerate(items):
                key = it["url"].split("#")[0]
                if key in seen:
                    continue
                seen.add(key)
                results.append({
                    "query": query, "url": it["url"], "title": it.get("title", ""),
                    "snippet": it.get("snippet", ""), "engine": eng, "rank": rank,
                })
                got_for_query += 1
            if got_for_query > 0:
                # one engine succeeded for this query; that's enough
                break
        if qi < len(queries) - 1:
            time.sleep(delay)
    return {"results": results, "errors": errors, "count": len(results)}


if __name__ == "__main__":
    run(handler)
