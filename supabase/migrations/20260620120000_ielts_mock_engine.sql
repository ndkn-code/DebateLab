-- =============================================================================
-- WS-2.1 — Timed multi-section mock-test engine (Assess mode)
-- =============================================================================
-- A server-authoritative timing layer ON TOP of the WS-0.3 attempt substrate
-- (masterplan §2.7 — a layer, not a core edit). It mirrors the debate-duel
-- server-clock precedent (supabase/migrations/20260613090000_duel_server_clock.sql):
-- per-section deadlines are computed and enforced by the DATABASE using `now()`,
-- inside SECURITY DEFINER functions that verify ownership via auth.uid() and lock
-- the row — so a learner's client can never forge or extend their own timer.
--
-- ADDITIVE ONLY — no existing table is altered destructively (two nullable/default
-- columns are added to ielts_attempt_sections), so it is safe to apply to a live
-- DB. No new tables (RLS-coverage gate unaffected); no json/jsonb score columns
-- (typed-score gate unaffected).
--
-- Contents:
--   1. Pause/resume timing columns on ielts_attempt_sections (typed).
--   2. SECURITY DEFINER timing RPCs (start / pause / resume / record / submit),
--      anchored to DB now(), granted to authenticated (learner-driven).
--   3. Representative `band_conversions` defaults (conversion_key = 'default') so
--      an objective R/L attempt yields a band out of the box; WS-2.2 seeds the
--      exact per-test tables later (higher-priority conversion_key).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Pause/resume timing state (typed columns — never json).
--    paused_at: non-null while a running section's clock is frozen.
--    paused_seconds: accumulated frozen time (audit / analytics).
-- -----------------------------------------------------------------------------
alter table public.ielts_attempt_sections
  add column if not exists paused_at timestamptz;
alter table public.ielts_attempt_sections
  add column if not exists paused_seconds integer not null default 0
    check (paused_seconds >= 0);

-- Watchdog/index parity with the duel server-clock: cheaply find running,
-- overdue sections (deadline in the past, not yet submitted, not paused).
create index if not exists idx_ielts_attempt_sections_overdue
  on public.ielts_attempt_sections(deadline_at)
  where submitted_at is null and paused_at is null;

-- =============================================================================
-- 2. Server-authoritative timing RPCs.
--    All: security definer · search_path '' (every ref schema-qualified) ·
--    verify auth.uid() owns the section · lock the row · use now() (DB clock).
--    Idempotent where it matters (resume-safe across reloads).
-- =============================================================================

-- 2.1 Start (enter) a section: anchor started_at + deadline_at to DB now().
--      Idempotent — re-entering an already-started section does NOT reset the
--      clock (reload/navigation safe). Returns the authoritative deadline.
create or replace function public.ielts_start_attempt_section(
  p_section_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_sec from public.ielts_attempt_sections
  where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;

  if v_sec.started_at is null then
    update public.ielts_attempt_sections
    set started_at = now(),
        deadline_at = case
          when v_sec.time_limit_seconds is null then null
          else now() + make_interval(secs => v_sec.time_limit_seconds)
        end,
        updated_at = now()
    where id = p_section_id
    returning deadline_at into v_sec.deadline_at;
  end if;

  return v_sec.deadline_at;
end;
$$;

-- 2.2 Pause a running section: freeze the clock (idempotent).
create or replace function public.ielts_pause_attempt_section(
  p_section_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_sec from public.ielts_attempt_sections
  where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is not null then return; end if; -- already paused
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at then
    raise exception 'SECTION_EXPIRED';
  end if;

  update public.ielts_attempt_sections
  set paused_at = now(), updated_at = now()
  where id = p_section_id;
end;
$$;

-- 2.3 Resume a paused section: push the deadline out by the frozen duration so
--      the remaining time is preserved; accumulate paused_seconds. Idempotent.
create or replace function public.ielts_resume_attempt_section(
  p_section_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_paused interval;
  v_new_deadline timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_sec from public.ielts_attempt_sections
  where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is null then return v_sec.deadline_at; end if; -- not paused

  v_paused := now() - v_sec.paused_at;

  update public.ielts_attempt_sections
  set deadline_at = case when v_sec.deadline_at is null then null
                         else v_sec.deadline_at + v_paused end,
      paused_seconds = v_sec.paused_seconds + floor(extract(epoch from v_paused))::integer,
      paused_at = null,
      updated_at = now()
  where id = p_section_id
  returning deadline_at into v_new_deadline;

  return v_new_deadline;
end;
$$;

-- 2.4 Record (upsert) an objective answer — atomic + deadline-enforced. The
--      DB rejects writes once the section's server deadline has passed (with a
--      small latency grace) or while paused/submitted, so answers can't be
--      forged after time. Stores only the learner's raw response; grading
--      (is_correct / awarded_points) happens server-side at submit via the
--      service-role grading service, which alone can read ielts_question_keys.
create or replace function public.ielts_record_question_response(
  p_section_id uuid,
  p_question_id uuid,
  p_response jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_attempt public.ielts_attempts%rowtype;
  v_q public.ielts_questions%rowtype;
  v_resp_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_sec from public.ielts_attempt_sections
  where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.submitted_at is not null then raise exception 'SECTION_ALREADY_SUBMITTED'; end if;
  if v_sec.paused_at is not null then raise exception 'SECTION_PAUSED'; end if;
  if v_sec.started_at is null then raise exception 'SECTION_NOT_STARTED'; end if;
  if v_sec.deadline_at is not null and now() > v_sec.deadline_at + interval '2 seconds' then
    raise exception 'SECTION_EXPIRED';
  end if;

  select * into v_attempt from public.ielts_attempts where id = v_sec.attempt_id;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ATTEMPT_NOT_IN_PROGRESS'; end if;

  select * into v_q from public.ielts_questions where id = p_question_id;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  if v_q.test_id <> v_attempt.test_id then raise exception 'QUESTION_NOT_IN_TEST'; end if;
  if v_q.skill <> v_sec.skill then raise exception 'QUESTION_SKILL_MISMATCH'; end if;

  insert into public.ielts_question_responses
    (attempt_id, user_id, question_id, section_id, response)
  values
    (v_sec.attempt_id, v_uid, p_question_id, p_section_id, coalesce(p_response, '{}'::jsonb))
  on conflict (attempt_id, question_id) do update
    set response = excluded.response, updated_at = now()
  returning id into v_resp_id;

  return v_resp_id;
end;
$$;

-- 2.5 Submit (finalize) a section: lock it from further answers. Idempotent.
create or replace function public.ielts_submit_attempt_section(
  p_section_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sec public.ielts_attempt_sections%rowtype;
  v_submitted timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_sec from public.ielts_attempt_sections
  where id = p_section_id for update;
  if not found then raise exception 'SECTION_NOT_FOUND'; end if;
  if v_sec.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_sec.submitted_at is not null then return v_sec.submitted_at; end if; -- idempotent

  update public.ielts_attempt_sections
  set submitted_at = now(), paused_at = null, updated_at = now()
  where id = p_section_id
  returning submitted_at into v_submitted;

  return v_submitted;
end;
$$;

-- Lock down the RPC surface: learner-driven (auth.uid()); never anon. service_role
-- writes attempt/score rows directly (grading) rather than via these.
revoke execute on function public.ielts_start_attempt_section(uuid) from public, anon;
revoke execute on function public.ielts_pause_attempt_section(uuid) from public, anon;
revoke execute on function public.ielts_resume_attempt_section(uuid) from public, anon;
revoke execute on function public.ielts_record_question_response(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.ielts_submit_attempt_section(uuid) from public, anon;

grant execute on function public.ielts_start_attempt_section(uuid) to authenticated, service_role;
grant execute on function public.ielts_pause_attempt_section(uuid) to authenticated, service_role;
grant execute on function public.ielts_resume_attempt_section(uuid) to authenticated, service_role;
grant execute on function public.ielts_record_question_response(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.ielts_submit_attempt_section(uuid) to authenticated, service_role;

-- =============================================================================
-- 3. Representative band_conversions defaults (conversion_key = 'default').
--    Approximate/representative per authoring-spec §7; ranges tile 0..40 with no
--    gaps so every raw maps to exactly one band. WS-2.2 seeds the exact per-test
--    tables under a test-specific conversion_key (the grader prefers those).
--    Guarded so re-running the migration (or the Docker harness) is idempotent.
-- =============================================================================
insert into public.band_conversions
  (conversion_key, skill, module, band, raw_min, raw_max)
select v.conversion_key, v.skill::public.ielts_skill, v.module::public.ielts_module,
       v.band::numeric(2,1), v.raw_min, v.raw_max
from (values
  -- Listening (module-independent → null)
  ('default','listening',null,9.0,39,40),
  ('default','listening',null,8.5,37,38),
  ('default','listening',null,8.0,35,36),
  ('default','listening',null,7.5,32,34),
  ('default','listening',null,7.0,30,31),
  ('default','listening',null,6.5,26,29),
  ('default','listening',null,6.0,23,25),
  ('default','listening',null,5.5,18,22),
  ('default','listening',null,5.0,16,17),
  ('default','listening',null,4.5,13,15),
  ('default','listening',null,4.0,10,12),
  ('default','listening',null,3.5,8,9),
  ('default','listening',null,3.0,6,7),
  ('default','listening',null,2.5,4,5),
  ('default','listening',null,2.0,2,3),
  ('default','listening',null,1.0,1,1),
  ('default','listening',null,0.0,0,0),
  -- Academic Reading
  ('default','reading','academic',9.0,39,40),
  ('default','reading','academic',8.5,37,38),
  ('default','reading','academic',8.0,35,36),
  ('default','reading','academic',7.5,33,34),
  ('default','reading','academic',7.0,30,32),
  ('default','reading','academic',6.5,27,29),
  ('default','reading','academic',6.0,23,26),
  ('default','reading','academic',5.5,19,22),
  ('default','reading','academic',5.0,15,18),
  ('default','reading','academic',4.5,13,14),
  ('default','reading','academic',4.0,10,12),
  ('default','reading','academic',3.5,8,9),
  ('default','reading','academic',3.0,6,7),
  ('default','reading','academic',2.5,4,5),
  ('default','reading','academic',2.0,2,3),
  ('default','reading','academic',1.0,1,1),
  ('default','reading','academic',0.0,0,0),
  -- General Training Reading
  ('default','reading','general_training',9.0,40,40),
  ('default','reading','general_training',8.5,39,39),
  ('default','reading','general_training',8.0,37,38),
  ('default','reading','general_training',7.5,36,36),
  ('default','reading','general_training',7.0,34,35),
  ('default','reading','general_training',6.5,32,33),
  ('default','reading','general_training',6.0,30,31),
  ('default','reading','general_training',5.5,27,29),
  ('default','reading','general_training',5.0,23,26),
  ('default','reading','general_training',4.5,19,22),
  ('default','reading','general_training',4.0,15,18),
  ('default','reading','general_training',3.5,12,14),
  ('default','reading','general_training',3.0,9,11),
  ('default','reading','general_training',2.5,6,8),
  ('default','reading','general_training',2.0,3,5),
  ('default','reading','general_training',1.0,1,2),
  ('default','reading','general_training',0.0,0,0)
) as v(conversion_key, skill, module, band, raw_min, raw_max)
where not exists (
  select 1 from public.band_conversions b where b.conversion_key = 'default'
);

commit;
