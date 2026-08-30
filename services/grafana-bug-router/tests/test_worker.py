from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.clients import IncidentClaim, RetryableDependencyError
from app.models import BugEventV1
from app import worker


def event(status="firing") -> BugEventV1:
    return BugEventV1.model_validate(
        {
            "schemaVersion": 1,
            "deliveryId": "a" * 64,
            "fingerprint": "deadbeef12345678",
            "alertRule": "Browser error",
            "severity": "p1",
            "status": status,
            "service": "thinkfy-web",
            "environment": "production",
            "errorTitle": "Page failed",
            "firstSeenAt": datetime(2026, 8, 30, tzinfo=timezone.utc),
            "lastSeenAt": datetime(2026, 8, 30, tzinfo=timezone.utc),
            "occurrenceCount": 3,
            "grafanaUrl": "https://thinkfy.grafana.net/alert/1",
        }
    )


def envelope(value: BugEventV1) -> dict:
    return {"message": {"data": base64.b64encode(value.model_dump_json(by_alias=True).encode()).decode()}}


class Store:
    def __init__(self, claim):
        self.result = claim
        self.registered = []
        self.completed = []

    def claim(self, value):
        if isinstance(self.result, Exception):
            raise self.result
        return self.result

    def register_task(self, value, lease, task_id):
        self.registered.append((value.delivery_id, lease, task_id))

    def complete(self, delivery_id, lease):
        self.completed.append((delivery_id, lease))


class ClickUp:
    def __init__(self, recovered=None):
        self.recovered = recovered
        self.created = []
        self.updated = []

    def recover_existing(self, value):
        return self.recovered

    def create(self, value):
        self.created.append(value)
        return "task-created"

    def update(self, task_id, value, reopen=False, promote=False):
        self.updated.append((task_id, value, reopen, promote))


def client(monkeypatch, store, clickup):
    monkeypatch.setattr(worker, "dependencies", lambda: (store, clickup))
    return TestClient(worker.app)


def test_duplicate_delivery_noops_without_clickup(monkeypatch) -> None:
    store = Store(IncidentClaim("noop", None, None, None))
    clickup = ClickUp()
    response = client(monkeypatch, store, clickup).post("/pubsub/grafana-bug-events", json=envelope(event()))
    assert response.status_code == 204
    assert clickup.created == [] and clickup.updated == []


def test_concurrent_creation_is_retried_not_dropped(monkeypatch) -> None:
    store = Store(IncidentClaim("defer", None, None, "firing"))
    response = client(monkeypatch, store, ClickUp()).post(
        "/pubsub/grafana-bug-events", json=envelope(event())
    )
    assert response.status_code == 503


def test_create_claim_creates_and_registers_task(monkeypatch) -> None:
    store = Store(IncidentClaim("create", "lease-1", None, None))
    clickup = ClickUp()
    response = client(monkeypatch, store, clickup).post("/pubsub/grafana-bug-events", json=envelope(event()))
    assert response.status_code == 204
    assert len(clickup.created) == 1
    assert store.registered == [("a" * 64, "lease-1", "task-created")]


def test_create_retry_recovers_existing_clickup_task(monkeypatch) -> None:
    store = Store(IncidentClaim("create", "lease-2", None, None))
    clickup = ClickUp(recovered="existing-task")
    response = client(monkeypatch, store, clickup).post("/pubsub/grafana-bug-events", json=envelope(event()))
    assert response.status_code == 204
    assert clickup.created == []
    assert store.registered[-1][2] == "existing-task"


def test_resolved_to_firing_reopens_existing_task(monkeypatch) -> None:
    store = Store(IncidentClaim("update", "lease-3", "task-1", "resolved"))
    clickup = ClickUp()
    response = client(monkeypatch, store, clickup).post("/pubsub/grafana-bug-events", json=envelope(event("firing")))
    assert response.status_code == 204
    assert clickup.updated[0][2] is True
    assert store.completed == [("a" * 64, "lease-3")]


def test_resolved_notification_updates_without_closing(monkeypatch) -> None:
    store = Store(IncidentClaim("update", "lease-4", "task-1", "firing"))
    clickup = ClickUp()
    response = client(monkeypatch, store, clickup).post("/pubsub/grafana-bug-events", json=envelope(event("resolved")))
    assert response.status_code == 204
    assert clickup.updated[0][2] is False


def test_effective_severity_promotes_new_task(monkeypatch) -> None:
    store = Store(IncidentClaim("update", "lease-5", "task-1", "firing", "p0"))
    clickup = ClickUp()
    response = client(monkeypatch, store, clickup).post(
        "/pubsub/grafana-bug-events", json=envelope(event())
    )
    assert response.status_code == 204
    assert clickup.updated[0][1].severity == "p0"
    assert clickup.updated[0][3] is True


def test_retryable_dependency_failure_returns_503(monkeypatch) -> None:
    store = Store(RetryableDependencyError("rate limited"))
    response = client(monkeypatch, store, ClickUp()).post("/pubsub/grafana-bug-events", json=envelope(event()))
    assert response.status_code == 503


def test_malformed_pubsub_message_is_acked(monkeypatch) -> None:
    response = client(monkeypatch, Store(None), ClickUp()).post(
        "/pubsub/grafana-bug-events", json={"message": {"data": "not-base64"}}
    )
    assert response.status_code == 204
