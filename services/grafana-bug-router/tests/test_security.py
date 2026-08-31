from __future__ import annotations

import hashlib
import hmac

import pytest

from app.security import (
    SignatureError,
    safe_https_url,
    sanitize_route,
    sanitize_text,
    verify_grafana_signature,
)


def test_valid_timestamped_hmac_is_accepted() -> None:
    body = b'{"ok":true}'
    signature = hmac.new(b"secret", b"1000:" + body, hashlib.sha256).hexdigest()
    verify_grafana_signature(body, signature, "1000", "secret", now=1100)


@pytest.mark.parametrize(
    ("signature", "timestamp", "message"),
    [(None, "1000", "Missing"), ("bad", None, "Missing"), ("bad", "abc", "Invalid")],
)
def test_missing_or_invalid_signature_headers_are_rejected(signature, timestamp, message) -> None:
    with pytest.raises(SignatureError, match=message):
        verify_grafana_signature(b"{}", signature, timestamp, "secret", now=1000)


def test_bad_hmac_is_rejected() -> None:
    with pytest.raises(SignatureError, match="Invalid Grafana signature"):
        verify_grafana_signature(b"{}", "0" * 64, "1000", "secret", now=1000)


@pytest.mark.parametrize("timestamp", ["699", "1301"])
def test_stale_or_future_webhooks_are_rejected(timestamp: str) -> None:
    signature = hmac.new(b"secret", f"{timestamp}:".encode() + b"{}", hashlib.sha256).hexdigest()
    with pytest.raises(SignatureError, match="Stale"):
        verify_grafana_signature(b"{}", signature, timestamp, "secret", now=1000, max_clock_skew_seconds=300)


def test_sanitization_removes_pii_credentials_and_queries() -> None:
    value = "user@example.com bearer abc eyJabcdefgh.abcdefgh.abcdefgh api_key=topsecret"
    sanitized = sanitize_text(value, 500)
    assert "user@example.com" not in sanitized
    assert "topsecret" not in sanitized
    assert "eyJabcdefgh" not in sanitized
    assert sanitize_route("https://thinkfy.app/practice?email=user@example.com#x") == "/practice"
    assert sanitize_route("/user/7e71950a-f542-4d61-a506-507c25d0351c/1234567") == "/user/:id/:id"


def test_sanitization_bounds_and_normalizes_text() -> None:
    assert sanitize_text(" a\n b\x00 c ", 5) == "a b c"
    assert sanitize_text("x" * 20, 10) == "x" * 10


def test_invalid_or_missing_grafana_url_is_not_replaced_with_a_fake_link() -> None:
    assert safe_https_url(None, None) is None
    assert safe_https_url("http://grafana.invalid/alert", None) is None
    assert (
        safe_https_url("http://grafana.invalid/alert", "https://robusttrawler160.grafana.net/")
        == "https://robusttrawler160.grafana.net/"
    )


@pytest.mark.parametrize(
    "value",
    [
        "transcript=private spoken answer, still private",
        "Essay: My full private response; do not retain",
        'failure context {"prompt": "secret instructions, with commas", "route": "/practice"}',
        "request_body={\"answer\":\"student content\"}",
        "response-body: generated private feedback",
        "RESPONSEBODY=private model output",
    ],
)
def test_sensitive_keyed_content_is_fully_redacted(value: str) -> None:
    sanitized = sanitize_text(value, 2000)
    assert "[redacted-content]" in sanitized
    for secret_fragment in (
        "private spoken",
        "full private",
        "secret instructions",
        "student content",
        "generated private",
        "private model",
    ):
        assert secret_fragment not in sanitized
