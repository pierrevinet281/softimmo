"""Shared stdin/stdout JSON contract for Lead Gen Python workers.

Each worker reads one JSON object from stdin and writes one JSON object to stdout.
This keeps the Node<->Python bridge dead simple and language-agnostic.
"""
import sys
import json

# Force UTF-8 on the JSON pipe. Windows consoles default to cp1252, which cannot
# encode many characters scraped from the web. Reconfigure both ends to UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdin.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass


def read_input() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        write_output({"error": f"invalid json input: {e}"})
        sys.exit(1)


def write_output(obj) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False, default=str))
    sys.stdout.flush()


def run(handler) -> None:
    """Wrap a handler(dict)->dict with uniform error handling."""
    try:
        data = read_input()
        result = handler(data)
        write_output(result if result is not None else {})
    except Exception as e:  # noqa: BLE001 — workers must never crash the bridge silently
        import traceback
        write_output({"error": str(e), "trace": traceback.format_exc()})
        sys.exit(1)
