"""Regexes and helpers for extracting emails, phones and social links."""
import re
from urllib.parse import urlparse, parse_qs, unquote

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.IGNORECASE
)
# Obfuscated forms: "name [at] domain [dot] com", "name(at)domain.com"
OBFUSCATED_RE = re.compile(
    r"([a-zA-Z0-9._%+\-]+)\s*(?:\[at\]|\(at\)|\s+at\s+|@)\s*"
    r"([a-zA-Z0-9.\-]+)\s*(?:\[dot\]|\(dot\)|\s+dot\s+|\.)\s*([a-zA-Z]{2,})",
    re.IGNORECASE,
)
PHONE_RE = re.compile(
    r"(?:(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)\d{3}[\s.\-]?\d{3,4})"
)

SOCIAL_HOSTS = {
    "linkedin": ["linkedin.com"],
    "twitter": ["twitter.com", "x.com"],
    "facebook": ["facebook.com", "fb.com"],
    "instagram": ["instagram.com"],
    "youtube": ["youtube.com", "youtu.be"],
    "github": ["github.com"],
}

# Junk addresses we never want as "the" email.
JUNK_EMAIL_HINTS = (
    "example.com", "sentry.io", "wixpress.com", "@2x", ".png", ".jpg", ".gif",
    ".svg", ".webp", "your-email", "email@", "name@", "user@domain",
)


def find_emails(text):
    found = set()
    for m in EMAIL_RE.findall(text or ""):
        e = m.strip().strip(".").lower()
        if any(j in e for j in JUNK_EMAIL_HINTS):
            continue
        if len(e) > 100:
            continue
        found.add(e)
    for a, b, c in OBFUSCATED_RE.findall(text or ""):
        e = f"{a}@{b}.{c}".lower()
        if not any(j in e for j in JUNK_EMAIL_HINTS):
            found.add(e)
    return sorted(found)


def find_phones(text):
    out = set()
    for m in PHONE_RE.findall(text or ""):
        digits = re.sub(r"\D", "", m)
        if 7 <= len(digits) <= 15:
            out.add(m.strip())
    return sorted(out)


def classify_social(url):
    """Return (network, normalized_url) or (None, None)."""
    try:
        host = urlparse(url).netloc.lower().replace("www.", "")
    except ValueError:
        return None, None
    for net, hosts in SOCIAL_HOSTS.items():
        if any(host == h or host.endswith("." + h) for h in hosts):
            return net, url
    return None, None


def unwrap_ddg(href):
    """DuckDuckGo HTML wraps result links as /l/?uddg=<encoded>."""
    if href.startswith("//duckduckgo.com/l/") or "/l/?" in href:
        try:
            q = parse_qs(urlparse(href).query)
            if "uddg" in q:
                return unquote(q["uddg"][0])
        except (ValueError, KeyError):
            pass
    return href


def root_domain(url_or_host):
    s = (url_or_host or "").strip().lower()
    if "://" in s:
        s = urlparse(s).netloc
    s = s.replace("www.", "").split("/")[0].split(":")[0]
    return s or None
