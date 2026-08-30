# AI grading worker

Private Cloud Run service for DebateLab practice analysis and IELTS
Writing/Speaking provisional scoring. It consumes authenticated Pub/Sub push
messages containing only source IDs, loads student data from Supabase with the
service role, and reuses the web app's centralized AI core.

The service is intentionally not a Vercel Function and must never be made
public. See `docs/ai-grading-gcp-runbook.md` for resources, identities, secrets,
rollback, and smoke tests.

Runtime endpoints:

- `POST /` — Pub/Sub push identity only.
- `POST /internal/reconcile` — Cloud Scheduler identity only.
- `GET /healthz` — Cloud Run private health check.
