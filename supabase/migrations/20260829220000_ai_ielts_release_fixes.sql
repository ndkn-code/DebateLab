-- AI/IELTS release fixes.
--
-- This migration is intentionally additive.  It closes the database boundaries
-- used by the teacher retry action, the simulation blueprint, and scorer
-- provenance without touching a live database from development tooling.

begin;

-- -----------------------------------------------------------------------------
-- 1. Bounded, idempotent teacher retry for IELTS Writing/Speaking workflows.
-- -----------------------------------------------------------------------------

alter table public.ai_workflow_runs
  add column if not exists manual_retry_count integer not null default 0;

alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_manual_retry_count_check;
alter table public.ai_workflow_runs
  add constraint ai_workflow_runs_manual_retry_count_check
  check (manual_retry_count between 0 and 1);

comment on column public.ai_workflow_runs.manual_retry_count is
  'The single teacher-authorized retry reservation. It is separate from automatic workflow attempts and is never reset.';

create or replace function public.retry_ielts_scoring_workflow(
  p_club_id uuid,
  p_class_id uuid,
  p_attempt_id uuid,
  p_response_id uuid,
  p_response_kind text,
  p_expected_revision integer,
  p_idempotency_key text,
  p_actor_id uuid
)
returns table (
  response_id uuid,
  response_kind text,
  response_revision integer,
  workflow_run_id text,
  status text,
  manual_retry_count integer,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_class_club uuid;
  v_attempt public.ielts_attempts%rowtype;
  v_workflow public.ai_workflow_runs%rowtype;
  v_event public.ielts_scoring_retry_events%rowtype;
  v_source_attempt uuid;
  v_source_user uuid;
  v_source_revision integer;
  v_manual_retry_count integer;
  v_previous_workflow_run text;
  v_reserved_workflow_run text;
begin
  if v_uid is null or p_actor_id is distinct from v_uid then
    raise exception 'FORBIDDEN';
  end if;
  if p_response_kind not in ('writing', 'speaking') then
    raise exception 'IELTS_RESPONSE_KIND_INVALID';
  end if;
  if p_attempt_id is null or p_response_id is null
     or p_expected_revision is null or p_expected_revision < 0
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'IELTS_RETRY_ARGUMENTS_INVALID';
  end if;

  -- Serialize concurrent deliveries for the same idempotency key. Without
  -- this lock, two requests could both observe no event and race to consume
  -- the one manual retry before the unique index resolves the conflict.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_idempotency_key), 0)
  );

  -- This is deliberately narrower than can_manage_class: an ordinary retry
  -- is available only to the active teacher assigned to this exact class.
  if not private.is_assigned_class_teacher(p_class_id, v_uid) then
    raise exception 'FORBIDDEN';
  end if;
  select club_id into v_class_club
    from public.classes
   where id = p_class_id;
  if not found or v_class_club is distinct from p_club_id then
    raise exception 'IELTS_CLASS_CLUB_SCOPE_MISMATCH';
  end if;

  -- A duplicate delivery must be a byte-for-byte equivalent request.  The
  -- event is append-only, so replaying it never consumes the quota again.
  select * into v_event
    from public.ielts_scoring_retry_events
   where idempotency_key = btrim(p_idempotency_key)
   for update;
  if found then
    if v_event.source_kind <> p_response_kind
       or v_event.source_id <> p_response_id
       or v_event.source_revision <> p_expected_revision
       or v_event.attempt_id is distinct from p_attempt_id
       or v_event.class_id is distinct from p_class_id then
      raise exception 'IELTS_RETRY_IDEMPOTENCY_KEY_REUSED';
    end if;
    if p_response_kind = 'writing' then
      select * into v_workflow
        from public.ai_workflow_runs
       where writing_response_id = p_response_id
       for update;
    else
      select * into v_workflow
        from public.ai_workflow_runs
       where speaking_response_id = p_response_id
       for update;
    end if;
    if not found then raise exception 'IELTS_WORKFLOW_NOT_FOUND'; end if;
    return query select
      p_response_id,
      p_response_kind,
      v_event.source_revision,
      v_workflow.workflow_run_id,
      v_workflow.status,
      v_workflow.manual_retry_count,
      true;
    return;
  end if;

  select * into v_attempt
    from public.ielts_attempts
   where id = p_attempt_id
     and club_id = p_club_id
     and class_id = p_class_id
   for update;
  if not found then raise exception 'IELTS_ATTEMPT_SCOPE_MISMATCH'; end if;

  if p_response_kind = 'writing' then
    select wr.attempt_id, wr.user_id, wr.revision
      into v_source_attempt, v_source_user, v_source_revision
      from public.writing_responses wr
     where wr.id = p_response_id
     for update;
  else
    select sr.attempt_id, sr.user_id, sr.revision
      into v_source_attempt, v_source_user, v_source_revision
      from public.speaking_responses sr
     where sr.id = p_response_id
     for update;
  end if;
  if not found or v_source_attempt <> v_attempt.id
     or v_source_user <> v_attempt.user_id then
    raise exception 'IELTS_RESPONSE_SCOPE_MISMATCH';
  end if;
  if v_source_revision <> p_expected_revision then
    raise exception 'IELTS_RESPONSE_REVISION_STALE';
  end if;

  if p_response_kind = 'writing' then
    select * into v_workflow
      from public.ai_workflow_runs
     where writing_response_id = p_response_id
       and workflow_kind = 'ielts_writing_score'
     for update;
  else
    select * into v_workflow
      from public.ai_workflow_runs
     where speaking_response_id = p_response_id
       and workflow_kind = 'ielts_speaking_score'
     for update;
  end if;
  if not found then raise exception 'IELTS_WORKFLOW_NOT_FOUND'; end if;
  if v_workflow.user_id <> v_attempt.user_id then
    raise exception 'IELTS_WORKFLOW_OWNER_MISMATCH';
  end if;
  if v_workflow.status <> 'failed'
     or v_workflow.last_error_code <> 'RETRYABLE_WORKFLOW_FAILED' then
    raise exception 'IELTS_WORKFLOW_NOT_RETRYABLE';
  end if;
  if v_workflow.workflow_attempt_count < 3 then
    raise exception 'IELTS_WORKFLOW_NOT_EXHAUSTED';
  end if;
  if v_workflow.manual_retry_count >= 1 then
    raise exception 'IELTS_MANUAL_RETRY_LIMIT_EXCEEDED';
  end if;

  v_manual_retry_count := v_workflow.manual_retry_count + 1;
  v_previous_workflow_run := v_workflow.workflow_run_id;
  -- The launcher treats a queued row with a NULL provider run id as a fresh
  -- start. Decrementing the exhausted automatic count grants exactly one new
  -- bounded launch; a second manual reservation is blocked above.
  update public.ai_workflow_runs
     set status = 'queued',
         phase = 'queued',
         workflow_run_id = null,
         launch_token = null,
         lease_expires_at = null,
         last_error_code = null,
         last_error_message = null,
         failed_at = null,
         manual_retry_count = v_manual_retry_count,
         workflow_attempt_count = greatest(workflow_attempt_count - 1, 0),
         updated_at = now()
   where id = v_workflow.id;

  if p_response_kind = 'writing' then
    update public.writing_responses
       set status = 'pending', updated_at = now()
     where id = p_response_id;
  else
    update public.speaking_responses
       set status = 'pending', updated_at = now()
     where id = p_response_id;
  end if;

  -- There is no provider run id until the launcher starts. Keep a stable
  -- reservation marker in the append-only event so support can reconcile a
  -- retry even if the process dies between this transaction and launch.
  v_reserved_workflow_run :=
    'manual-retry:' || v_workflow.id::text || ':' || v_manual_retry_count::text;
  insert into public.ielts_scoring_retry_events (
    source_kind, source_id, source_revision, previous_workflow_run,
    new_workflow_run, requested_by, class_id, attempt_id, idempotency_key,
    retry_ordinal
  ) values (
    p_response_kind, p_response_id, p_expected_revision, v_previous_workflow_run,
    v_reserved_workflow_run, v_uid, p_class_id, p_attempt_id,
    btrim(p_idempotency_key), v_manual_retry_count
  );

  return query select
    p_response_id,
    p_response_kind,
    p_expected_revision,
    null::text,
    'queued'::text,
    v_manual_retry_count,
    false;
end;
$$;

revoke all on function public.retry_ielts_scoring_workflow(
  uuid, uuid, uuid, uuid, text, integer, text, uuid
) from public, anon;
grant execute on function public.retry_ielts_scoring_workflow(
  uuid, uuid, uuid, uuid, text, integer, text, uuid
) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Keep every provider output type emitted by the runtime.
-- -----------------------------------------------------------------------------

alter table public.ai_provider_requests
  drop constraint if exists ai_provider_requests_output_type_check;
alter table public.ai_provider_requests
  add constraint ai_provider_requests_output_type_check
  check (
    output_type is null
    or output_type in (
      'rebuttal',
      'practice_judging',
      'duel_judging',
      'coach_chat',
      'coach_deep_review',
      'coach_metadata',
      'coach_title',
      'coach_visual_prompt',
      'coach_visual_planner',
      'ielts_writing_score',
      'ielts_speaking_score',
      'ielts_writing_score_adjudication',
      'ielts_speaking_score_adjudication',
      'ielts_micro_item_drafts',
      'stt_transcript_repair',
      'admin_ai_insights',
      'onboarding_feedback',
      'phoneme_report'
    )
  );

comment on constraint ai_provider_requests_output_type_check
  on public.ai_provider_requests is
  'Closed contract for all runtime provider output types; update this list in the same release as a new outputType.';

-- -----------------------------------------------------------------------------
-- 3. Simulation section order: Listening -> Reading -> Writing at the DB edge.
-- -----------------------------------------------------------------------------

create or replace function private.ielts_simulation_section_order_valid(
  p_skill public.ielts_skill,
  p_section_order integer
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case p_section_order
    when 1 then p_skill = 'listening'::public.ielts_skill
    when 2 then p_skill = 'reading'::public.ielts_skill
    when 3 then p_skill = 'writing'::public.ielts_skill
    else false
  end;
$$;

create or replace function private.validate_ielts_simulation_section_order()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_attempt public.ielts_attempts%rowtype;
begin
  select * into v_attempt
    from public.ielts_attempts
   where id = new.attempt_id;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if new.user_id <> v_attempt.user_id then
    raise exception 'SECTION_OWNER_MISMATCH';
  end if;
  if v_attempt.assessment_mode = 'simulation'
     and not private.ielts_simulation_section_order_valid(new.skill, new.section_order) then
    raise exception 'SIMULATION_SECTION_ORDER_INVALID'
      using detail = 'Simulation sections must be Listening (1), Reading (2), Writing (3)';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_ielts_simulation_section_order
  on public.ielts_attempt_sections;
create trigger validate_ielts_simulation_section_order
  before insert or update of attempt_id, user_id, skill, section_order
  on public.ielts_attempt_sections
  for each row execute function private.validate_ielts_simulation_section_order();

-- A row-level trigger prevents an individual wrong mapping. This deferred
-- constraint trigger prevents a forged/incomplete simulation set from being
-- committed when callers insert sections in separate statements.
create or replace function private.validate_ielts_simulation_blueprint_complete()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_attempt_id uuid := coalesce(new.attempt_id, old.attempt_id);
  v_mode public.ielts_assessment_mode;
begin
  select assessment_mode into v_mode
    from public.ielts_attempts
   where id = v_attempt_id;
  if v_mode = 'simulation' and (
    (select count(*) from public.ielts_attempt_sections where attempt_id = v_attempt_id) <> 3
    or exists (
      select 1 from public.ielts_attempt_sections s
       where s.attempt_id = v_attempt_id
         and not private.ielts_simulation_section_order_valid(s.skill, s.section_order)
    )
  ) then
    raise exception 'SIMULATION_BLUEPRINT_INCOMPLETE'
      using detail = 'Simulation sections must be exactly Listening (1), Reading (2), Writing (3)';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists validate_ielts_simulation_blueprint_complete
  on public.ielts_attempt_sections;
create constraint trigger validate_ielts_simulation_blueprint_complete
  after insert or update or delete on public.ielts_attempt_sections
  deferrable initially deferred
  for each row execute function private.validate_ielts_simulation_blueprint_complete();

revoke execute on function private.ielts_simulation_section_order_valid(public.ielts_skill, integer),
  private.validate_ielts_simulation_section_order(),
  private.validate_ielts_simulation_blueprint_complete()
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Criterion evidence identity + retention.
-- -----------------------------------------------------------------------------

-- Evidence and retry events are audit/provenance records. Restricting deletes
-- preserves the history and makes an attempted parent deletion fail loudly;
-- it avoids silently erasing grading evidence through a cascade.
alter table public.ielts_criterion_evidence
  drop constraint if exists ielts_criterion_evidence_user_id_fkey,
  drop constraint if exists ielts_criterion_evidence_attempt_id_fkey,
  drop constraint if exists ielts_criterion_evidence_question_id_fkey,
  drop constraint if exists ielts_criterion_evidence_writing_response_id_fkey,
  drop constraint if exists ielts_criterion_evidence_speaking_response_id_fkey;
alter table public.ielts_criterion_evidence
  add constraint ielts_criterion_evidence_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete restrict,
  add constraint ielts_criterion_evidence_attempt_id_fkey
    foreign key (attempt_id) references public.ielts_attempts(id) on delete restrict,
  add constraint ielts_criterion_evidence_question_id_fkey
    foreign key (question_id) references public.ielts_questions(id) on delete restrict,
  add constraint ielts_criterion_evidence_writing_response_id_fkey
    foreign key (writing_response_id) references public.writing_responses(id) on delete restrict,
  add constraint ielts_criterion_evidence_speaking_response_id_fkey
    foreign key (speaking_response_id) references public.speaking_responses(id) on delete restrict;

comment on table public.ielts_criterion_evidence is
  'Append-only scorer provenance. Parent rows use ON DELETE RESTRICT so retention is explicit and evidence cannot disappear through cascades.';

alter table public.ielts_scoring_retry_events
  drop constraint if exists ielts_scoring_retry_events_requested_by_fkey,
  drop constraint if exists ielts_scoring_retry_events_attempt_id_fkey;
alter table public.ielts_scoring_retry_events
  add constraint ielts_scoring_retry_events_requested_by_fkey
    foreign key (requested_by) references public.profiles(id) on delete restrict,
  add constraint ielts_scoring_retry_events_attempt_id_fkey
    foreign key (attempt_id) references public.ielts_attempts(id) on delete restrict;
comment on table public.ielts_scoring_retry_events is
  'Append-only retry audit. Actor and attempt retention is protected with ON DELETE RESTRICT.';

create or replace function private.validate_ielts_criterion_evidence_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_attempt_id uuid;
  v_user_id uuid;
  v_question_id uuid;
  v_revision integer;
  v_attempt_user_id uuid;
  v_attempt_test_id uuid;
  v_question_test_id uuid;
begin
  if new.skill = 'writing' then
    if new.writing_response_id is null or new.speaking_response_id is not null
       or new.writing_response_id <> new.response_id then
      raise exception 'IELTS_EVIDENCE_RESPONSE_KIND_MISMATCH';
    end if;
    select attempt_id, user_id, question_id, revision
      into v_attempt_id, v_user_id, v_question_id, v_revision
      from public.writing_responses
     where id = new.writing_response_id;
  elsif new.skill = 'speaking' then
    if new.speaking_response_id is null or new.writing_response_id is not null
       or new.speaking_response_id <> new.response_id then
      raise exception 'IELTS_EVIDENCE_RESPONSE_KIND_MISMATCH';
    end if;
    select attempt_id, user_id, question_id, revision
      into v_attempt_id, v_user_id, v_question_id, v_revision
      from public.speaking_responses
     where id = new.speaking_response_id;
  else
    raise exception 'IELTS_EVIDENCE_SKILL_INVALID';
  end if;
  if not found then raise exception 'IELTS_EVIDENCE_RESPONSE_NOT_FOUND'; end if;
  if v_attempt_id <> new.attempt_id or v_user_id <> new.user_id
     or v_question_id <> new.question_id
     or v_revision <> new.source_response_revision then
    raise exception 'IELTS_EVIDENCE_IDENTITY_MISMATCH';
  end if;
  select user_id, test_id into v_attempt_user_id, v_attempt_test_id
    from public.ielts_attempts where id = new.attempt_id;
  if not found or v_attempt_user_id <> new.user_id then
    raise exception 'IELTS_EVIDENCE_ATTEMPT_OWNER_MISMATCH';
  end if;
  select test_id into v_question_test_id
    from public.ielts_questions where id = new.question_id;
  if not found or v_question_test_id <> v_attempt_test_id then
    raise exception 'IELTS_EVIDENCE_ATTEMPT_QUESTION_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_ielts_criterion_evidence_identity
  on public.ielts_criterion_evidence;
create trigger validate_ielts_criterion_evidence_identity
  before insert or update on public.ielts_criterion_evidence
  for each row execute function private.validate_ielts_criterion_evidence_identity();

revoke execute on function private.validate_ielts_criterion_evidence_identity()
  from public, anon, authenticated;

commit;
