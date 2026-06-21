# Wave 6.3 Workstream B — Band-prediction validation harness

Status: BUILT (synthetic-validated, pre-launch). Pure, fully-tested, **no user-facing
change**. Lives in `apps/web/src/lib/scoring/ielts-prediction/`. v1 stays served.

This is the moat from the plan: a *calibrated, evidence-grounded, self-validating*
predictor instead of a guess. The harness lets us prove `weighted-recency-v1` and keep
improving it — on synthetic data now, on real cohorts after launch — without shipping an
unproven model.

## Modules

| File | What it is |
|---|---|
| `metrics.ts` | Pure stats: MAE, signed bias, RMSE, within-half-band rate, interval coverage, split-conformal recalibration, Brier + skill score, normal CDF/quantile. |
| `backtest.ts` | Replay engine + `weightedRecencyForecaster` (the v1 adapter). |
| `backtest.types.ts` | The `Forecaster` seam + scenario/report types. |
| `irt.ts` | Shadow challenger #1 — a 2PL-IRT-style per-subskill ability estimate. |
| `shadow.ts` | `decidePromotion` gate + `runShadowComparison`. |
| `synthetic.ts` | Deterministic trajectories with a known true ability. |

Run: `npm run test:ielts-prediction` (also picked up by `npm test` and the
`scoring/**` critical-coverage gate via filesystem walk).

## Design decisions (the non-obvious ones)

**No-leakage replay.** At each mock boundary the forecast is recomputed from evidence
dated *strictly before* the mock. A mock's own result lands in the ledger at/after its
timestamp, so `occurredAt < mock.occurredAt` holds it out — the forecast is genuinely
out-of-sample. A boundary whose model returns a diagnostic (null) band is counted in
`skippedDiagnostic`, never silently dropped.

**Calibration = split-conformal.** For each served interval we take the band error in
units of its half-width (`|actual − center| / halfWidth`). `servedCoverage` is the
fraction with score ≤ 1 (i.e. the truth was inside the shipped interval). The
`recommendedScale` is the conformal quantile of those scores at the claimed level — by
construction, multiplying the half-width by it makes empirical coverage match the claim
(item B5: "tune the served interval so empirical coverage matches the claimed level").
Default claimed level 0.8.

**On-track Brier.** The "on track to hit target by test date" forecast is the probability
the predicted overall band meets target, read off a normal whose SD is recovered from the
served interval (`halfWidth / z`). The realized outcome is whether the next mock's actual
overall met target. We report Brier + a skill score vs the base-rate climatology forecast,
so "always predict the base rate" scores 0. (Operationalizing "by test date" as "at the
next realized mock" is the observable ground truth pre-launch; trend-projection to the
exam date can layer on later.)

**The IRT challenger.** Our evidence arrives as aggregated band point-estimates, not raw
item responses, so `irt.ts` is IRT's *measurement core* adapted to that input: each
observation is a reading on the latent ability scale (θ), its Fisher information scales
with the square of its source's **discrimination** (a full mock resolves ability far
better than a learn activity) × reliability·coverage × recency; abilities pool by
information, a weak Gaussian prior regularizes sparse data, and the interval is the genuine
Gaussian posterior. Structurally distinct from v1 (recency-weighted band mean + bucketed
confidence), so the two are worth comparing on calibration.

**Promotion gate (strict).** `decidePromotion` ships a challenger only when it beats v1 on
**both** overall MAE *and* calibration error, by a margin (`maeEpsilon` / `calibrationEpsilon`),
on at least `minBoundaries` boundaries, and **without scoring fewer boundaries than v1**
(so it can't win by abstaining on the hard cases). A model is never promoted over itself.
v1 stays served until the gate says otherwise.

## Pre-launch validation

`synthetic.ts` generates a learner whose true ability we control (seeded mulberry32 +
Box–Muller, no `Math.random`/wall-clock). The tests assert: the metric math returns the
known answer on hand-built inputs; both forecasters recover a stationary true ability
within half a band; the gate's decisions are exactly right on hand-built reports; and the
no-leakage / diagnostic-skip accounting holds. This validates the *math* before any real
cohort exists; post-launch the same engine runs on real `ielts_adaptive_evidence` +
`attempt_band_scores` and validates the *model*.

## Deferred (still Workstream B)

- **B4 Admin "Prediction Quality" dashboard** — aggregate these metrics over users with
  ≥2 mocks (calibration plot, per-skill error, drift). Internal only. Consumes
  `runBacktest`'s `BacktestReport` directly.
- **B2 more challengers** — Elo-style update, small Bayesian model. Each is just another
  `Forecaster`; the gate already handles them.
- **Wiring** — a server path that assembles `BacktestScenario`s from the ledger (reuse
  `band-prediction-repository.ts`'s `mapEvidence`) and a shadow-logging sink. The harness
  is pure on purpose; nothing here touches the DB.
