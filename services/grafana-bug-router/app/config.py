from __future__ import annotations

import os
from dataclasses import dataclass


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class IngressConfig:
    webhook_secret: str
    pubsub_project_id: str
    pubsub_topic: str
    signature_header: str = "x-grafana-alerting-signature"
    timestamp_header: str = "x-grafana-alerting-signature-timestamp"
    max_body_bytes: int = 262_144
    max_clock_skew_seconds: int = 300

    @classmethod
    def from_env(cls) -> "IngressConfig":
        return cls(
            webhook_secret=_required("GRAFANA_WEBHOOK_SECRET"),
            pubsub_project_id=os.getenv("PUBSUB_PROJECT_ID", "thinkfy-debatelab-prod"),
            pubsub_topic=os.getenv("PUBSUB_TOPIC", "grafana-bug-events"),
            max_body_bytes=int(os.getenv("MAX_WEBHOOK_BODY_BYTES", "262144")),
            max_clock_skew_seconds=int(os.getenv("WEBHOOK_MAX_CLOCK_SKEW_SECONDS", "300")),
        )


@dataclass(frozen=True)
class WorkerConfig:
    supabase_url: str
    supabase_service_role_key: str
    clickup_api_token: str
    clickup_list_id: str
    clickup_new_status: str = "New"
    clickup_ready_status: str = "Ready for Agent"

    @classmethod
    def from_env(cls) -> "WorkerConfig":
        return cls(
            supabase_url=_required("SUPABASE_URL").rstrip("/"),
            supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
            clickup_api_token=_required("CLICKUP_API_TOKEN"),
            clickup_list_id=_required("CLICKUP_LIST_ID"),
            clickup_new_status=os.getenv("CLICKUP_NEW_STATUS", "New"),
            clickup_ready_status=os.getenv("CLICKUP_READY_STATUS", "Ready for Agent"),
        )
