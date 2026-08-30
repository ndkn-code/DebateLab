from __future__ import annotations

import hashlib
import hmac
import re
import time
from urllib.parse import urlsplit, urlunsplit


EMAIL_RE = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
TOKEN_RE = re.compile(
    r"(?i)\b(?:bearer\s+|token[=:]\s*|api[_-]?key[=:]\s*|authorization[=:]\s*)[^\s,;]+"
)
JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
UUID_RE = re.compile(r"(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b")
LONG_ID_RE = re.compile(r"(?<=/)\d{6,}(?=/|$)")


class SignatureError(ValueError):
    pass


def verify_grafana_signature(
    body: bytes,
    signature: str | None,
    timestamp: str | None,
    secret: str,
    *,
    now: int | None = None,
    max_clock_skew_seconds: int = 300,
) -> None:
    if not signature or not timestamp:
        raise SignatureError("Missing Grafana signature headers")
    try:
        sent_at = int(timestamp)
    except ValueError as exc:
        raise SignatureError("Invalid Grafana signature timestamp") from exc
    current = int(time.time()) if now is None else now
    if abs(current - sent_at) > max_clock_skew_seconds:
        raise SignatureError("Stale Grafana webhook")
    signed = timestamp.encode("ascii") + b":" + body
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature.lower()):
        raise SignatureError("Invalid Grafana signature")


def sanitize_text(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    text = EMAIL_RE.sub("[redacted-email]", str(value))
    text = JWT_RE.sub("[redacted-token]", text)
    text = TOKEN_RE.sub("[redacted-secret]", text)
    text = " ".join(text.replace("\x00", "").split())
    return text[:limit] or None


def sanitize_route(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlsplit(value)
    path = EMAIL_RE.sub("[redacted]", parsed.path)
    path = UUID_RE.sub(":id", path)
    path = LONG_ID_RE.sub(":id", path)
    return path[:300]


def safe_https_url(value: str | None, fallback: str | None = None) -> str:
    candidate = value or fallback or "https://grafana.com/"
    parsed = urlsplit(candidate)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        return "https://grafana.com/"
    # Query strings can contain alert labels. The Grafana alert path is sufficient for triage.
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))[:2000]
