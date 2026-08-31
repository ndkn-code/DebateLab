"""Optional OpenTelemetry tracing for the GCP bug-router services.

The router remains fully usable without Grafana credentials. When configured,
this module exports spans directly to Grafana Cloud over OTLP/HTTP and makes
the current trace and span IDs available to Python log records. Secrets are
read from the environment (Cloud Run injects them from Secret Manager) and
are never included in telemetry attributes or diagnostics.
"""

from __future__ import annotations

import contextlib
import logging
import os
import re
from collections.abc import Iterator
from typing import Any

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Span, SpanKind, Status, StatusCode

_AUTHORIZATION = re.compile(r"^(?:Basic|Bearer)\s+\S+$", re.IGNORECASE)
_SENSITIVE_KEY = re.compile(
    r"(?:authorization|cookie|password|secret|token|body|content|prompt|transcript|essay)",
    re.IGNORECASE,
)
_configured = False
_log_factory_installed = False


def _otlp_config(environ: dict[str, str] | None = None) -> tuple[str, str] | None:
    values = os.environ if environ is None else environ
    endpoint = values.get("GRAFANA_OTLP_TRACES_ENDPOINT", "").strip()
    authorization = values.get("GRAFANA_OTLP_AUTH_HEADER", "").strip()
    if not endpoint or not authorization or not _AUTHORIZATION.fullmatch(authorization):
        return None
    if not endpoint.startswith("https://") or not endpoint.rstrip("/").endswith("/v1/traces"):
        return None
    return endpoint, authorization


def sanitize_attributes(attributes: dict[str, Any] | None) -> dict[str, str | int | float | bool]:
    """Keep only bounded, categorical span attributes."""

    safe: dict[str, str | int | float | bool] = {}
    for key, value in (attributes or {}).items():
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", key):
            continue
        if _SENSITIVE_KEY.search(key) or value is None or isinstance(value, (dict, list, tuple)):
            continue
        if isinstance(value, str):
            safe[key] = value[:200]
        elif isinstance(value, bool):
            safe[key] = value
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            safe[key] = value
    return safe


def _install_log_correlation() -> None:
    global _log_factory_installed
    if _log_factory_installed:
        return
    previous = logging.getLogRecordFactory()

    def factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
        record = previous(*args, **kwargs)
        span_context = trace.get_current_span().get_span_context()
        record.otelTraceID = span_context.trace_id and format(span_context.trace_id, "032x") or ""
        record.otelSpanID = span_context.span_id and format(span_context.span_id, "016x") or ""
        return record

    logging.setLogRecordFactory(factory)
    _log_factory_installed = True


def configure_telemetry() -> bool:
    """Install an OTLP provider if complete Grafana credentials are present."""

    global _configured
    if _configured:
        return True
    config = _otlp_config()
    if config is None:
        return False
    endpoint, authorization = config
    resource = Resource.create(
        {
            "service.name": os.getenv("OTEL_SERVICE_NAME", "thinkfy-grafana-bug-router"),
            "service.version": os.getenv("K_REVISION", os.getenv("VERCEL_GIT_COMMIT_SHA", "unknown")),
            "deployment.environment.name": os.getenv("OTEL_ENVIRONMENT", os.getenv("ENVIRONMENT", "production")),
        }
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, headers={"Authorization": authorization}))
    )
    trace.set_tracer_provider(provider)
    _install_log_correlation()
    _configured = True
    return True


def current_trace_context() -> dict[str, str]:
    span_context = trace.get_current_span().get_span_context()
    return {
        "trace_id": format(span_context.trace_id, "032x") if span_context.trace_id else "",
        "span_id": format(span_context.span_id, "016x") if span_context.span_id else "",
    }


@contextlib.contextmanager
def telemetry_span(
    name: str,
    attributes: dict[str, Any] | None = None,
    *,
    kind: SpanKind = SpanKind.INTERNAL,
) -> Iterator[Span]:
    """Create a bounded span and record raised exceptions without leaking data."""

    tracer = trace.get_tracer("thinkfy-grafana-bug-router")
    with tracer.start_as_current_span(
        name,
        kind=kind,
        attributes=sanitize_attributes(attributes),
    ) as span:
        try:
            yield span
        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR))
            raise
