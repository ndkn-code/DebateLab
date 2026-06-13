-- ============================================================
-- activity_log: allow the 'duel_completed' activity type
--
-- finalize_debate_duel_stats (migration 20260613090300) inserts
-- activity_type='duel_completed' into activity_log, but the check constraint
-- never listed it — so EVERY duel finalization (the participant /judge path and
-- the pg_net handoff alike) would throw on that insert. Because analytics runs
-- before the status='completed' update, the duel would soft-lock in `judging`
-- with the judgment stored but never surfaced. The shadow test's no-cookie
-- finalize scenario caught this.
--
-- Additive, backward-compatible. The profile activity timeline humanizes
-- unknown types, so it renders as "duel completed" with no UI change.
-- ============================================================

alter table public.activity_log
  drop constraint if exists activity_log_activity_type_check;

alter table public.activity_log
  add constraint activity_log_activity_type_check
  check (activity_type = any (array[
    'lesson_completed',
    'quiz_completed',
    'debate_completed',
    'course_started',
    'course_completed',
    'streak_milestone',
    'level_up',
    'chat_session',
    'login',
    'duel_completed'
  ]::text[]));
