from __future__ import annotations

import base64
import binascii
import json
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import ValidationError

from .clients import ClickUpClient, RetryableDependencyError, SupabaseIncidentStore
from .config import WorkerConfig
from .models import BugEventV1
from .telemetry import configure_telemetry, telemetry_span


app = FastAPI(title="Thinkfy Grafana ClickUp Worker", docs_url=None, redoc_url=None)
configure_telemetry()


@lru_cache
def dependencies() -> tuple[SupabaseIncidentStore, ClickUpClient]:
    cfg = WorkerConfig.from_env()
    return SupabaseIncidentStore(cfg), ClickUpClient(cfg)


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/pubsub/grafana-bug-events")
async def process_event(request: Request) -> Response:
    try:
        envelope = await request.json()
        encoded = envelope["message"]["data"]
        event = BugEventV1.model_validate_json(base64.b64decode(encoded, validate=True))
    except (KeyError, TypeError, ValueError, binascii.Error, json.JSONDecodeError, ValidationError) as exc:
        # Ack malformed messages: retries cannot repair them and the ingress already validated the event.
        raise HTTPException(status_code=204, detail="Malformed event discarded") from exc

    store, clickup = dependencies()
    try:
        with telemetry_span(
            "grafana.incident.claim",
            {"bug.fingerprint": event.fingerprint, "bug.service": event.service, "bug.environment": event.environment},
        ):
            claim = store.claim(event)
        if claim.effective_severity:
            event = event.model_copy(update={"severity": claim.effective_severity})
        if claim.action == "noop":
            return Response(status_code=204)
        if claim.action == "defer":
            raise RetryableDependencyError("ClickUp task creation is already in progress")
        if claim.action == "create":
            with telemetry_span("clickup.task.create", {"bug.fingerprint": event.fingerprint}):
                task_id = clickup.recover_existing(event) or clickup.create(event)
            if not claim.lease_token:
                raise RuntimeError("Create claim did not provide a lease")
            store.register_task(event, claim.lease_token, task_id)
        elif claim.action == "update":
            if not claim.clickup_task_id or not claim.lease_token:
                raise RuntimeError("Update claim did not provide task and lease identifiers")
            with telemetry_span("clickup.task.update", {"bug.fingerprint": event.fingerprint}):
                clickup.update(
                    claim.clickup_task_id,
                    event,
                    reopen=claim.previous_alert_status == "resolved" and event.status == "firing",
                    promote=event.status == "firing" and event.severity in {"p0", "p1"},
                )
            store.complete(event.delivery_id, claim.lease_token)
        else:
            raise RuntimeError(f"Unknown incident claim action: {claim.action}")
    except RetryableDependencyError as exc:
        # Non-2xx makes Pub/Sub retry with exponential backoff and eventually route to the DLQ.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return Response(status_code=204)
