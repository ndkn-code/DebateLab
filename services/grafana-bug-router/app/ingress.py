from __future__ import annotations

import json
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Request, Response
from google.cloud import pubsub_v1
from pydantic import ValidationError

from .config import IngressConfig
from .models import GrafanaWebhook
from .security import SignatureError, verify_grafana_signature
from .transform import transform_webhook


app = FastAPI(title="Thinkfy Grafana Bug Webhook", docs_url=None, redoc_url=None)


@lru_cache
def config() -> IngressConfig:
    return IngressConfig.from_env()


@lru_cache
def publisher() -> pubsub_v1.PublisherClient:
    return pubsub_v1.PublisherClient()


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/webhooks/grafana", status_code=202)
async def grafana_webhook(request: Request) -> Response:
    cfg = config()
    declared_length = request.headers.get("content-length")
    if declared_length:
        try:
            if int(declared_length) > cfg.max_body_bytes:
                raise HTTPException(status_code=413, detail="Payload too large")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid Content-Length") from exc
    body = await request.body()
    if len(body) > cfg.max_body_bytes:
        raise HTTPException(status_code=413, detail="Payload too large")
    try:
        verify_grafana_signature(
            body,
            request.headers.get(cfg.signature_header),
            request.headers.get(cfg.timestamp_header),
            cfg.webhook_secret,
            max_clock_skew_seconds=cfg.max_clock_skew_seconds,
        )
    except SignatureError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    try:
        webhook = GrafanaWebhook.model_validate_json(body)
        events = transform_webhook(webhook, body)
    except (ValidationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid Grafana webhook payload") from exc

    topic = publisher().topic_path(cfg.pubsub_project_id, cfg.pubsub_topic)
    try:
        futures = [
            publisher().publish(
                topic,
                event.model_dump_json(by_alias=True).encode(),
                schema_version="1",
                fingerprint=event.fingerprint,
            )
            for event in events
        ]
        for future in futures:
            future.result(timeout=10)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Alert queue unavailable") from exc
    return Response(
        content=json.dumps({"accepted": len(events)}),
        media_type="application/json",
        status_code=202,
    )
