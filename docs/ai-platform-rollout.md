# AI analysis and knowledge platform rollout

The centralized model layer is used by normal application code immediately.
Durable grading is a separate cutover implemented by private Cloud Run and
Pub/Sub. Dispatch is fail-closed unless `AI_GRADING_BACKEND` is explicitly
`gcp` or `legacy`.

## What must exist before durable or evidence-adjudicated grading is enabled

1. Apply `supabase/migrations/20260829100000_ai_durable_workflows.sql` to the
   target environment, then apply
   `supabase/migrations/20260829110000_ai_knowledge_platform.sql` and
   `supabase/migrations/20260829120000_ai_knowledge_operations.sql`, followed by
   `supabase/migrations/20260830160000_ai_grading_gcp_runtime.sql` and migrations
   `20260901130000` through `20260901202000` for retry consistency, immutable
   benchmark slices, third-attempt recovery, linked operational evidence,
   worker-authored runtime/repeat-run attestations, protected benchmark claims,
   study integrity, and withdrawal verification.
   Regenerate Supabase types afterward. All migrations are forward-only.
2. Confirm the `ai_workflow_runs` row-level-security policy lets a learner read
   only their own runs and lets only the service role create or update runs.
   Confirm that benchmark labels, knowledge ingestion, and grading-authoritative
   retrieval are service-role-only.
3. Configure the target Vercel environment with only the web publisher values:
   - `AI_GRADING_BACKEND=legacy` until every check below passes
   - `IELTS_EVIDENCE_ADJUDICATION_ENABLED=false` until the pinned benchmark
     gate passes
   - `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - the keyless WIF publisher variables in `.env.example`; never add a GCP
     service-account JSON key to Vercel
   Configure grading-provider secrets on the private Cloud Run worker instead:
   - bind `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, and `AZURE_SPEECH_KEY` from GCP
     Secret Manager;
   - set `AZURE_SPEECH_REGION=southeastasia` as a Cloud Run environment variable;
   - optionally set `GROQ_IELTS_SCORING_FALLBACK_MODEL` (defaults to the fast
     Groq `openai/gpt-oss-20b` model);
   - add `VOYAGE_API_KEY` only when a reviewed English collection is ready to
     embed or retrieve.
   Do not duplicate Azure or grading-provider secrets in Vercel. The only
   exception is a deliberately retained legacy Vercel Azure TTS fallback.
   Protected Speaking calibration additionally uses two separate GCP secrets:
   `AI_GRADING_ACOUSTIC_ASSESSMENT_RECEIPT_SECRET` is available to both acoustic
   preparation stages, while `AI_GRADING_BENCHMARK_ATTESTATION_SECRET` is
   restricted to final attestation. They must never share a value, and neither
   belongs in Vercel.
4. Provision and validate the private worker resources described in
   `docs/ai-grading-gcp-runbook.md`. Vercel Workflow, grading queue consumers,
   and a Vercel reconciliation cron are not part of this architecture.
5. Import only rights-cleared sources. Grading-authoritative items must be
   approved and backed by official or qualified examiner/adjudicator sources.
   Publish an immutable collection version and record that version on every
   grading result.
6. Populate a source-separated locked benchmark. Do not include knowledge from
   the same source in both the retrieval corpus and the evaluation split.
7. Deploy the private worker and a web preview; leave production unchanged.

## Corpus operations

Start from the checked-in **candidate** manifests in
`apps/web/src/scripts/manifests/`; they intentionally contain placeholders,
not examiner labels or copied transcripts. Use Exa/Gemini only to prepare a
manifest for public/de-identified research, then independently verify every
source, locator, rights status, and derived insight before it becomes approved.

Create a draft (this does not embed or expose it to learners):

```bash
npm run ai:knowledge-ingest -w @thinkfy/web -- \
  --manifest src/scripts/manifests/ai-knowledge-candidate.template.json \
  --submitted-by <importer-profile-uuid>
```

An independent admin reviews source/item candidates through the generic admin
API (`GET/PATCH /api/admin/ai-knowledge`). After every item and source is
approved and rights-cleared, embed and atomically publish with a different
reviewer identity:

```bash
npm run ai:knowledge-ingest -w @thinkfy/web -- \
  --manifest <verified-manifest.json> \
  --submitted-by <importer-profile-uuid> \
  --reviewer-id <different-reviewer-profile-uuid> \
  --embed --publish
```

The importer never mutates the active version: each manifest targets a future
integer version, and publication switches the collection in one transaction.
The runtime retrieves that exact active version (or an explicitly pinned
version for a benchmark replay). A benchmark source is blocked from becoming
active retrieval evidence, so a holdout cannot leak into prompts.

## Preview smoke test

Run one item of each kind in preview: debate analysis, IELTS Speaking, and IELTS
Writing. For each item, verify:

- only one `ai_workflow_runs` row and one checkpoint row are created;
- a duplicate Pub/Sub delivery does not make a duplicate provider call;
- status progresses through `queued`, `running`, and `completed`;
- the domain result is persisted before optional replanning or enrichment;
- a persistence failure retries from the validated provider-output checkpoint;
- a fatal input failure becomes `failed` and is not retried forever;
- authenticated Cloud Scheduler recovers a deliberately expired worker lease;
- a simulated provider-response/checkpoint crash becomes
  `PROVIDER_OUTCOME_UNKNOWN` and does not silently make a second paid call;
- the learner cannot read another learner's workflow row.

For Speaking, deliberately remove the Azure credential for one preview run and
verify that grading completes with limited pronunciation confidence rather than
claiming examiner-equivalent precision.

## Grading benchmark gate

Prepare a protected, human-reviewed benchmark manifest first. Every source must
have approved rights, an official or qualified-examiner authority tier, exact
response and label locators, all four criterion labels, and a single split per
source. Release-eligible labels require at least two independent qualified
examiner marks and documented adjudication. Speaking cases additionally require
the protected audio plus accent, first-language, and audio-quality groups. The
importer is append-only by contract: an existing benchmark key may be replayed
only when its immutable label and provenance match exactly. Sources must
already be independently approved rows whose `submitted_by` and `reviewed_by`
identities are both recorded and different; the label importer cannot approve
its own source.

```bash
AI_GRADING_BENCHMARKS_FILE=/absolute/path/to/reviewed-benchmarks.json \
npm run ai:import-grading-benchmarks -w @thinkfy/web
```

The manifest and protected response material must not be committed. The
service-role importer emits counts only; learner/admin APIs never receive gold
labels. Retrieval-source/benchmark-source separation is also enforced in the
database.

Each benchmark input must provide exactly one protected response modality:
inline text, a private response-object path (for example, a scanned PDF), or a
private audio-object path. Every response must include its own SHA-256 digest;
object-backed responses also include their content type. Repeated artifact
hashes are rejected so one response cannot inflate coverage or accuracy. A
public dataset DOI or archive checksum does not substitute for per-response
criterion labels.

Primary and repeat predictions must be produced as two distinct centralized
AI-core invocations with `benchmarkEvaluationRun=true`, the benchmark key,
grader/corpus version, and run kind in the execution metadata. The validated
output audit creates an HMAC-signed `ai_provider_requests` row that binds the
immutable artifact, exact model request, validated output, provider, and model.
The signing secret exists only in the isolated benchmark executor and as the
Supabase Vault secret `ai_grading_benchmark_attestation_secret`; do not expose
it to the web application or the evaluation importer. Evaluation import accepts
only that row's UUID and derives provider, model, trace, timing, and prediction
identity from the immutable audit; caller-supplied provider names or invented
trace IDs are not accepted. Once linked, both the evaluation run and its
provider-request audit are immutable.

Every half-band/task/criterion coverage cell requires at least 15 independent
responses. Speaking also requires accent, first-language, and audio-quality
slices. A release run needs exactly one fresh repeat for every evaluated
benchmark criterion; extra repeats for easy cases cannot compensate for
missing repeats elsewhere.

Record every candidate source and rejection reason in
`docs/ielts/benchmark-source-review.md`; a source description that claims labels
which are absent from the downloaded archive is not eligible.

Before asking an independent administrator to publish a mock-question version,
run the learner-safe preflight for each collection. It reports counts and stable
blocker codes without exposing prompts or answer material:

```bash
npm run ai:knowledge-release-preflight -w @thinkfy/web -- \
  --collection ielts.writing --version 2
npm run ai:knowledge-release-preflight -w @thinkfy/web -- \
  --collection ielts.speaking --version 2
```

Pin the exact grader and corpus versions, then run:

```bash
AI_GRADING_GATE_VERSION=<grader-version> \
AI_GRADING_GATE_CORPUS_VERSION=<collection-version> \
AI_GRADING_GATE_ENVIRONMENT=preview \
AI_GRADING_GATE_DEPLOYMENT_ID=<cloud-run-revision> \
AI_GRADING_GATE_IMAGE_DIGEST=sha256:<64-lowercase-hex> \
npm run ai:grading-gate -w @thinkfy/web
```

The command fails closed when credentials, labels, evaluations, or version pins
are missing. It also fails unless the configured benchmark reaches the release
thresholds for half-band agreement, quadratic weighted kappa, group bias,
repeatability, schema validity, evidence authority, and workflow reliability.
The 90% half-band agreement threshold applies to every required
skill/criterion/task/band/accent cell as well as the overall corpus, so a weak
slice cannot be hidden by a large aggregate.
Workflow reliability is read from a fresh, immutable operational-evidence run
linked to actual durable workflow rows—not from model-evaluation metadata.
Set `AI_GRADING_GATE_DEPLOYMENT_ID` and `AI_GRADING_GATE_IMAGE_DIGEST` to the
exact preview/staging revision and immutable image used by the predeclared
fault-injection run; workflows outside that bound cohort are
not reusable as evidence, while every nonterminal/unexpected failure inside the
cohort is counted as stranded.
Never use AI-derived annotations as benchmark ground truth.

## Production cutover

Enable `IELTS_EVIDENCE_ADJUDICATION_ENABLED=true` only after the pinned grading
gate passes. Set `AI_GRADING_BACKEND=gcp` only after the Cloud Run/Pub/Sub smoke
tests pass. `AI_GRADING_BACKEND=legacy` is the no-new-dispatch kill switch and
keeps the existing `/api/analyze` compatibility scorer available; already saved
GCP jobs remain recoverable after re-enable. Do not roll back forward-only
database migrations or delete versioned evidence.

## Internal retrieval

Debate and IELTS retrieval use collection-isolated 1,024-dimensional vector
spaces plus the service-role-only lexical search RPC. English collections are
pinned to `voyage-4-large`; changing embedding models requires a new collection
version and re-embedding, never an environment override. Typed knowledge tools
return evidence IDs, source locators, collection versions, relevance, and
limitations. External Exa and Gemini are research-time tools only and are not
runtime dependencies for grading. Live student data must not be sent to Gemini.
