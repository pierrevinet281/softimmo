"""Email verification worker — owned implementation.

Input  : {"emails": ["a@b.com"], "smtp": false, "from_addr": "verify@leadgen.local"}
Output : {"results": [{email,syntax,domain,mx,smtp,status,disposable,role,free,reason}]}

Levels:
  syntax  — RFC-ish local@domain shape
  mx      — domain has MX (or A) records
  smtp    — optional RCPT TO probe (off by default; can hurt sender reputation)
Status:   valid | invalid | risky | catch_all | unknown
"""
import sys
import os
import re
import smtplib
import socket

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.io import run  # noqa: E402

import dns.resolver  # noqa: E402

SYNTAX_RE = re.compile(r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)+$")

# Reference lists are supplied by Node (sourced from the DB) — no hardcoded data.
# They default to empty so the worker still runs standalone.
_mx_cache = {}


def get_mx(domain):
    if domain in _mx_cache:
        return _mx_cache[domain]
    hosts = []
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=6)
        hosts = sorted([(r.preference, str(r.exchange).rstrip(".")) for r in answers])
        hosts = [h for _, h in hosts]
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers,
            dns.exception.Timeout, Exception):
        hosts = []
    if not hosts:
        # fall back to A record (some domains accept mail on the A host)
        try:
            dns.resolver.resolve(domain, "A", lifetime=6)
            hosts = [domain]
        except Exception:
            hosts = []
    _mx_cache[domain] = hosts
    return hosts


def smtp_probe(email, domain, mx_hosts, from_addr):
    """Return (deliverable: True/False/None, catch_all: bool, reason)."""
    if not mx_hosts:
        return None, False, "no mx"
    host = mx_hosts[0]
    try:
        server = smtplib.SMTP(timeout=10)
        server.connect(host, 25)
        server.helo("leadgen.local")
        server.mail(from_addr)
        code, _ = server.rcpt(email)
        # catch-all detection: probe a random mailbox
        catch_all = False
        rand = f"zz-no-such-user-9182734@{domain}"
        code2, _ = server.rcpt(rand)
        if 200 <= code2 < 300:
            catch_all = True
        server.quit()
        if catch_all:
            return None, True, "catch-all domain"
        if 200 <= code < 300:
            return True, False, "rcpt accepted"
        if code in (450, 451, 452):
            return None, False, f"greylisted ({code})"
        return False, False, f"rcpt rejected ({code})"
    except (smtplib.SMTPException, socket.error, OSError) as e:
        return None, False, f"smtp error: {e}"


def verify_one(email, do_smtp, from_addr, refs):
    email = (email or "").strip().lower()
    res = {
        "email": email, "syntax": False, "domain": None, "mx": False,
        "smtp": None, "status": "unknown", "disposable": False, "role": False,
        "free": False, "reason": "",
    }
    if not SYNTAX_RE.match(email):
        res["status"] = "invalid"
        res["reason"] = "bad syntax"
        return res
    res["syntax"] = True
    local, domain = email.rsplit("@", 1)
    res["domain"] = domain
    res["disposable"] = domain in refs["disposable"]
    res["free"] = domain in refs["free"]
    res["role"] = local in refs["role"]

    if res["disposable"]:
        res["status"] = "risky"
        res["reason"] = "disposable domain"
        return res

    mx = get_mx(domain)
    res["mx"] = bool(mx)
    if not mx:
        res["status"] = "invalid"
        res["reason"] = "no mail server"
        return res

    if do_smtp:
        deliverable, catch_all, reason = smtp_probe(email, domain, mx, from_addr)
        res["reason"] = reason
        if catch_all:
            res["status"] = "catch_all"
        elif deliverable is True:
            res["smtp"] = True
            res["status"] = "valid"
        elif deliverable is False:
            res["smtp"] = False
            res["status"] = "invalid"
        else:
            res["status"] = "risky"
    else:
        # Without SMTP we can only assert syntax+MX -> treat as risky/role-aware.
        res["status"] = "risky" if res["role"] else "valid"
        res["reason"] = "syntax+mx ok (no smtp probe)"
    return res


def handler(data):
    emails = data.get("emails") or ([data["email"]] if data.get("email") else [])
    do_smtp = bool(data.get("smtp", False))
    from_addr = data.get("from_addr", "verify@leadgen.local")
    refs = {
        "disposable": set(x.lower() for x in (data.get("disposable") or [])),
        "free": set(x.lower() for x in (data.get("free") or [])),
        "role": set(x.lower() for x in (data.get("role") or [])),
    }
    return {"results": [verify_one(e, do_smtp, from_addr, refs) for e in emails]}


if __name__ == "__main__":
    run(handler)
