"""Polite HTTP helper shared by workers: desktop UA, timeout, retry, size cap."""
import time
import requests

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
MAX_BYTES = 2_500_000  # don't slurp huge pages


def fetch(url, timeout=15, ua=DEFAULT_UA, retries=1, headers=None, method="GET", data=None):
    """Return (status_code, text, final_url, error). Never raises.

    Supports GET and POST (pass method='POST' and a `data` dict for form posts).
    """
    h = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    }
    if headers:
        h.update(headers)
    last_err = None
    for attempt in range(retries + 1):
        try:
            if method == "POST":
                resp = requests.post(url, headers=h, data=data or {}, timeout=timeout,
                                     stream=True, allow_redirects=True)
            else:
                resp = requests.get(url, headers=h, timeout=timeout, stream=True, allow_redirects=True)
            content = b""
            for chunk in resp.iter_content(8192):
                content += chunk
                if len(content) > MAX_BYTES:
                    break
            ctype = resp.headers.get("Content-Type", "")
            enc = resp.encoding or "utf-8"
            try:
                text = content.decode(enc, errors="replace")
            except (LookupError, TypeError):
                text = content.decode("utf-8", errors="replace")
            return resp.status_code, text, str(resp.url), None
        except requests.RequestException as e:
            last_err = str(e)
            if attempt < retries:
                time.sleep(0.6 * (attempt + 1))
    return 0, "", url, last_err
