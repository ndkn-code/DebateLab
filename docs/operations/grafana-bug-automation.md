# Grafana production bug automation

This runbook connects Grafana Cloud Free to the `Production Bugs` ClickUp list
and a daily Codex debugging run. It deliberately creates no Vercel Function,
cron, queue consumer, Workflow trigger, webhook route, or Server Action.

## One-time operator setup

1. Create the Grafana Cloud Free stack and note its stack URL. Create a
   read-only service account restricted to Logs/Traces query access. Save its
   token locally as `GRAFANA_SERVICE_ACCOUNT_TOKEN`; never add it to the repo.
2. Configure Loki/Tempo ingestion and verify production events carry the
   labels documented in `ops/grafana/logql-templates.md`.
3. Create a `Production Bugs` ClickUp list with these statuses:
   `New`, `Ready for Agent`, `Agent Working`, `Needs Review`, `Done`, `Ignored`.
   Create a personal API token and note the list ID.
4. After the Cloud Run webhook and worker wave is deployed, create the Grafana
   contact point `grafana-bug-webhook`. Store the shared HMAC secret in Grafana
   and GCP Secret Manager. Do not send alerts directly to ClickUp.
5. Create alert rules from `ops/grafana/alert-policy.yaml` and
   `ops/grafana/logql-templates.md`. Route only `environment=production` to the
   ClickUp contact point. Configure quota warnings at 50%, 75%, and 90%.
6. Create the Codex automation only after the smoke tests below pass. Use the
   prompt in `docs/operations/grafana-daily-agent-prompt.md`, model
   `gpt-5.6-luna`, high reasoning, daily at 09:00 America/New_York.

## Local secret-safe tooling

Load secrets through an untracked shell profile, OS keychain, or Secret
Manager wrapper:

```bash
export CLICKUP_API_TOKEN='...'
export CLICKUP_BUG_LIST_ID='...'
export GRAFANA_URL='https://YOUR-STACK.grafana.net'
export GRAFANA_SERVICE_ACCOUNT_TOKEN='...'
export GRAFANA_LOKI_DATASOURCE_UID='...'
```

The commands never accept credentials as command-line arguments and never log
authorization headers:

```bash
npm run bugops -- clickup list --status "Ready for Agent" --limit 10
npm run bugops -- clickup claim TASK_ID
npm run bugops -- grafana incident FINGERPRINT --from 24h
npm run bugops -- grafana query --expr '{service_name="thinkfy-web"} | json | level="error"' --from 1h
npm run bugops -- clickup update TASK_ID --status "Needs Review" --comment "PR: ..."
```

The claim command refuses tasks outside `Ready for Agent` and verifies the
post-update status. The daily automation must be configured with non-overlap so
only one run can claim work at a time.

## Smoke tests and rollout

Before enabling automatic `Ready for Agent` routing:

1. Inject one sanitized staging browser error and one Cloud Run error.
2. Confirm source-mapped frames, release SHA, trace ID, and fingerprint are
   queryable while prohibited personal/user content is absent.
3. Fire the same fingerprint ten times; confirm one ClickUp task is created and
   its counters update.
4. Confirm a P2 first occurrence lands as `New`; three occurrences in 15
   minutes or two sessions lands as P1 `Ready for Agent`; the first critical
   feature-area occurrence lands as P0 `Ready for Agent`.
5. Simulate ClickUp 429 and 5xx responses. Verify Pub/Sub retry and dead-letter
   behavior rather than duplicate task creation.
6. Run the daily workflow manually against a synthetic task. Confirm it stops
   at `Needs Review` and neither merges, deploys, closes, nor deletes anything.
7. Observe low-sampling production telemetry for seven days, tune exclusions,
   then enable automatic P0/P1 routing.

## Failure handling

- Grafana webhook failures: inspect Cloud Run ingress logs; signature or stale
  timestamp failures are security events and must not be retried by the app.
- ClickUp unavailable/rate-limited: rely on Pub/Sub retry with backoff; replay
  the dead-letter message only after the cause is fixed.
- Grafana quota warning: reduce sampling before data is dropped. Preserve P0
  and P1 error events ahead of performance or debug logs.
- Codex run fails: comment with the blocker, return the task to
  `Ready for Agent`, and keep the worktree for diagnosis. Never mark `Done`.
