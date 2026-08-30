-- IELTS teacher review and gradebook foundation.
-- Additive: AI scorer rows remain the source of the original machine score;
-- teacher decisions are stored separately and become effective only when
-- published. Review events are append-only by policy.

begin;

alter table public.writing_responses
  add column if not exists revision integer not null default 0
    check (revision >= 0),
  add column if not exists revision_grant integer
    check (revision_grant is null or revision_grant > revision),
  add column if not exists revision_consumed_at timestamptz;

alter table public.speaking_responses
  add column if not exists revision integer not null default 0
    check (revision >= 0),
  add column if not exists revision_grant integer
    check (revision_grant is null or revision_grant > revision),
  add column if not exists revision_consumed_at timestamptz;

-- A returned review grants one and only one content-changing resubmission.
-- Existing learner submission code does not need a new wire shape: the trigger
-- consumes the grant when the existing upsert changes the essay/audio.
create or replace function private.consume_ielts_writing_revision()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.revision, 0) <> 0 or new.revision_grant is not null
       or new.revision_consumed_at is not null then
      raise exception 'IELTS_INITIAL_REVISION_INVALID';
    end if;
  elsif current_setting('app.ielts_revision_grant', true) = 'on' then
    if new.revision <> old.revision or new.revision_grant <> old.revision + 1
       or new.revision_consumed_at is distinct from old.revision_consumed_at then
      raise exception 'IELTS_REVISION_GRANT_INVALID';
    end if;
  elsif tg_op = 'UPDATE' and old.revision_grant is not null
     and new.essay is distinct from old.essay then
    new.revision := old.revision_grant;
    new.revision_grant := null;
    new.revision_consumed_at := now();
  elsif new.revision <> old.revision
     or new.revision_grant is distinct from old.revision_grant
     or new.revision_consumed_at is distinct from old.revision_consumed_at then
    raise exception 'IELTS_REVISION_FIELDS_IMMUTABLE';
  end if;
  return new;
end;
$$;

create or replace function private.consume_ielts_speaking_revision()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.revision, 0) <> 0 or new.revision_grant is not null
       or new.revision_consumed_at is not null then
      raise exception 'IELTS_INITIAL_REVISION_INVALID';
    end if;
  elsif current_setting('app.ielts_revision_grant', true) = 'on' then
    if new.revision <> old.revision or new.revision_grant <> old.revision + 1
       or new.revision_consumed_at is distinct from old.revision_consumed_at then
      raise exception 'IELTS_REVISION_GRANT_INVALID';
    end if;
  elsif tg_op = 'UPDATE' and old.revision_grant is not null
     and new.audio_storage_path is distinct from old.audio_storage_path then
    new.revision := old.revision_grant;
    new.revision_grant := null;
    new.revision_consumed_at := now();
  elsif new.revision <> old.revision
     or new.revision_grant is distinct from old.revision_grant
     or new.revision_consumed_at is distinct from old.revision_consumed_at then
    raise exception 'IELTS_REVISION_FIELDS_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists consume_ielts_writing_revision on public.writing_responses;
create trigger consume_ielts_writing_revision
  before insert or update on public.writing_responses
  for each row execute function private.consume_ielts_writing_revision();

drop trigger if exists consume_ielts_speaking_revision on public.speaking_responses;
create trigger consume_ielts_speaking_revision
  before insert or update on public.speaking_responses
  for each row execute function private.consume_ielts_speaking_revision();

create table if not exists public.ielts_teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  assignment_id uuid references public.club_assignments(id) on delete set null,
  writing_response_id uuid references public.writing_responses(id) on delete cascade,
  speaking_response_id uuid references public.speaking_responses(id) on delete cascade,
  review_kind text not null check (review_kind in ('writing', 'speaking')),
  rubric_key text not null default 'ielts_official_v1',
  rubric_version integer not null default 1 check (rubric_version > 0),
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'returned')),
  task_number integer check (task_number in (1, 2)),
  part_number integer check (part_number in (1, 2, 3)),
  task_response_band numeric(2, 1) check (task_response_band is null or (task_response_band >= 0 and task_response_band <= 9 and task_response_band * 2 = trunc(task_response_band * 2))),
  coherence_cohesion_band numeric(2, 1) check (coherence_cohesion_band is null or (coherence_cohesion_band >= 0 and coherence_cohesion_band <= 9 and coherence_cohesion_band * 2 = trunc(coherence_cohesion_band * 2))),
  lexical_resource_band numeric(2, 1) check (lexical_resource_band is null or (lexical_resource_band >= 0 and lexical_resource_band <= 9 and lexical_resource_band * 2 = trunc(lexical_resource_band * 2))),
  grammar_band numeric(2, 1) check (grammar_band is null or (grammar_band >= 0 and grammar_band <= 9 and grammar_band * 2 = trunc(grammar_band * 2))),
  fluency_coherence_band numeric(2, 1) check (fluency_coherence_band is null or (fluency_coherence_band >= 0 and fluency_coherence_band <= 9 and fluency_coherence_band * 2 = trunc(fluency_coherence_band * 2))),
  pronunciation_band numeric(2, 1) check (pronunciation_band is null or (pronunciation_band >= 0 and pronunciation_band <= 9 and pronunciation_band * 2 = trunc(pronunciation_band * 2))),
  task_band numeric(2, 1) check (task_band is null or (task_band >= 0 and task_band <= 9 and task_band * 2 = trunc(task_band * 2))),
  skill_band numeric(2, 1) check (skill_band is null or (skill_band >= 0 and skill_band <= 9 and skill_band * 2 = trunc(skill_band * 2))),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewer_note text,
  returned_note text,
  published_at timestamptz,
  returned_at timestamptz,
  revision_granted integer check (revision_granted is null or revision_granted > revision),
  revision_consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((writing_response_id is not null) <> (speaking_response_id is not null)),
  check ((review_kind = 'writing' and writing_response_id is not null and speaking_response_id is null and part_number is null)
    or (review_kind = 'speaking' and speaking_response_id is not null and writing_response_id is null and task_number is null)),
  unique (reviewer_id, writing_response_id, revision),
  unique (reviewer_id, speaking_response_id, revision)
);

-- Older local databases may already have this draft-shape check. Speaking
-- drafts are intentionally allowed to be empty/partial; publication below
-- remains the completeness gate.
alter table public.ielts_teacher_reviews
  drop constraint if exists ielts_teacher_reviews_check3;

create table if not exists public.ielts_teacher_review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.ielts_teacher_reviews(id) on delete cascade,
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('created', 'updated', 'published', 'returned', 'revision_submitted')),
  from_status text check (from_status is null or from_status in ('draft', 'published', 'returned')),
  to_status text check (to_status is null or to_status in ('draft', 'published', 'returned')),
  revision integer not null check (revision >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ielts_effective_attempt_scores (
  attempt_id uuid primary key references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  listening_band numeric(2, 1) check (listening_band is null or (listening_band >= 0 and listening_band <= 9 and listening_band * 2 = trunc(listening_band * 2))),
  reading_band numeric(2, 1) check (reading_band is null or (reading_band >= 0 and reading_band <= 9 and reading_band * 2 = trunc(reading_band * 2))),
  writing_band numeric(2, 1) check (writing_band is null or (writing_band >= 0 and writing_band <= 9 and writing_band * 2 = trunc(writing_band * 2))),
  speaking_band numeric(2, 1) check (speaking_band is null or (speaking_band >= 0 and speaking_band <= 9 and speaking_band * 2 = trunc(speaking_band * 2))),
  overall_band numeric(2, 1) check (overall_band is null or (overall_band >= 0 and overall_band <= 9 and overall_band * 2 = trunc(overall_band * 2))),
  provisional_band numeric(2, 1) check (provisional_band is null or (provisional_band >= 0 and provisional_band <= 9 and provisional_band * 2 = trunc(provisional_band * 2))),
  overall_is_provisional boolean not null default true,
  score_source text not null default 'ai' check (score_source in ('ai', 'teacher', 'mixed')),
  computed_at timestamptz not null default now()
);

create index if not exists ielts_teacher_reviews_attempt_idx on public.ielts_teacher_reviews(attempt_id, status, updated_at desc);
create index if not exists ielts_teacher_reviews_class_idx on public.ielts_teacher_reviews(class_id, status, updated_at desc);
create index if not exists ielts_teacher_reviews_response_idx on public.ielts_teacher_reviews(writing_response_id, speaking_response_id, revision);
create unique index if not exists ielts_teacher_reviews_published_writing_uidx
  on public.ielts_teacher_reviews(writing_response_id, revision)
  where status = 'published' and writing_response_id is not null;
create unique index if not exists ielts_teacher_reviews_published_speaking_uidx
  on public.ielts_teacher_reviews(speaking_response_id, revision)
  where status = 'published' and speaking_response_id is not null;
create index if not exists ielts_teacher_review_events_review_idx on public.ielts_teacher_review_events(review_id, created_at desc);
create index if not exists ielts_teacher_review_events_attempt_idx on public.ielts_teacher_review_events(attempt_id, created_at desc);
create index if not exists ielts_effective_attempt_scores_class_idx on public.ielts_effective_attempt_scores(class_id, computed_at desc);
create index if not exists ielts_writing_revision_idx on public.writing_responses(attempt_id, revision, revision_grant);
create index if not exists ielts_speaking_revision_idx on public.speaking_responses(attempt_id, revision, revision_grant);

create or replace function private.audit_ielts_revision_submission()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare matched_review record;
begin
  if new.revision = old.revision then return new; end if;
  if tg_table_name = 'writing_responses' then
    select tr.id, tr.attempt_id into matched_review
    from public.ielts_teacher_reviews tr
    where tr.writing_response_id = new.id and tr.status = 'returned'
      and tr.revision = old.revision and tr.revision_granted = new.revision
    order by tr.returned_at desc limit 1 for update;
  else
    select tr.id, tr.attempt_id into matched_review
    from public.ielts_teacher_reviews tr
    where tr.speaking_response_id = new.id and tr.status = 'returned'
      and tr.revision = old.revision and tr.revision_granted = new.revision
    order by tr.returned_at desc limit 1 for update;
  end if;
  if matched_review.id is null then raise exception 'IELTS_RETURNED_REVIEW_NOT_FOUND'; end if;
  update public.ielts_teacher_reviews
  set revision_consumed_at = now(), updated_at = now()
  where id = matched_review.id and revision_consumed_at is null;
  insert into public.ielts_teacher_review_events(
    review_id, attempt_id, actor_id, event_type, from_status, to_status, revision, payload
  ) values (
    matched_review.id, matched_review.attempt_id, new.user_id, 'revision_submitted',
    'returned', 'returned', new.revision, jsonb_build_object('previousRevision', old.revision)
  );
  return new;
end;
$$;

drop trigger if exists audit_ielts_writing_revision_submission on public.writing_responses;
create trigger audit_ielts_writing_revision_submission
  after update of revision on public.writing_responses
  for each row execute function private.audit_ielts_revision_submission();
drop trigger if exists audit_ielts_speaking_revision_submission on public.speaking_responses;
create trigger audit_ielts_speaking_revision_submission
  after update of revision on public.speaking_responses
  for each row execute function private.audit_ielts_revision_submission();

-- Never trust a client-supplied class/club/user or response kind. This trigger
-- makes the denormalized review scope agree with the attempt and source row,
-- preserving cross-club isolation even for direct PostgREST writes.
create or replace function private.validate_ielts_teacher_review_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  a record;
  r record;
begin
  select id, user_id, club_id, class_id, assignment_id into a
    from public.ielts_attempts where id = new.attempt_id;
  if not found or a.user_id <> new.user_id or a.club_id is distinct from new.club_id
     or a.class_id is distinct from new.class_id or a.assignment_id is distinct from new.assignment_id then
    raise exception 'IELTS_REVIEW_SCOPE_MISMATCH';
  end if;
  if new.review_kind = 'writing' then
    select attempt_id, user_id, task_number, revision into r from public.writing_responses where id = new.writing_response_id;
    if not found or r.attempt_id <> new.attempt_id or r.user_id <> new.user_id
       or r.task_number is distinct from new.task_number or r.revision <> new.revision then
      raise exception 'IELTS_WRITING_REVIEW_SCOPE_MISMATCH';
    end if;
  else
    select attempt_id, user_id, part_number, revision into r from public.speaking_responses where id = new.speaking_response_id;
    if not found or r.attempt_id <> new.attempt_id or r.user_id <> new.user_id
       or r.part_number is distinct from new.part_number or r.revision <> new.revision then
      raise exception 'IELTS_SPEAKING_REVIEW_SCOPE_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_ielts_teacher_review_scope on public.ielts_teacher_reviews;
create trigger validate_ielts_teacher_review_scope
  before insert or update on public.ielts_teacher_reviews
  for each row execute function private.validate_ielts_teacher_review_scope();

create or replace function private.ielts_half_band(value numeric)
returns numeric language sql immutable strict as $$
  select floor(value * 2 + 0.5) / 2;
$$;

create or replace function private.recompute_ielts_effective_attempt_scores(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  a record; ai record; t1 numeric; t2 numeric; sp numeric; speaking_parts integer;
  l numeric; r numeric; w numeric; s numeric; o numeric; p numeric;
  present integer; teacher_used boolean := false;
begin
  select id, user_id, club_id, class_id into a from public.ielts_attempts where id = p_attempt_id;
  if not found then raise exception 'IELTS_ATTEMPT_NOT_FOUND'; end if;
  select max(listening_band) as listening_band, max(reading_band) as reading_band, max(writing_band) as writing_band, max(speaking_band) as speaking_band into ai
    from public.attempt_band_scores where attempt_id = p_attempt_id;
  l := ai.listening_band; r := ai.reading_band;
  select tr.task_band into t1 from public.ielts_teacher_reviews tr
    join public.writing_responses wr on wr.id = tr.writing_response_id
    where tr.attempt_id = p_attempt_id and tr.review_kind = 'writing' and tr.status = 'published'
      and wr.revision = tr.revision and tr.task_number = 1 order by tr.updated_at desc limit 1;
  select tr.task_band into t2 from public.ielts_teacher_reviews tr
    join public.writing_responses wr on wr.id = tr.writing_response_id
    where tr.attempt_id = p_attempt_id and tr.review_kind = 'writing' and tr.status = 'published'
      and wr.revision = tr.revision and tr.task_number = 2 order by tr.updated_at desc limit 1;
  if t1 is not null and t2 is not null then
    w := private.ielts_half_band((t1 + 2 * t2) / 3);
  else
    -- A single reviewed task is useful criterion feedback, but it is not a
    -- complete Writing skill score. Keep the AI skill band until both tasks
    -- are teacher-published.
    w := ai.writing_band;
  end if;
  select private.ielts_half_band(avg(skill_band)), count(distinct tr.part_number) into sp, speaking_parts
    from public.ielts_teacher_reviews tr
    join public.speaking_responses sr on sr.id = tr.speaking_response_id
    where tr.attempt_id = p_attempt_id and tr.review_kind = 'speaking' and tr.status = 'published'
      and sr.revision = tr.revision and tr.skill_band is not null;
  if sp is not null and speaking_parts = 3 then s := sp; else s := ai.speaking_band; end if;
  if (t1 is not null and t2 is not null) or (sp is not null and speaking_parts = 3) then teacher_used := true; end if;
  present := (case when l is not null then 1 else 0 end) + (case when r is not null then 1 else 0 end)
    + (case when w is not null then 1 else 0 end) + (case when s is not null then 1 else 0 end);
  if present > 0 then p := private.ielts_half_band((coalesce(l, 0) + coalesce(r, 0) + coalesce(w, 0) + coalesce(s, 0)) /
    present); else p := null; end if;
  if present = 4 then o := p; else o := null; end if;
  insert into public.ielts_effective_attempt_scores(attempt_id, user_id, class_id, club_id, listening_band, reading_band, writing_band, speaking_band, overall_band, provisional_band, overall_is_provisional, score_source, computed_at)
  values (a.id, a.user_id, a.class_id, a.club_id, l, r, w, s, o, p, present <> 4, case when teacher_used then 'mixed' else 'ai' end, now())
  on conflict (attempt_id) do update set user_id = excluded.user_id, class_id = excluded.class_id, club_id = excluded.club_id, listening_band = excluded.listening_band, reading_band = excluded.reading_band, writing_band = excluded.writing_band, speaking_band = excluded.speaking_band, overall_band = excluded.overall_band, provisional_band = excluded.provisional_band, overall_is_provisional = excluded.overall_is_provisional, score_source = excluded.score_source, computed_at = excluded.computed_at;
end;
$$;

-- Replace the prior JSON-shaped overload so old clients cannot bypass the
-- revision precondition or invoke an untyped score contract.
drop function if exists public.save_ielts_teacher_review(uuid, uuid, uuid, uuid, uuid, jsonb, text, uuid);

create or replace function public.save_ielts_teacher_review(
  p_attempt_id uuid, p_class_id uuid, p_club_id uuid, p_expected_revision integer,
  p_writing_response_id uuid default null, p_speaking_response_id uuid default null,
  p_task_response numeric default null, p_coherence_cohesion numeric default null,
  p_lexical_resource numeric default null, p_grammar numeric default null,
  p_fluency_coherence numeric default null, p_pronunciation numeric default null,
  p_reviewer_note text default null, p_actor_id uuid default auth.uid()
) returns setof public.ielts_teacher_reviews
language plpgsql security definer set search_path = public, private as $$
declare v record; existing record; kind text; v_revision integer; source_user_id uuid;
  source_task_number integer; source_part_number integer;
  task_response numeric; cc numeric; lex numeric; grammar numeric; fluency numeric; pronunciation numeric; task numeric; skill numeric;
begin
  if p_actor_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not private.can_manage_class(p_class_id, p_actor_id) then raise exception 'FORBIDDEN'; end if;
  if (p_writing_response_id is null) = (p_speaking_response_id is null) then raise exception 'EXACTLY_ONE_RESPONSE_REQUIRED'; end if;
  select * into v from public.ielts_attempts where id = p_attempt_id and class_id = p_class_id and club_id = p_club_id;
  if not found then raise exception 'IELTS_ATTEMPT_SCOPE_MISMATCH'; end if;
  if p_writing_response_id is not null then
    kind := 'writing';
    select wr.user_id, wr.task_number, wr.revision
      into source_user_id, source_task_number, v_revision
      from public.writing_responses wr
      where wr.id = p_writing_response_id and wr.attempt_id = p_attempt_id
      for update;
  else
    kind := 'speaking';
    select sr.user_id, sr.part_number, sr.revision
      into source_user_id, source_part_number, v_revision
      from public.speaking_responses sr
      where sr.id = p_speaking_response_id and sr.attempt_id = p_attempt_id
      for update;
  end if;
  if not found then raise exception 'IELTS_RESPONSE_SCOPE_MISMATCH'; end if;
  if p_expected_revision is null or v_revision <> p_expected_revision then raise exception 'IELTS_RESPONSE_REVISION_STALE'; end if;
  task_response := p_task_response; cc := p_coherence_cohesion; lex := p_lexical_resource; grammar := p_grammar; fluency := p_fluency_coherence; pronunciation := p_pronunciation;
  if kind = 'writing' and task_response is not null and cc is not null and lex is not null and grammar is not null then task := private.ielts_half_band((task_response + cc + lex + grammar) / 4); end if;
  if kind = 'speaking' and fluency is not null and lex is not null and grammar is not null and pronunciation is not null then skill := private.ielts_half_band((fluency + lex + grammar + pronunciation) / 4); end if;
  select * into existing from public.ielts_teacher_reviews where reviewer_id = p_actor_id and public.ielts_teacher_reviews.revision = v_revision and status = 'draft' and ((kind = 'writing' and writing_response_id = p_writing_response_id) or (kind = 'speaking' and speaking_response_id = p_speaking_response_id)) for update;
  if found then update public.ielts_teacher_reviews set task_response_band = task_response, coherence_cohesion_band = cc, lexical_resource_band = lex, grammar_band = grammar, fluency_coherence_band = fluency, pronunciation_band = pronunciation, task_band = task, skill_band = skill, reviewer_note = nullif(trim(p_reviewer_note), ''), updated_at = now() where id = existing.id returning * into v; insert into public.ielts_teacher_review_events(review_id, attempt_id, actor_id, event_type, from_status, to_status, revision, payload) values (v.id, v.attempt_id, p_actor_id, 'updated', 'draft', 'draft', v.revision, jsonb_build_object('reviewKind', v.review_kind));
  else insert into public.ielts_teacher_reviews(attempt_id, user_id, club_id, class_id, assignment_id, writing_response_id, speaking_response_id, review_kind, revision, task_number, part_number, reviewer_id, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, fluency_coherence_band, pronunciation_band, task_band, skill_band, reviewer_note) values (p_attempt_id, source_user_id, p_club_id, p_class_id, v.assignment_id, p_writing_response_id, p_speaking_response_id, kind, v_revision, source_task_number, source_part_number, p_actor_id, task_response, cc, lex, grammar, fluency, pronunciation, task, skill, nullif(trim(p_reviewer_note), '')) returning * into v; insert into public.ielts_teacher_review_events(review_id, attempt_id, actor_id, event_type, to_status, revision, payload) values (v.id, v.attempt_id, p_actor_id, 'created', 'draft', v.revision, jsonb_build_object('reviewKind', v.review_kind)); end if;
  return next v;
end;
$$;

create or replace function public.publish_ielts_teacher_review(p_review_id uuid, p_actor_id uuid default auth.uid())
returns setof public.ielts_teacher_reviews language plpgsql security definer set search_path = public, private as $$
declare v record;
begin
  if p_actor_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  select * into v from public.ielts_teacher_reviews where id = p_review_id for update;
  if not found or v.status <> 'draft' or v.reviewer_id <> p_actor_id then raise exception 'IELTS_DRAFT_NOT_PUBLISHABLE'; end if;
  if not private.can_manage_class(v.class_id, p_actor_id) then raise exception 'FORBIDDEN'; end if;
  if (v.review_kind = 'writing' and v.task_band is null) or (v.review_kind = 'speaking' and v.skill_band is null) then raise exception 'IELTS_REVIEW_INCOMPLETE'; end if;
  update public.ielts_teacher_reviews set status = 'published', published_at = now(), updated_at = now() where id = v.id returning * into v;
  insert into public.ielts_teacher_review_events(review_id, attempt_id, actor_id, event_type, from_status, to_status, revision, payload) values (v.id, v.attempt_id, p_actor_id, 'published', 'draft', 'published', v.revision, jsonb_build_object('reviewKind', v.review_kind));
  perform private.recompute_ielts_effective_attempt_scores(v.attempt_id);
  return next v;
end;
$$;

create or replace function public.return_ielts_teacher_review(p_review_id uuid, p_note text default null, p_actor_id uuid default auth.uid())
returns setof public.ielts_teacher_reviews language plpgsql security definer set search_path = public, private as $$
declare v record; source record; grant_revision integer;
begin
  if p_actor_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  select * into v from public.ielts_teacher_reviews where id = p_review_id for update;
  if not found or v.status <> 'published' then raise exception 'IELTS_REVIEW_NOT_RETURNABLE'; end if;
  if not private.can_manage_class(v.class_id, p_actor_id) then raise exception 'FORBIDDEN'; end if;
  if v.review_kind = 'writing' then select id, revision, revision_grant into source from public.writing_responses where id = v.writing_response_id for update; else select id, revision, revision_grant into source from public.speaking_responses where id = v.speaking_response_id for update; end if;
  if source.revision <> v.revision or source.revision_grant is not null then raise exception 'IELTS_REVISION_ALREADY_GRANTED_OR_STALE'; end if;
  grant_revision := source.revision + 1;
  perform set_config('app.ielts_revision_grant', 'on', true);
  if v.review_kind = 'writing' then update public.writing_responses set revision_grant = grant_revision where id = source.id; else update public.speaking_responses set revision_grant = grant_revision where id = source.id; end if;
  update public.ielts_teacher_reviews set status = 'returned', returned_note = nullif(trim(p_note), ''), returned_at = now(), revision_granted = grant_revision, updated_at = now() where id = v.id returning * into v;
  insert into public.ielts_teacher_review_events(review_id, attempt_id, actor_id, event_type, from_status, to_status, revision, payload) values (v.id, v.attempt_id, p_actor_id, 'returned', 'published', 'returned', v.revision, jsonb_build_object('reviewKind', v.review_kind, 'revisionGranted', grant_revision));
  perform private.recompute_ielts_effective_attempt_scores(v.attempt_id);
  return next v;
end;
$$;

alter table public.ielts_teacher_reviews enable row level security;
alter table public.ielts_teacher_review_events enable row level security;
alter table public.ielts_effective_attempt_scores enable row level security;

drop policy if exists "Users view own effective IELTS scores" on public.ielts_effective_attempt_scores;
create policy "Users view own effective IELTS scores" on public.ielts_effective_attempt_scores
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "IELTS managers view class effective scores" on public.ielts_effective_attempt_scores;
create policy "IELTS managers view class effective scores" on public.ielts_effective_attempt_scores
  for select to authenticated using (
    class_id is not null and private.can_manage_class(class_id, (select auth.uid()))
  );

drop policy if exists "IELTS managers view published teacher reviews" on public.ielts_teacher_reviews;
create policy "IELTS managers view published teacher reviews" on public.ielts_teacher_reviews
  for select to authenticated
  using (
    (status <> 'draft' and private.can_manage_class(class_id, (select auth.uid())))
    or reviewer_id = (select auth.uid())
  );

drop policy if exists "IELTS managers create teacher reviews" on public.ielts_teacher_reviews;
create policy "IELTS managers create teacher reviews" on public.ielts_teacher_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and private.can_manage_class(class_id, (select auth.uid()))
  );

drop policy if exists "IELTS reviewers update teacher reviews" on public.ielts_teacher_reviews;
create policy "IELTS reviewers update teacher reviews" on public.ielts_teacher_reviews
  for update to authenticated
  using (reviewer_id = (select auth.uid()) and private.can_manage_class(class_id, (select auth.uid())))
  with check (reviewer_id = (select auth.uid()) and private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "IELTS managers view teacher review events" on public.ielts_teacher_review_events;
create policy "IELTS managers view teacher review events" on public.ielts_teacher_review_events
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.ielts_teacher_reviews r
      where r.id = ielts_teacher_review_events.review_id
        and r.status <> 'draft'
        and private.can_manage_class(r.class_id, (select auth.uid()))
    )
  );

-- No UPDATE/DELETE policy is intentional: events are append-only.
revoke update, delete on public.ielts_teacher_review_events from authenticated;
grant select, insert, update on public.ielts_teacher_reviews to authenticated;
revoke insert, update, delete on public.ielts_teacher_reviews from authenticated;
grant select on public.ielts_teacher_review_events to authenticated;
revoke insert, update, delete on public.ielts_teacher_review_events from authenticated;
grant select on public.ielts_effective_attempt_scores to authenticated;
grant execute on function public.save_ielts_teacher_review(uuid, uuid, uuid, integer, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.publish_ielts_teacher_review(uuid, uuid) to authenticated;
grant execute on function public.return_ielts_teacher_review(uuid, text, uuid) to authenticated;

-- These functions are invoked only by triggers or the authorized public RPCs.
revoke all on function private.consume_ielts_writing_revision() from public;
revoke all on function private.consume_ielts_speaking_revision() from public;
revoke all on function private.validate_ielts_teacher_review_scope() from public;
revoke all on function private.recompute_ielts_effective_attempt_scores(uuid) from public;
revoke all on function private.audit_ielts_revision_submission() from public;

-- Teacher reads of criterion-level source rows are class/club scoped; learners
-- retain their existing owner-only policies.
drop policy if exists "Class managers view IELTS writing responses" on public.writing_responses;
create policy "Class managers view IELTS writing responses" on public.writing_responses
  for select to authenticated
  using (exists (
    select 1 from public.ielts_attempts a
    where a.id = writing_responses.attempt_id
      and a.class_id is not null
      and private.can_manage_class(a.class_id, (select auth.uid()))
  ));

drop policy if exists "Class managers view IELTS speaking responses" on public.speaking_responses;
create policy "Class managers view IELTS speaking responses" on public.speaking_responses
  for select to authenticated
  using (exists (
    select 1 from public.ielts_attempts a
    where a.id = speaking_responses.attempt_id
      and a.class_id is not null
      and private.can_manage_class(a.class_id, (select auth.uid()))
  ));

commit;
