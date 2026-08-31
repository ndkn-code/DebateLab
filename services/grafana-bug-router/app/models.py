from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class BugEventV1(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    schema_version: Literal[1] = Field(alias="schemaVersion")
    delivery_id: str = Field(alias="deliveryId", pattern=r"^[a-f0-9]{64}$")
    fingerprint: str = Field(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    source_hash: str | None = Field(
        default=None,
        alias="sourceHash",
        max_length=128,
        pattern=r"^[A-Za-z0-9_.:-]+$",
    )
    alert_rule: str = Field(alias="alertRule", min_length=1, max_length=180)
    severity: Literal["p0", "p1", "p2", "p3"]
    status: Literal["firing", "resolved"]
    service: str = Field(min_length=1, max_length=100)
    environment: str = Field(min_length=1, max_length=40)
    release_sha: str | None = Field(default=None, alias="releaseSha", max_length=64)
    error_title: str = Field(alias="errorTitle", min_length=1, max_length=240)
    sanitized_message: str | None = Field(default=None, alias="sanitizedMessage", max_length=2000)
    first_seen_at: datetime = Field(alias="firstSeenAt")
    last_seen_at: datetime = Field(alias="lastSeenAt")
    occurrence_count: int = Field(alias="occurrenceCount", ge=1, le=1_000_000_000)
    affected_sessions: int | None = Field(default=None, alias="affectedSessions", ge=0)
    route: str | None = Field(default=None, max_length=300)
    feature_area: str | None = Field(default=None, alias="featureArea", max_length=80)
    failure_stage: str | None = Field(default=None, alias="failureStage", max_length=80)
    http_status: int | None = Field(default=None, alias="httpStatus", ge=100, le=599)
    request_id: str | None = Field(default=None, alias="requestId", max_length=128)
    source_frames: list[str] = Field(default_factory=list, alias="sourceFrames", max_length=20)
    trace_id: str | None = Field(default=None, alias="traceId", max_length=64)
    faro_session_id: str | None = Field(default=None, alias="faroSessionId", max_length=128)
    debug_id: str | None = Field(default=None, alias="debugId", max_length=128)
    grafana_url: HttpUrl | None = Field(default=None, alias="grafanaUrl")

    @field_validator("source_frames")
    @classmethod
    def frames_are_bounded(cls, frames: list[str]) -> list[str]:
        return [frame[:300] for frame in frames]


class GrafanaAlert(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: Literal["firing", "resolved"]
    labels: dict[str, str] = Field(default_factory=dict)
    annotations: dict[str, str] = Field(default_factory=dict)
    startsAt: datetime
    endsAt: datetime | None = None
    generatorURL: str | None = None
    fingerprint: str | None = None


class GrafanaWebhook(BaseModel):
    model_config = ConfigDict(extra="ignore")

    receiver: str = Field(min_length=1, max_length=180)
    status: Literal["firing", "resolved"]
    alerts: list[GrafanaAlert] = Field(min_length=1, max_length=100)
    externalURL: str | None = None
