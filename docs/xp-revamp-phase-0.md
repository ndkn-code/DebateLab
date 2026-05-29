# XP Revamp Phase 0 Spec

## Objective

XP is the single user-facing progress and competition currency. Phase 1 replaces direct ad hoc XP writes with an XP ledger that can power profile levels, weekly personal leagues, and future school/organization leaderboards.

Existing lifetime XP is preserved as a legacy baseline. Historical activity from the last 90 days can be backfilled into the ledger for season QA, but backfilled events must not add lifetime XP again.

## Season Policy

- Season cadence: weekly.
- Season start: Monday 00:00 in `America/New_York`, matching the current dashboard analytics timezone.
- Season end: the next Monday 00:00 in the same timezone.
- Ranking metric: `season_xp`.
- Profile progression metric: preserved baseline XP plus new `lifetime_xp`.
- Initial tie-breakers for future leaderboard UI: higher season XP, then higher average score metadata where available, then earlier last XP event.

## XP Categories

- `practice`: scored debate/speaking sessions. Competence-first: completion is base XP, with larger bonuses for high score, advanced difficulty, full mode, harder AI, and personal bests.
- `lesson`: lesson/activity completions. XP scales with score where a score exists.
- `course`: course completion bonus. Must be idempotent per user/course.
- `duel`: clean duel participation and results. Integrity-excluded duels should earn zero leaderboard XP.
- `assignment`: verified club/class assignment work. Included as a foundation for organization leaderboards.
- `social`: small capped acknowledgement/kudos placeholder. No UI in Phase 1.
- `legacy`: 90-day backfill rows sourced from existing `activity_log`.

## Caps And Guardrails

- Every award must include a stable idempotency key.
- Duplicate source events return the original ledger row and do not update profile XP, daily stats, activity log, or season totals again.
- Season XP is capped by category per day and per week.
- Practice sessions below the minimum effort threshold should earn zero XP.
- Suspicious, incomplete, failed, or no-contest events should earn zero season XP.
- Direct writes to `profiles.xp` should be retired from application code in favor of the shared award path.

## QA Fixtures

- High-quality low-volume student beats low-quality session spammer because practice XP is capped and score/challenge bonuses matter.
- Beginner improving from their own baseline can compete inside a weekly cohort.
- Advanced user still earns via harder topics, full rounds, hard AI, and personal bests.
- Small active organization can later compete with large inactive organization because organization totals track active contributors separately from raw member count.

