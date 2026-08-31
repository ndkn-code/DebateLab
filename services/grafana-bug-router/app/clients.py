from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from .config import WorkerConfig
from .models import BugEventV1
from .security import sanitize_text


class RetryableDependencyError(RuntimeError):
    pass


@dataclass(frozen=True)
class IncidentClaim:
    action: str
    lease_token: str | None
    clickup_task_id: str | None
    previous_alert_status: str | None
    effective_severity: str | None = None


class SupabaseIncidentStore:
    def __init__(self, cfg: WorkerConfig, client: httpx.Client | None = None):
        self.cfg = cfg
        self.client = client or httpx.Client(timeout=15)

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.cfg.supabase_service_role_key,
            "authorization": f"Bearer {self.cfg.supabase_service_role_key}",
            "content-type": "application/json",
        }

    def claim(self, event: BugEventV1) -> IncidentClaim:
        response = self.client.post(
            f"{self.cfg.supabase_url}/rest/v1/rpc/claim_observability_bug_incident",
            headers=self.headers,
            json={
                "p_delivery_id": event.delivery_id,
                "p_fingerprint": event.fingerprint,
                "p_service": event.service,
                "p_environment": event.environment,
                "p_alert_status": event.status,
                "p_severity": event.severity,
                "p_first_seen_at": event.first_seen_at.isoformat(),
                "p_last_seen_at": event.last_seen_at.isoformat(),
                "p_occurrence_count": event.occurrence_count,
                "p_affected_sessions": event.affected_sessions or 0,
            },
        )
        if response.status_code >= 500 or response.status_code == 429:
            raise RetryableDependencyError("Supabase incident claim unavailable")
        response.raise_for_status()
        rows = response.json()
        row = rows[0] if isinstance(rows, list) else rows
        return IncidentClaim(
            action=row["action"],
            lease_token=row.get("lease_token"),
            clickup_task_id=row.get("clickup_task_id"),
            previous_alert_status=row.get("previous_alert_status"),
            effective_severity=row.get("effective_severity"),
        )

    def register_task(self, event: BugEventV1, lease_token: str, task_id: str) -> None:
        response = self.client.post(
            f"{self.cfg.supabase_url}/rest/v1/rpc/register_observability_bug_clickup_task",
            headers=self.headers,
            json={
                "p_delivery_id": event.delivery_id,
                "p_fingerprint": event.fingerprint,
                "p_service": event.service,
                "p_environment": event.environment,
                "p_lease_token": lease_token,
                "p_clickup_task_id": task_id,
            },
        )
        if response.status_code >= 500 or response.status_code == 429:
            raise RetryableDependencyError("Supabase task registration unavailable")
        response.raise_for_status()

    def complete(self, delivery_id: str, lease_token: str) -> None:
        response = self.client.post(
            f"{self.cfg.supabase_url}/rest/v1/rpc/complete_observability_bug_delivery",
            headers=self.headers,
            json={"p_delivery_id": delivery_id, "p_lease_token": lease_token},
        )
        if response.status_code >= 500 or response.status_code == 429:
            raise RetryableDependencyError("Supabase delivery completion unavailable")
        response.raise_for_status()


class ClickUpClient:
    BASE_URL = "https://api.clickup.com/api/v2"

    def __init__(self, cfg: WorkerConfig, client: httpx.Client | None = None):
        self.cfg = cfg
        self.client = client or httpx.Client(timeout=20)

    @property
    def headers(self) -> dict[str, str]:
        return {"authorization": self.cfg.clickup_api_token, "content-type": "application/json"}

    def _request(self, method: str, path: str, *, json: dict[str, Any] | None = None) -> httpx.Response:
        response = self.client.request(method, f"{self.BASE_URL}{path}", headers=self.headers, json=json)
        if response.status_code == 429:
            retry_after = min(float(response.headers.get("retry-after", "1")), 10)
            time.sleep(max(0, retry_after))
            raise RetryableDependencyError("ClickUp rate limited")
        if response.status_code >= 500:
            raise RetryableDependencyError("ClickUp unavailable")
        response.raise_for_status()
        return response

    @staticmethod
    def _marker(event: BugEventV1) -> str:
        return f"grafana-incident:{event.environment}:{event.service}:{event.fingerprint}"

    @staticmethod
    def _tags(event: BugEventV1) -> list[str]:
        return ["grafana", "production-bug", event.severity, f"gf-{event.fingerprint[:16].lower()}"]

    def description(self, event: BugEventV1) -> str:
        safe_frames = [safe for frame in event.source_frames if (safe := sanitize_text(frame, 300))]
        frames = "\n".join(f"- `{frame}`" for frame in safe_frames) or "- Not available"
        safe_message = sanitize_text(event.sanitized_message or event.error_title, 2000) or "Redacted error"
        fields = [
            f"<!-- {self._marker(event)} -->",
            "## Automated Grafana incident",
            f"**Fingerprint:** `{event.fingerprint}`",
            f"**Severity:** {event.severity.upper()}",
            f"**State:** {event.status}",
            f"**Occurrences:** {event.occurrence_count}",
            f"**Affected sessions:** {event.affected_sessions or 0}",
            f"**First seen:** {event.first_seen_at.isoformat()}",
            f"**Last seen:** {event.last_seen_at.isoformat()}",
            f"**Environment / service:** {event.environment} / {event.service}",
            f"**Release:** `{event.release_sha or 'unknown'}`",
            f"**Route:** `{event.route or 'unknown'}`",
            f"**Trace ID:** `{event.trace_id or 'unavailable'}`",
            f"**Faro session ID:** `{event.faro_session_id or 'unavailable'}`",
            f"**Debug ID:** `{event.debug_id or 'unavailable'}`",
            f"**Grafana:** {event.grafana_url or 'unavailable'}",
            "\n## Error",
            safe_message,
            "\n## Original-source frames",
            frames,
            "\n_Sensitive content was removed before this task was created._",
        ]
        return "\n".join(fields)

    def recover_existing(self, event: BugEventV1) -> str | None:
        marker = self._marker(event)
        for page in range(10):
            response = self._request(
                "GET",
                f"/list/{self.cfg.clickup_list_id}/task?archived=false&include_closed=true&page={page}",
            )
            tasks = response.json().get("tasks", [])
            for task in tasks:
                if marker in (task.get("description") or ""):
                    return str(task["id"])
            if len(tasks) < 100:
                break
        return None

    def create(self, event: BugEventV1) -> str:
        safe_title = sanitize_text(event.error_title, 240) or "Grafana alert"
        response = self._request(
            "POST",
            f"/list/{self.cfg.clickup_list_id}/task",
            json={
                "name": f"[{event.severity.upper()}] {safe_title}"[:255],
                "description": self.description(event),
                "status": self.cfg.clickup_ready_status if event.severity in {"p0", "p1"} else self.cfg.clickup_new_status,
                "tags": self._tags(event),
            },
        )
        return str(response.json()["id"])

    def update(
        self,
        task_id: str,
        event: BugEventV1,
        *,
        reopen: bool = False,
        promote: bool = False,
    ) -> None:
        safe_title = sanitize_text(event.error_title, 240) or "Grafana alert"
        payload: dict[str, Any] = {
            "name": f"[{event.severity.upper()}] {safe_title}"[:255],
            "description": self.description(event),
        }
        if reopen:
            payload["status"] = self.cfg.clickup_ready_status
        elif promote:
            current = self._request("GET", f"/task/{task_id}").json()
            if (current.get("status") or {}).get("status", "").casefold() == self.cfg.clickup_new_status.casefold():
                payload["status"] = self.cfg.clickup_ready_status
        self._request("PUT", f"/task/{task_id}", json=payload)
        for tag in self._tags(event):
            try:
                self._request("POST", f"/task/{task_id}/tag/{tag}")
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in {400, 409}:
                    raise
