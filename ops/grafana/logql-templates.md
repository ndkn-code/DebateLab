# Grafana alert query templates

These queries are starting templates for Grafana Cloud Logs. Replace
`$LOKI_DATASOURCE_UID` in the Grafana UI with the actual Loki data source. Do
not commit its credentials.

Installed Faro streams use `deployment_environment`, `hash`, `service_version`,
`page_id`, and `session_id` as indexed labels, with event fields parsed using
`logfmt`. The Cloud Run router normalizes those names into the canonical
ClickUp contract (`environment`, `source_hash`, `release_sha`, `route`, and
`faro_session_id`). Alert queries must use the installed Faro names; do not use
the canonical ClickUp names as Loki selectors.

Every query must be validated against live Explore results before enabling the
rule. A query returning no series is a rollout failure, not proof of zero bugs.

## New production fingerprints (P2)

Use this as query `A`, reduce by `hash` and `service_name`, and
alert when the last value is at least one:

```logql
sum by (hash, service_name) (
  count_over_time({kind="exception",app_id="1295",deployment_environment="production"}[5m])
)
```

Grafana should group notifications by the two labels. The ClickUp worker is the
source of truth for whether a fingerprint is genuinely new; subsequent P2
notifications update the existing incident instead of creating another task.

## Repeated production fingerprint (P1)

Occurrences query; alert at `>= 3` over 15 minutes:

```logql
sum by (hash, service_name) (
  count_over_time({kind="exception",app_id="1295",deployment_environment="production"}[15m])
)
```

Distinct-session query; create a recording/query expression grouped by
`error_fingerprint`, count unique non-empty `faro_session_id` labels, and alert
at `>= 2`. If the Grafana UI cannot reduce unique sessions correctly, keep the
occurrence rule active and enforce the session threshold in the Cloud Run
worker from the webhook annotations.

## Critical feature area (P0)

Alert on the first occurrence within five minutes:

```logql
sum by (hash, service_name) (
  count_over_time(
    {kind="exception",app_id="1295",deployment_environment="production"}
      | logfmt
      | context_featureArea=~"authentication|payments|data-loss|security|ai-coach"
    [5m]
  )
)
```

## AI Chat Coach failures (P1)

This rule must not depend only on Faro because browser analytics consent is
optional. The consent-independent signal is the server Tempo span attribute;
the Faro Loki query is optional browser context. Both paths use the same
bounded `chat-request-failed:<code>` value when correlating a failure.

Configure the required backend alert against the Tempo datasource in metrics
mode. This is the actual alerting query and must end in `| count_over_time()`:

```traceql
{
  resource.service.name = "thinkfy-web" &&
  span.thinkfy.chat.incident_fingerprint =~
    "chat-request-failed:(COACH_REQUEST_FAILED|COACH_STREAM_FAILED|IELTS_COACH_INFRASTRUCTURE_UNAVAILABLE)"
} | count_over_time()
```

The three stable incident rules are:

- `chat-request-failed:COACH_REQUEST_FAILED` — request/authentication or persistence failure.
- `chat-request-failed:COACH_STREAM_FAILED` — provider/stream failure after the request starts.
- `chat-request-failed:IELTS_COACH_INFRASTRUCTURE_UNAVAILABLE` — unavailable trusted IELTS infrastructure.

For optional consented browser context, query Loki separately:

```logql
sum by (hash) (
  count_over_time(
    {kind="exception",app_id="1295",deployment_environment="production"}
      | logfmt
      | context_incidentFingerprint="chat-request-failed:COACH_REQUEST_FAILED"
    [5m]
  )
)
```

Alert on the first Tempo match with severity `p1`. The Loki query adds
session/browser context only when the user has granted analytics consent and
must not be required for incident creation.

## Required notification labels and annotations

Every firing notification should include these labels when the source record
contains them:

- Labels: preserve only the stable Faro `hash` and `service_name` grouping
  keys, then add `severity` and `clickup_status`. Do not group alerts by
  session, route/page, or release.
- Annotations: sanitized error title/message, first/last seen, occurrence and
  affected-session counts, release SHA, route, trace ID, Faro session ID,
  application debug ID, and a direct Grafana URL. Preserve absent values as
  empty/unavailable; never infer a route, trace, session, release, or source
  frame from unrelated events.

The count queries only decide whether a fingerprint fires. They do not carry
arbitrary source frames or event fields into the notification automatically.
Configure notification annotations to use the actual alert-series values (or
the direct Grafana generator URL) and validate a real Faro and Cloud Run event
before rollout. Keep source frames out of high-cardinality labels.

Never include user text, email addresses, authorization material, recordings,
transcripts, essays, prompts, or request/response bodies.
