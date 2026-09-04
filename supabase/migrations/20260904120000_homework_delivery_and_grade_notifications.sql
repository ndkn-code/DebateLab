-- S1 · Close the student homework round trip.
--
-- Three defects, all verified empirically against a replica of production on
-- 2026-09-04 with zero submissions ever recorded live:
--
--   1. Every file-bearing submission dies on its first server call.
--      `public.reserve_homework_submission` (20260829030000, the reliability
--      migration) deliberately writes `submitted_at = null` until the upload is
--      finalized, but `club_assignment_submissions.submitted_at` has been
--      `not null` since 020_club_os_v1.sql:150. Reproduced exactly:
--        ERROR: null value in column "submitted_at" of relation
--               "club_assignment_submissions" violates not-null constraint
--      Text-only submissions are unaffected (they insert `now()`), which is why
--      this survived review. `finalize_homework_submission` sets `submitted_at`
--      when the row reaches `submitted`, so every reader that filters
--      `submission_state = 'submitted'` still sees a non-null value.
--
--   2. Assignments that are not IELTS mocks never notify anybody.
--      `private.enqueue_lms_assignment_published` required
--      `assignment_type = 'ielts_mock' and ielts_test_id is not null`, so the
--      homework a teacher creates through `ClubHomeworkAssignForm`
--      (`assignmentType: "case"`) was silent.
--
--   3. Grading never notifies the learner at all. No trigger existed on
--      `club_assignment_submissions`; the student-facing notification UI
--      (`StudentLmsWeek.tsx`) was finished and bilingual with no producer
--      behind it.
--
-- The flag gate needs no change: `private.enqueue_lms_outbox` was widened by
-- 20260831100000_teacher_workspace_v2.sql:182-191 to accept either
-- `ielts_lms_pilot_v1` or `teacher_workspace_v2` via
-- `private.lms_occurrence_feature_enabled`, so a club running only
-- `teacher_workspace_v2` is no longer silently dropped.
--
-- All DDL precedes any DML (there is none) per the single-transaction rule.

-- 1 ------------------------------------------------------------------------
alter table public.club_assignment_submissions
  alter column submitted_at drop not null;

comment on column public.club_assignment_submissions.submitted_at is
  'Null while the submission is draft/uploading; set by finalize_homework_submission when the row reaches submission_state = ''submitted''.';

-- 1b -----------------------------------------------------------------------
-- A teacher-requested revision must survive the deadline.
--
-- `reserve_homework_submission` raised ASSIGNMENT_PAST_DUE before it looked for
-- a `resubmit_requested` predecessor, so once a due date passed, a learner the
-- teacher had explicitly asked to resubmit was locked out permanently — there
-- is no late-submission concept anywhere in the schema. Reproduced:
--   ERROR: ASSIGNMENT_PAST_DUE  (grade_status = 'resubmit_requested', due_at in the past)
--
-- The only change below is moving that one check after `previous_id` is
-- resolved, so the deadline still closes first submissions but an explicit
-- revision request reopens exactly that learner's attempt. Everything else is
-- byte-for-byte the 20260829030000 definition.
create or replace function public.reserve_homework_submission(
  p_assignment_id uuid,
  p_user_id uuid,
  p_idempotency_key uuid,
  p_submission_text text,
  p_file_intents jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  assignment_row public.club_assignments%rowtype;
  existing_id uuid;
  existing_state text;
  previous_id uuid;
  revision_value integer := 0;
  finalized_count integer;
  intent_count integer := coalesce(jsonb_array_length(coalesce(p_file_intents, '[]'::jsonb)), 0);
  new_id uuid;
begin
  if uid is null or p_user_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  perform set_config('app.homework_reservation', 'on', true);

  select * into assignment_row
  from public.club_assignments
  where id = p_assignment_id
  for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if not private.can_submit_homework_assignment(assignment_row.id, uid) then
    raise exception 'NOT_ENROLLED';
  end if;
  if assignment_row.status <> 'active' then raise exception 'ASSIGNMENT_NOT_ACCEPTING_SUBMISSIONS'; end if;
  if coalesce(length(btrim(coalesce(p_submission_text, ''))), 0) > 0 and not assignment_row.submission_text_enabled then
    raise exception 'TEXT_NOT_ACCEPTED';
  end if;
  if intent_count > 0 and not assignment_row.submission_files_enabled then
    raise exception 'FILES_NOT_ACCEPTED';
  end if;
  if intent_count > assignment_row.submission_max_files then raise exception 'TOO_MANY_FILES'; end if;

  select id into existing_id
  from public.club_assignment_submissions
  where assignment_id = p_assignment_id
    and user_id = uid
    and idempotency_key = p_idempotency_key
  for update;
  if existing_id is not null then
    select submission_state into existing_state
    from public.club_assignment_submissions
    where id = existing_id;
    if existing_state = 'failed' then
      raise exception 'FAILED_SUBMISSION_REQUIRES_NEW_IDEMPOTENCY_KEY';
    end if;
    return existing_id;
  end if;

  select count(*)::integer into finalized_count
  from public.club_assignment_submissions
  where assignment_id = p_assignment_id
    and user_id = uid
    and submission_state = 'submitted';

  select s.id into previous_id
  from public.club_assignment_submissions s
  where s.assignment_id = p_assignment_id
    and s.user_id = uid
    and s.submission_state = 'submitted'
    and s.grade_status = 'resubmit_requested'
    and s.revision_number = 0
    and not exists (
      select 1 from public.club_assignment_submissions revision
      where revision.revision_of = s.id
    )
  order by s.submitted_at desc nulls last, s.created_at desc
  limit 1;

  -- Moved: the deadline blocks a first attempt, never a revision the teacher asked for.
  if previous_id is null
     and assignment_row.due_at is not null
     and assignment_row.due_at < now() then
    raise exception 'ASSIGNMENT_PAST_DUE';
  end if;

  if previous_id is not null then
    revision_value := 1;
  elsif finalized_count >= assignment_row.required_attempts then
    raise exception 'ATTEMPTS_EXHAUSTED';
  end if;

  insert into public.club_assignment_submissions (
    assignment_id, club_id, class_id, user_id, source_type, source_id,
    submission_text, status, grade_status, submission_state,
    idempotency_key, revision_of, revision_number, metadata,
    submitted_at, updated_at
  ) values (
    assignment_row.id, assignment_row.club_id, assignment_row.class_id, uid,
    'homework', null, nullif(btrim(coalesce(p_submission_text, '')), ''),
    'submitted', 'submitted', case when intent_count = 0 then 'submitted' else 'draft' end,
    p_idempotency_key, previous_id, revision_value,
    jsonb_build_object('file_intent_count', intent_count),
    case when intent_count = 0 then now() else null end, now()
  ) returning id into new_id;

  if intent_count > 0 then
    insert into public.assignment_submission_files (
      submission_id, club_id, user_id, storage_path, file_name, mime_type, size_bytes, state
    )
    select new_id, assignment_row.club_id, uid, item->>'storagePath', item->>'fileName',
      nullif(item->>'mimeType', ''), (item->>'sizeBytes')::bigint, 'pending'
    from jsonb_array_elements(coalesce(p_file_intents, '[]'::jsonb)) item;
  end if;
  return new_id;
end;
$$;

-- 2 ------------------------------------------------------------------------
create or replace function private.enqueue_lms_assignment_published()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_club_id uuid;
begin
  if new.class_id is null or new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;

  select c.club_id into v_club_id
  from public.classes c
  where c.id = new.class_id;
  if v_club_id is null then return new; end if;

  -- An IELTS mock without a linked test is not yet openable, so stay quiet.
  -- Every other assignment type is actionable the moment it goes active.
  if new.assignment_type = 'ielts_mock' and new.ielts_test_id is null then
    return new;
  end if;

  -- enqueue_lms_outbox is the authority on pilot flags and program type; it
  -- returns null and writes nothing when the class is not enrolled.
  perform private.enqueue_lms_outbox(
    v_club_id,
    new.class_id,
    'assignment_published',
    'assignment-published:' || new.id::text,
    -- The notification copy is rendered bilingually from `event_type` +
    -- `payload` on the learner surface; title/body stay as the plain-text
    -- fallback for the email dispatcher and for older clients.
    jsonb_build_object(
      'assignmentId', new.id,
      'assignmentType', new.assignment_type,
      'assignmentTitle', new.title
    ),
    'New assignment',
    'A new assignment is available: ' || new.title
  );
  return new;
end;
$$;

-- Due-soon reminders were filtered to IELTS mocks for the same reason. Only the
-- WHERE clause changes; the signature, dedupe key, copy and service_role-only
-- grant are preserved so already-sent mock reminders are not re-sent.
create or replace function public.enqueue_lms_due_soon_events(p_horizon interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare v_row record; v_count integer := 0;
begin
  for v_row in
    select a.id, a.club_id, a.class_id, a.title, a.due_at
    from public.club_assignments a
    join public.classes c on c.id = a.class_id
    where a.class_id is not null
      and a.status = 'active'
      and a.due_at is not null
      and (a.assignment_type <> 'ielts_mock' or a.ielts_test_id is not null)
      and a.due_at > now()
      and a.due_at <= now() + p_horizon
  loop
    perform private.enqueue_lms_outbox(
      v_row.club_id,
      v_row.class_id,
      'due_soon',
      'assignment-due-soon:' || v_row.id::text,
      jsonb_build_object('assignmentId', v_row.id, 'dueAt', v_row.due_at),
      'Assignment due soon',
      'Assignment "' || v_row.title || '" is due soon.'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 3 ------------------------------------------------------------------------
-- Carry the outbox payload onto the notification row.
--
-- `lms_notifications.title`/`body` are written in English by SECURITY DEFINER
-- triggers that cannot know the reader's locale, and Vietnamese is this
-- product's default. With the payload on the row the learner surface can render
-- its own bilingual copy from `event_type` + the assignment title, keeping the
-- stored English only as a fallback (and for the email dispatcher).
alter table public.lms_notifications
  add column if not exists payload jsonb not null default '{}'::jsonb;

create or replace function private.materialize_lms_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_recipient text;
  v_title text := coalesce(new.payload #>> '{notification,title}', initcap(replace(new.event_type, '_', ' ')));
  v_body text := coalesce(new.payload #>> '{notification,body}', 'There is a new update in your class.');
  v_payload jsonb := coalesce(new.payload, '{}'::jsonb) - 'notification';
begin
  for v_recipient in select jsonb_array_elements_text(new.recipient_ids) loop
    insert into public.lms_notifications(recipient_id, outbox_event_id, event_type, dedupe_key, title, body, payload)
    values (v_recipient::uuid, new.id, new.event_type, new.dedupe_key, v_title, v_body, v_payload)
    on conflict (recipient_id, dedupe_key) do nothing;
  end loop;
  return new;
end;
$$;

-- 4 ------------------------------------------------------------------------
create or replace function private.enqueue_lms_homework_graded()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_assignment_title text;
  v_title text;
  v_body text;
begin
  if new.grade_status is not distinct from old.grade_status then return new; end if;
  if new.grade_status not in ('graded', 'returned', 'resubmit_requested') then return new; end if;
  -- Only a finalized submission has feedback worth telling a learner about.
  if new.submission_state <> 'submitted' then return new; end if;

  select a.title into v_assignment_title
  from public.club_assignments a
  where a.id = new.assignment_id;

  if new.grade_status = 'resubmit_requested' then
    v_title := 'Revision requested';
    v_body := 'Your teacher asked you to resubmit: ' || coalesce(v_assignment_title, 'your assignment');
  else
    v_title := 'Feedback ready';
    v_body := 'Your teacher returned feedback on: ' || coalesce(v_assignment_title, 'your assignment');
  end if;

  perform private.enqueue_lms_outbox(
    new.club_id,
    new.class_id,
    'returned',
    'homework-graded:' || new.id::text || ':' || new.grade_status || ':'
      || to_char(coalesce(new.graded_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USZ'),
    jsonb_build_object(
      'assignmentId', new.assignment_id,
      'submissionId', new.id,
      'gradeStatus', new.grade_status,
      'assignmentTitle', v_assignment_title
    ),
    v_title,
    v_body,
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists lms_homework_graded on public.club_assignment_submissions;
create trigger lms_homework_graded
after update of grade_status on public.club_assignment_submissions
for each row execute function private.enqueue_lms_homework_graded();

revoke all on function private.enqueue_lms_homework_graded() from public, anon, authenticated;
