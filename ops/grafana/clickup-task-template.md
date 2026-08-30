# {{severity}} · {{service_name}} · {{error_title}}

**Fingerprint:** `{{error_fingerprint}}`

**Status:** {{status}}

**Environment:** {{environment}}

**First / last seen:** {{first_seen_at}} / {{last_seen_at}}

**Occurrences / sessions:** {{occurrence_count}} / {{affected_session_count}}

**Release:** `{{release_sha}}`

## Diagnostic context

- Grafana: {{grafana_url}}
- Route: `{{normalized_route}}`
- Trace: `{{trace_id}}`
- Faro session: `{{faro_session_id}}`
- Debug ID: `{{debug_id}}`
- Suspect commit: `{{suspect_commit}}`

## Sanitized stack

```text
{{source_frames}}
```

## Agent outcome

- Root cause:
- Regression test:
- Fix branch / PR:
- Validation:
- Residual risk:

> Diagnostic data is sanitized. Do not paste user content, tokens, emails,
> transcripts, essays, prompts, or raw request/response bodies into this task.
