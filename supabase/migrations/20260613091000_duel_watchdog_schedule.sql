-- ============================================================
-- Schedule the duel watchdog.
--
-- advance_overdue_debate_duels() (migration 20260613090200) is the source of
-- forward progress: it advances any in_progress duel past its phase_deadline.
-- This is required for the *prep* and *rebuttal-prep* phases too — those have
-- no speaker to trigger advancement, so without the scheduled watchdog a live
-- duel would stall at "Shared prep". Runs every 5s via pg_cron.
--
-- The no-client judging fallback (pg_net -> /judge when BOTH players are gone
-- at the judging step) is still deferred to the deploy step (needs the prod URL
-- + a shared secret). With a client present, the Phase 2 client-side backstop
-- finishes judging.
-- ============================================================

create extension if not exists pg_cron;

-- Idempotent: cron.schedule upserts by job name.
select cron.schedule(
  'duel-watchdog',
  '5 seconds',
  $$select public.advance_overdue_debate_duels();$$
);
