"""Page extraction worker — fetch URLs and pull emails, phones, social links, meta.

Input  : {"urls": ["..."], "max_chars": 4000}
Output : {"pages": [{url,status,final_url,title,description,emails,phones,socials,text}]}

Owned re-implementation of the original Colab "fetch + BeautifulSoup + extract emails" step.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.io import run  # noqa: E402
from shared.net import fetch  # noqa: E402
from shared.patterns import find_emails, find_phones, classify_social  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402


def extract_page(url, max_chars, timeout):
    status, html, final_url, err = fetch(url, timeout=timeout)
    page = {
        "url": url, "final_url": final_url, "status": status,
        "title": None, "description": None,
        "emails": [], "phones": [], "socials": {}, "text": "", "error": err,
    }
    if status != 200 or not html:
        return page

    soup = BeautifulSoup(html, "html.parser")

    if soup.title and soup.title.string:
        page["title"] = soup.title.string.strip()[:300]
    md = soup.find("meta", attrs={"name": "description"}) or \
        soup.find("meta", attrs={"property": "og:description"})
    if md and md.get("content"):
        page["description"] = md["content"].strip()[:500]

    # mailto + visible text emails
    emails = set()
    for a in soup.select('a[href^="mailto:"]'):
        addr = a.get("href", "")[7:].split("?")[0].strip().lower()
        if "@" in addr:
            emails.add(addr)

    # social links
    socials = {}
    for a in soup.select("a[href]"):
        net, u = classify_social(a.get("href", ""))
        if net and net not in socials:
            socials[net] = u.split("?")[0]

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)

    emails.update(find_emails(text))
    emails.update(find_emails(html))  # catch emails only present in markup
    page["emails"] = sorted(emails)
    page["phones"] = find_phones(text)[:10]
    page["socials"] = socials
    page["text"] = text[:max_chars]
    return page


def handler(data):
    urls = data.get("urls") or ([data["url"]] if data.get("url") else [])
    max_chars = int(data.get("max_chars", 4000))
    timeout = int(data.get("timeout", 15))
    pages = [extract_page(u, max_chars, timeout) for u in urls]

    # Aggregate convenience roll-up across all pages.
    all_emails, all_phones, all_socials = set(), set(), {}
    for p in pages:
        all_emails.update(p["emails"])
        all_phones.update(p["phones"])
        for k, v in p["socials"].items():
            all_socials.setdefault(k, v)
    return {
        "pages": pages,
        "aggregate": {
            "emails": sorted(all_emails),
            "phones": sorted(all_phones),
            "socials": all_socials,
        },
    }


if __name__ == "__main__":
    run(handler)
