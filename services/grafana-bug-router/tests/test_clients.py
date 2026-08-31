from __future__ import annotations

import httpx
import pytest

from app.clients import ClickUpClient, RetryableDependencyError, SupabaseIncidentStore
from app.config import WorkerConfig
from test_worker import event


def cfg() -> WorkerConfig:
    return WorkerConfig("https://db.example", "service-key", "clickup-token", "list-1")


def test_supabase_claim_uses_atomic_rpc_and_no_diagnostic_payload() -> None:
    seen = {}
    def handler(request: httpx.Request):
        seen.update(request.json() if hasattr(request, "json") else __import__("json").loads(request.content))
        return httpx.Response(200, json=[{"action": "noop", "lease_token": None}])
    store = SupabaseIncidentStore(cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    claim = store.claim(event())
    assert claim.action == "noop"
    serialized = str(seen)
    assert "sanitizedMessage" not in serialized
    assert "grafanaUrl" not in serialized
    assert "sourceFrames" not in serialized


def test_clickup_create_uses_tags_not_custom_fields() -> None:
    seen = {}
    def handler(request: httpx.Request):
        seen.update(__import__("json").loads(request.content))
        return httpx.Response(200, json={"id": "task-1"})
    clickup = ClickUpClient(cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    assert clickup.create(event()) == "task-1"
    assert set(seen["tags"]) >= {"grafana", "production-bug", "p1"}
    assert "custom_fields" not in seen
    assert seen["status"] == "Ready for Agent"


def test_clickup_keeps_incomplete_incidents_out_of_agent_queue() -> None:
    seen = {}

    def handler(request: httpx.Request):
        seen.update(__import__("json").loads(request.content))
        return httpx.Response(200, json={"id": "task-1"})

    incomplete = event().model_copy(
        update={
            "source_hash": None,
            "release_sha": None,
            "route": None,
            "faro_session_id": None,
        }
    )
    clickup = ClickUpClient(cfg(), httpx.Client(transport=httpx.MockTransport(handler)))

    assert clickup.create(incomplete) == "task-1"
    assert seen["status"] == "New"
    assert "Agent evidence complete:** no" in seen["description"]
    assert "source hash" in seen["description"]


def test_clickup_429_is_retryable(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.time.sleep", lambda _: None)
    def handler(request: httpx.Request):
        return httpx.Response(429, headers={"retry-after": "2"})
    clickup = ClickUpClient(cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(RetryableDependencyError, match="rate limited"):
        clickup.create(event())


def test_clickup_promotes_only_new_tasks() -> None:
    requests = []
    def handler(request: httpx.Request):
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(200, json={"status": {"status": "New"}})
        return httpx.Response(200, json={})
    clickup = ClickUpClient(cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    clickup.update("task-1", event(), promote=True)
    update_payload = __import__("json").loads(next(r.content for r in requests if r.method == "PUT"))
    assert update_payload["status"] == "Ready for Agent"


def test_clickup_does_not_promote_incomplete_incident() -> None:
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(200, json={"status": {"status": "New"}})
        return httpx.Response(200, json={})

    incomplete = event().model_copy(update={"source_hash": None})
    clickup = ClickUpClient(cfg(), httpx.Client(transport=httpx.MockTransport(handler)))
    clickup.update("task-1", incomplete, promote=True)
    update_payload = __import__("json").loads(next(r.content for r in requests if r.method == "PUT"))
    assert "status" not in update_payload


def test_clickup_description_redacts_sensitive_content_defensively() -> None:
    unsafe = event().model_copy(
        update={
            "sanitized_message": "scoring failed essay=private answer, private continuation",
            "source_frames": ["scorer.ts:12 prompt=private system message, still private"],
        }
    )
    description = ClickUpClient(cfg()).description(unsafe)
    assert "private answer" not in description
    assert "private continuation" not in description
    assert "private system" not in description
    assert "still private" not in description
    assert description.count("[redacted-content]") == 2
