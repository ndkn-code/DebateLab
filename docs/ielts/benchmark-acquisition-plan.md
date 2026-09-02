# IELTS examiner benchmark acquisition

This is the acquisition path for the locked IELTS Speaking/Writing benchmark.
It is not a source list for learner-facing retrieval. The latest Exa pass
reviewed 210 result slots across four workstreams and deep-read 18 shortlisted
official, assessment-research, licensing, dataset, and partnership sources. No
public downloadable dataset met the commercial rights, IELTS-criterion, audio,
independent-double-marking, source-isolation, and adjudication requirements
together.

## Required partnership

Use two independently accountable parties:

1. A language-assessment research centre designs the overlap matrix,
   adjudication, many-facet Rasch analysis, fairness slices, and locked holdout.
2. A current official IELTS partner/test centre verifies and recruits currently
   certified examiners. Self-attested “former examiner” profiles do not satisfy
   the provenance contract.

Evidence-backed enquiry routes:

- [IELTS joint-funded research](https://ielts.org/researchers/funding-and-awards/research-funding)
  is the official long-horizon research route, but is not an immediate
  commercial procurement channel and does not guarantee data access.
- [Cambridge research data/material requests](https://www.cambridgeenglish.org/Images/554694-requests-for-data.pdf)
  may support qualified academic research under a written agreement; it does
  not grant commercial product rights by default.
- [Cambridge English Assessment Services](https://www.cambridgeenglish.org/consultancy/our-expertise/assessment-services/)
  offers bespoke assessment review and validation. A contract must explicitly
  confirm examiner recruitment, commercial evaluation rights, and that no
  official IELTS endorsement is implied.
- [CRELLA](https://www.beds.ac.uk/crella/our-research/) and the
  [University of Melbourne Language Testing Research Centre](https://arts.unimelb.edu.au/language-testing-research-centre)
  have directly relevant language-assessment validation experience. Neither
  public page promises a current IELTS examiner panel, so recruitment and
  credential verification remain separate.
- [British Council Vietnam](https://www.britishcouncil.vn/en/about/contact) is
  an official local enquiry route. Its public page does not offer benchmark
  scoring, so any participation must be negotiated and documented.
- [IDP examiner recruitment](https://ielts.idp.com/about/ielts-for-teachers/ielts-examiner-jobs-recruitment-training)
  describes the official test-centre recruitment/certification route. An IDP
  marketing or registration partnership must not be represented as examiner or
  scoring authorization.

## Locked sample design

The release gate requires at least 15 independent artifacts in every released
half-band × task type × criterion cell. One response supplies four criterion
labels, but it counts once per cell regardless of repeated imports.

- Writing: Bands 4–9 in half-band increments across Academic Task 1, General
  Training Task 1, and Task 2. This is at least 495 distinct locked responses.
- Speaking: Bands 4–9 in half-band increments across Parts 1–3, repeated for
  every represented accent group. Each record includes L1 and audio-quality
  strata. Full-test recordings and any derived part artifacts must preserve
  candidate/source isolation; the same artifact hash cannot be counted twice.
- At least two blind, independent current qualified examiner marks for all four
  criteria. A third examiner adjudicates any criterion or overall difference
  greater than 0.5 and every important boundary crossing.
- Preserve original marks, pseudonymous rater identity, credential-verification
  record, rubric version, timestamps, adjudication rationale, final label, and
  immutable artifact checksum.
- Split by candidate, prompt/task family, and source before any development,
  retrieval, prompt example, or tuning use. The holdout never enters retrieval.

## Rights and privacy

- Before any scored run, the locked manifest records `modelInputSha256`: the
  canonical SHA-256 of the exact centralized-core `{task,messages}` request
  built from the protected artifact, prompt, rubric, and deterministic
  preprocessing. The provider audit derives the same digest from the request
  it actually sends and signs the artifact/request/output binding with an
  executor-only secret, preventing the service-role importer from fabricating
  or relabelling benchmark calls after the fact.
- Use DebateLab-authored prompts and newly consented responses.
- Evaluation use and model-training use are separate consent choices.
- Consent covers commercial AI evaluation, human review, voice
  re-identification risk, storage/processing jurisdictions, retention, deletion,
  and future versioned re-evaluation.
- Prefer adults. Minors require guardian consent, learner assent, safeguarding
  review, and at most one year of retention before renewed consent.
- Pseudonymize before rater access; encrypt audio/text; log access; execute DPAs
  with the study lead, examiner supplier, transcription/acoustic providers, and
  model providers.
- Contractually prohibit secure/current IELTS task use, response redistribution,
  and claims that DebateLab produces an official IELTS score.

## Public data rejection record

- [Speak & Improve 2025](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)
  and [Write & Improve 2024](https://researchdatasets.cambridge.org/datasets/write-and-improve-corpus-2024)
  are useful research corpora but do not provide the required commercial,
  operational-IELTS, four-criterion gold labels.
- Public Hugging Face/Kaggle IELTS datasets found in the search lacked adequate
  examiner provenance, commercial rights, or source integrity.
- CEFR learner corpora cannot substitute for IELTS criterion labels.
- Official IELTS sample responses and recordings are sparse overall-band
  anchors, not complete criterion-labelled cases, and IELTS's copyright terms
  do not grant commercial corpus or benchmark use without written permission.
- A newly published corpus claiming expert IELTS Writing labels is not eligible
  until its authors provide an explicit commercial licence, consent/source
  chain, independently verifiable rater credentials, original blind marks,
  adjudication records, and a band-distribution audit.

The new grader stays disabled until the acquired holdout passes the repository's
release gate. Public official examples may inform methodology or preliminary
research but cannot prove examiner-equivalent accuracy by themselves.

## Deterministic low-evidence boundary

The current official Writing descriptors permit only two automatic low-band
decisions that do not require a qualitative examiner judgement:

- a genuine non-attempt is Band 0;
- a response of 20 words or fewer is Band 1 across the Writing criteria.

Bands 2 and 3 describe qualitative task relevance, communication,
organisation, vocabulary, and sentence-form evidence. Word count alone must not
assign them. Speaking Bands 1–3 are also qualitative, and an empty ASR
transcript can represent a recognition failure rather than a non-attempt. Those
cases stay in the human-labelled calibration study and use explicit
limited-confidence/manual-review handling when the evidence is insufficient.

## Examiner-team start packet

The checked-in files are synthetic schemas, not participant material:

- `apps/web/src/scripts/manifests/ielts-benchmark-study-design.v2.json` is the
  current task, band, accent, L1, audio-quality, and minimum-cell design. V2
  requires separate `vi_north`, `vi_central`, and `vi_south` release strata;
  `vi_general` no longer satisfies pronunciation calibration coverage. The V1
  file remains checked in only to interpret historical records.
- `ielts-benchmark-study-manifest.template.json` is a redacted end-to-end
  example. Copy it outside the repository; never commit a completed manifest.
- `ielts-benchmark-study-rater-marks.template.csv` and
  `ielts-benchmark-study-adjudication.template.csv` are collection sheets. They
  are staging formats only; the protected JSON contract remains authoritative.

Before storage upload or database import, validate the assembled manifest
offline. This command reads one local file, makes no network, database, or model
call, and prints counts and recruitment deficits only. Release validation is
the default and exits non-zero if any required stratum is incomplete. Use
`--draft` only while recruiting or assembling a batch; draft success is never a
release result:

```bash
NODE_OPTIONS='--conditions=react-server' npx tsx \
  --tsconfig apps/web/tsconfig.json \
  apps/web/src/scripts/ai-grading-benchmark-study-validate.ts \
  --manifest=/absolute/path/to/protected-manifest.json
```

### Data dictionary

All `*Key` values are lowercase pseudonymous study identifiers. They must not
contain a name, email, phone number, account ID, or test-centre candidate number.

- `candidateKey` groups every artifact from one participant.
- `promptFamilyKey` groups equivalent or reused prompts before splitting.
- `sourceGroupKey` groups one recruitment/licensing cohort.
- `captureSessionKey` groups a full recording or writing sitting and all parts
  derived from it. None of these four groups may cross a split.
- Every group key has a separately verified receipt hash. The study lead signs
  an Ed25519 envelope that binds those receipts, all four keys, the immutable
  response/audio hash, consent receipt, examiner credential proof hashes, and a
  capture-identity receipt. Relabeling a caller-supplied group makes the
  signature invalid instead of silently moving a case between splits.
- `raterKey` and `adjudicatorKey` are pseudonyms assigned by the study lead.
  Credential evidence is represented by its SHA-256 proof, verification time,
  and a separate verifier key; the credential document never enters the
  manifest.
- `criteria` on each rater record are the untouched blind marks. `overallBand`
  must equal the half-up rounded mean of the four criterion marks.
- `declaredBoundaryCrossing` records a preregistered consequential boundary
  even when numeric disagreement is no more than 0.5.
- `consent.scopes.modelTraining` is separate from commercial evaluation.
  Evaluation consent never implies training consent.
- `retentionUntil` is the approved destruction/re-consent deadline. A later
  withdrawal uses the controlled database withdrawal action; gold labels are
  not edited in place.

Speaking uses the controlled accent and L1 codes from the study-design file.
New Vietnamese cases must record `vi_north`, `vi_central`, or `vi_south` when
the protected recruitment record supports that classification. `vi_general`
is retained for historical or region-unknown cases but does not count toward a
V2 release stratum. `other_documented` requires a protected study note but
prevents spelling variants from silently creating a new statistical slice.

### Blind marking and adjudication SOP

1. The study lead assigns the split and all four grouping keys before any rater
   receives an artifact. Examiners never see AI predictions, another examiner's
   mark, learner identity, or split name.
2. Two different credential-verified examiners independently mark all four
   criteria using the exact locked rubric version. Record their untouched marks,
   computed overall, timestamp, and protected mark-sheet locator.
3. Adjudication is mandatory when any criterion or computed overall differs by
   more than 0.5, or when `declaredBoundaryCrossing=true`. The adjudicator must
   be different from both original raters and records the trigger, final four
   bands, computed overall, rationale, and locator. The trigger list must equal
   the observed triggers exactly. Adjudication is rejected when no trigger
   exists.
4. Without adjudication, each final criterion is the half-up rounded mean of the
   two independent marks. With adjudication, the final labels must exactly match
   the adjudication record. The importer rejects any inconsistency.
5. Check the withdrawal registry immediately before manifest assembly. The
   signed release envelope expires no later than 24 hours after that check and
   never after `retentionUntil`; import and release both fail closed on stale or
   expired evidence. Adults
   have no guardian/assent receipts. A minor requires both guardian consent and
   learner assent. Speaking additionally requires voice-processing consent.
6. A different person verifies source rights and examiner credentials. Directly
   consented study material uses `approved_for_benchmark_evaluation`; this does
   not make the source eligible for learner-facing retrieval or model training.
7. Run the offline validator after every batch. Resolve unknown strata, split
   leakage, consent errors, rater disagreement, and coverage deficits before the
   service-role import is requested.

### Offline study-lead attestation

The study lead keeps the Ed25519 private key in an explicit local file. The CLI
rejects private keys and protected manifests unless their mode is `0600`; it
writes signed or refreshed manifests atomically with the same mode and never
prints protected responses, labels, receipts, or examiner records. The public
configuration contains only SPKI DER base64, its SHA-256 fingerprint, and a key
ID deterministically derived from that fingerprint. A trust-set JSON may retain
the previous and replacement public configs during a controlled key rotation.

Run from `apps/web` with absolute paths:

```bash
npm run ai:grading-study-attestation -- keygen --private-key=/protected/study-lead.pem --public-config=/review/study-lead-public.json
npm run ai:grading-study-attestation -- sign --input=/protected/unsigned.json --identity-receipts=/protected/identity-receipts.json --private-key=/protected/study-lead.pem --output=/protected/signed.json --verified-at=2026-09-01T10:30:00.000Z --expires-at=2026-09-02T09:59:00.000Z
npm run ai:grading-study-attestation -- verify --input=/protected/signed.json --trust-set=/review/study-lead-trust-set.json --now=2026-09-01T12:00:00.000Z
npm run ai:grading-study-attestation -- refresh --input=/protected/signed.json --withdrawal-snapshots=/protected/fresh-withdrawal-snapshots.json --trust-set=/review/study-lead-trust-set.json --private-key=/protected/replacement-study-lead.pem --output=/protected/detached-refresh.json --verified-at=2026-09-02T09:00:00.000Z --expires-at=2026-09-02T09:30:00.000Z
```

The signing receipt file has `receiptFileVersion: 1` and one entry per exact
`benchmarkKey`, containing the four grouping receipt hashes and the capture
identity receipt hash. It must match the manifest exactly. Artifact, consent,
withdrawal, grouping, and examiner-credential identities are always rebuilt
from the protected manifest; the signer does not accept caller-supplied copies
of those fields. Refresh verifies every previous signature, requires one exact
fresh withdrawal-registry snapshot per benchmark, and emits a detached signed
attestation file. It never rewrites the protected manifest or its immutable
consent snapshot.

After the original manifest has been imported, apply a detached refresh from
`apps/web`. The trust set must include the replacement public key during key
rotation. The command verifies the detached signature before opening a
privileged database connection, rebinds it to the stored immutable artifact,
consent, grouping, and examiner credential identities, and upserts only
`ai_grading_benchmark_release_attestations`. The database locks the complete
batch, rejects older withdrawal timestamps, and permits only withdrawal and
validity fields to change; out-of-order refresh files cannot roll evidence
backward:

```bash
AI_GRADING_BENCHMARK_ATTESTATION_REFRESH_FILE=/protected/detached-refresh.json \
AI_GRADING_BENCHMARK_TRUST_SET_FILE=/review/study-lead-trust-set.json \
npm run ai:grading-attestation-refresh
```

Remove the previous public key from the trust set only after every active
attestation has been refreshed with the replacement key and the overlap has
been audited. A revoked or absent key fails closed at refresh and release.

### Withdrawal and immutability

Migration `20260901190000_ielts_benchmark_study_integrity.sql` makes protected
labels and study identity immutable at the database boundary. Concurrent
inserts take transaction-scoped advisory locks per source and grouping key, so
two imports cannot race the split check. A database operator first records a
verified withdrawal receipt in the registry that is inaccessible to the
service role. `withdraw_ai_grading_benchmark` accepts only that receipt ID; it
cannot accept a caller-asserted actor or hash. The action is idempotent, writes
an immutable receipt hash/reason/actor audit, and only deactivates the case. It never rewrites
historical labels or reactivates a withdrawn case. Artifact deletion and legal
retention execution remain an operator procedure governed by the study DPA.
