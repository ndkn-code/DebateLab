# Thinkfy IELTS — content production plan

## TL;DR
Source is abundant — **Cambridge 1–20 Academic (~80 tests) + Cambridge 11 GT + Writing model answers**
(`/Users/jacknguyen/Downloads/Cambridge IELTS BOOKS`). The gate is **throughput (co-founder QA signoff)**,
not source or pipeline. Targets: **Academic 4→12**, a **GT track (4)**, and a **tagged drill bank** (start
now, no source gate). Pipeline + legal are settled — adapt Cambridge (genuine reword + surface swaps + human
QA), counsel-cleared, **do NOT relitigate**. See [[ielts-content-strategy]] + `docs/ielts-content-authoring-spec.md`.

## Source inventory
- Academic: Cambridge **1–20** (each book = 4 tests). Prioritize **18, 19, 20** (freshest; skip 17 — it's the
  current 4 published mocks). 15–16 reserve; 1–14 backup (older topics).
- General Training: **Cambridge 11 GT** (4 tests) + Cambridge 12 GT audio.
- Writing Task 1 **model answers** (docx, books 10–11) → teaching-layer seed.

## Pipeline (proven — do not reinvent)
re-OCR → **transform** (genuine reword + surface swaps, e.g. "a car at 60 km/h" → "a boat at 50 km/h"; NOT
verbatim, NOT pure-AI) → **import as `status='in_qa'`** via the WS-1.1 authoring create-paths (idempotent by
importId; provenance `{sourceBook, sourceTest, transformationSummary}`) → **co-founder QA** (`in_qa` →
published) → **listening-audio backfill**.
**CRITICAL safeguard:** RE-SOLVE every objective key against the FINAL transformed text (prevents the
completion-answer desync that hit mock 1). Verify `desyncs=0` per mock.

## Phases
### Phase 1 — Academic library 4 → 12 (now)
Adapt 8 tests from **Cambridge 18 + 19** (one adaptation card per book = 4 mocks). `module='academic'`,
`band_conversions='default'`. Co-founder QAs at pace (the throttle).

### Phase 2 — GT track (once Phase 1 is rolling)
Adapt **Cambridge 11 GT** (4 tests). NEW authoring: **Reading** (3 everyday/workplace sections) + **Writing
Task 1** (a letter). REUSE: **Listening + Speaking** (identical to Academic — same pipeline + TTS). ADD a
**`general_training` band-conversion row** (GT Reading raw→band is harder than Academic; engine supports a
`band_conversion_key` override via `test.metadata`). Tag `module='general_training'`.

### Phase 3 — Drill bank (now — zero source gate)
Decompose the published mocks' questions into focused **drill-kind `ielts_tests`** (`kind='drill'`), grouped by
**skill · question_type · difficulty** (e.g. "Reading · Matching Headings · Medium"). Prereq: a tagging pass
(subskill + difficulty) on existing questions if missing — **serialize with the PM's Question Bank browser card
if they touch the same files.** Feeds the B2C planner (`skill_drill` items reference these drill tests) + the
Question Bank browser. Seed from the 4 mocks' ~340 questions + controlled variations.

## Bonus — model answers (teaching layer)
Import the Cambridge 10–11 Writing Task 1 model-answer docs as `ielts_question_keys.model_answer` on the
matching writing questions — seeds the teaching-layer differentiator (model answers + annotated feedback).

## Throttle & batching
Co-founder QA is the pace-setter. Produce `in_qa` drafts in **book-sized batches (4 tests)**; publish as QA
clears; keep ~1 book in the `in_qa` queue at a time unless QA capacity is higher. Don't flood.

## Roles
Codex runs adaptation per card → co-founder QAs (`in_qa` → published) → audio backfill → this session
orchestrates (targets, cards, QA tracking, next batch). Content is a **separate parallel track** from the LMS
PM session (`docs/lms-masterplan.md`).

## Card template
```
Adapt <Cambridge N [Academic|GT]> (<4 tests>) into new mocks. Worktree per norm.
SOURCE: <path to the book PDF>.
1. re-OCR per test/section.
2. TRANSFORM: genuine reword + surface swaps (not verbatim/not pure-AI); preserve structure+difficulty;
   provenance {sourceBook, sourceTest, transformationSummary}.
3. IMPORT as status='in_qa' via WS-1.1 create-paths; module=<academic|general_training>; band_conversions=<key>.
4. RE-SOLVE every objective key against the FINAL text; verify desyncs=0.
5. Hand to co-founder QA -> on signoff publish -> listening-audio backfill.
```
