from __future__ import annotations

import time
from concurrent.futures import Future

from fastapi.testclient import TestClient

from app.config import IngressConfig
from app import ingress
from conftest import signed


class FakePublisher:
    def __init__(self):
        self.messages = []

    def topic_path(self, project: str, topic: str) -> str:
        return f"projects/{project}/topics/{topic}"

    def publish(self, topic: str, data: bytes, **attributes):
        self.messages.append((topic, data, attributes))
        future = Future()
        future.set_result("message-1")
        return future


def setup(monkeypatch):
    fake = FakePublisher()
    monkeypatch.setattr(
        ingress,
        "config",
        lambda: IngressConfig("test-secret", "test-project", "events", max_body_bytes=10_000),
    )
    monkeypatch.setattr(ingress, "publisher", lambda: fake)
    return TestClient(ingress.app), fake


def test_valid_webhook_publishes_bug_event(monkeypatch, grafana_payload: dict) -> None:
    client, publisher = setup(monkeypatch)
    timestamp = str(int(time.time()))
    body, signature = signed(grafana_payload, timestamp=timestamp)
    response = client.post(
        "/webhooks/grafana",
        content=body,
        headers={
            "content-type": "application/json",
            "x-grafana-alerting-signature": signature,
            "x-grafana-alerting-signature-timestamp": timestamp,
        },
    )
    assert response.status_code == 202
    assert response.json() == {"accepted": 1}
    assert publisher.messages[0][2]["fingerprint"] == "deadbeef12345678"


def test_invalid_signature_never_publishes(monkeypatch, grafana_payload: dict) -> None:
    client, publisher = setup(monkeypatch)
    response = client.post(
        "/webhooks/grafana",
        json=grafana_payload,
        headers={
            "x-grafana-alerting-signature": "0" * 64,
            "x-grafana-alerting-signature-timestamp": str(int(time.time())),
        },
    )
    assert response.status_code == 401
    assert publisher.messages == []


def test_oversized_body_is_rejected_before_signature(monkeypatch) -> None:
    client, publisher = setup(monkeypatch)
    response = client.post("/webhooks/grafana", content=b"x" * 10_001)
    assert response.status_code == 413
    assert publisher.messages == []


def test_invalid_schema_is_rejected(monkeypatch) -> None:
    client, publisher = setup(monkeypatch)
    timestamp = str(int(time.time()))
    body, signature = signed({"status": "firing"}, timestamp=timestamp)
    response = client.post(
        "/webhooks/grafana",
        content=body,
        headers={
            "x-grafana-alerting-signature": signature,
            "x-grafana-alerting-signature-timestamp": timestamp,
        },
    )
    assert response.status_code == 400
    assert publisher.messages == []


def test_pubsub_failure_returns_retryable_error(monkeypatch, grafana_payload: dict) -> None:
    client, publisher = setup(monkeypatch)
    def failed(*args, **kwargs):
        future = Future()
        future.set_exception(RuntimeError("down"))
        return future
    publisher.publish = failed
    timestamp = str(int(time.time()))
    body, signature = signed(grafana_payload, timestamp=timestamp)
    response = client.post(
        "/webhooks/grafana",
        content=body,
        headers={
            "x-grafana-alerting-signature": signature,
            "x-grafana-alerting-signature-timestamp": timestamp,
        },
    )
    assert response.status_code == 503
