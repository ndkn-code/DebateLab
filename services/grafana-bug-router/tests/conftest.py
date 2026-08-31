from __future__ import annotations

import hashlib
import hmac
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))


@pytest.fixture
def grafana_payload() -> dict:
    return {
        "receiver": "production-bugs",
        "status": "firing",
        "externalURL": "https://thinkfy.grafana.net/",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "Unhandled browser exception",
                    "severity": "p1",
                    "service": "thinkfy-web",
                    "environment": "production",
                    "route": "https://thinkfy.app/practice?token=secret",
                    "trace_id": "abc123",
                },
                "annotations": {
                    "summary": "Practice page failed",
                    "description": "Contact user@example.com Authorization=Bearer-secret",
                    "occurrence_count": "3",
                    "affected_sessions": "2",
                    "source_frames": json.dumps(["app/page.tsx:10 user@example.com"]),
                },
                "startsAt": datetime(2026, 8, 30, tzinfo=timezone.utc).isoformat(),
                "generatorURL": "https://thinkfy.grafana.net/alerting/grafana/abc/view",
                "fingerprint": "deadbeef12345678",
            }
        ],
    }


def signed(payload: dict, secret: str = "test-secret", timestamp: str = "1000") -> tuple[bytes, str]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = hmac.new(secret.encode(), timestamp.encode() + b":" + body, hashlib.sha256).hexdigest()
    return body, signature
