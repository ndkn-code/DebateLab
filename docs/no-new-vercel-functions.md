# No new Vercel Functions

DebateLab's approved Vercel runtime surface is frozen. New route handlers,
Pages API routes, queue or Workflow entrypoints, cron paths, webhook functions,
and backend-only Server Action modules must not be added to Vercel.

Background, asynchronous, file-processing, automation, and independently
scalable backend work belongs in the `thinkfy-debatelab-prod` GCP project using
private Cloud Run services, Pub/Sub, and keyless Vercel OIDC/WIF from an already
approved bounded endpoint.

`npm run ci:checks` compares the repository to
`scripts/ci/baselines/vercel-function-entrypoints.txt`. Deletions are allowed.
Adding or changing the approved baseline requires explicit approval from Jack
and code review; a baseline edit must never be used to bypass the architecture
decision.
