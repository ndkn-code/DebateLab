# Grafana alert query templates

These queries are starting templates for Grafana Cloud Logs. Replace
`$LOKI_DATASOURCE_UID` in the Grafana UI with the actual Loki data source. Do
not commit its credentials.

The application and Cloud Run telemetry must emit `environment`,
`error_fingerprint`, `service_name`, `feature_area`, and (when present)
`faro_session_id` as indexed labels or JSON fields.

## New production fingerprints (P2)

Use this as query `A`, reduce by `error_fingerprint` and `service_name`, and
alert when the last value is at least one:

```logql
sum by (error_fingerprint, service_name) (
  count_over_time({environment="production"} | json | level="error" [5m])
)
```

Grafana should group notifications by the two labels. The ClickUp worker is the
source of truth for whether a fingerprint is genuinely new; subsequent P2
notifications update the existing incident instead of creating another task.

## Repeated production fingerprint (P1)

Occurrences query; alert at `>= 3` over 15 minutes:

```logql
sum by (error_fingerprint, service_name) (
  count_over_time({environment="production"} | json | level="error" [15m])
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
sum by (error_fingerprint, service_name, feature_area) (
  count_over_time(
    {environment="production"}
      | json
      | level="error"
      | feature_area=~"authentication|payments|data-loss|security"
    [5m]
  )
)
```

## Required notification labels and annotations

Every firing notification must include:

- Labels: `error_fingerprint`, `service_name`, `environment`, `severity`,
  `feature_area`, and `clickup_status`.
- Annotations: sanitized error title/message, first/last seen, occurrence and
  affected-session counts, release SHA, route, trace ID, Faro session ID,
  application debug ID, and a direct Grafana URL.

Never include user text, email addresses, authorization material, recordings,
transcripts, essays, prompts, or request/response bodies.
