-- Reliable homework submissions: reservation/finalization, idempotency,
-- revision limits, storage intent verification, and immutable grade events.

begin;

alter table public.club_assignment_submissions
  add column if not exists submission_state text not null default 'submitted',
  add column if not exists idempotency_key uuid,
  add column if not exists revision_of uuid,
  add column if not exists revision_number integer not null default 0,
  add column if not exists failure_reason text;

alter table public.club_assignment_submissions
  drop constraint if exists club_assignment_submissions_submission_state_check,
  add constraint club_assignment_submissions_submission_state_check
    check (submission_state in ('draft', 'uploading', 'submitted', 'failed')),
  drop constraint if exists club_assignment_submissions_revision_number_check,
  add constraint club_assignment_submissions_revision_number_check
    check (revision_number in (0, 1));

create unique index if not exists club_assignment_submissions_idempotency_uidx
  on public.club_assignment_submissions(assignment_id, user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists club_assignment_submissions_revision_idx
  on public.club_assignment_submissions(revision_of)
  where revision_of is not null;

create unique index if not exists club_assignment_submissions_one_revision_uidx
  on public.club_assignment_submissions(revision_of)
  where revision_of is not null;

alter table public.club_assignment_submissions
  drop constraint if exists club_assignment_submissions_assignment_scope_fk,
  drop constraint if exists club_assignment_submissions_revision_fk;

alter table public.club_assignments
  drop constraint if exists club_assignments_id_club_class_key;

alter table public.club_assignment_submissions
  add constraint club_assignment_submissions_revision_fk
  foreign key (revision_of) references public.club_assignment_submissions(id)
  on delete restrict;

-- The class component is nullable for whole-club assignments, so retain the
-- trigger check below while adding a composite FK for all class-bound writes.
alter table public.club_assignments
  add constraint club_assignments_id_club_class_key unique (id, club_id, class_id);

-- Repair legacy denormalized scope before making the new invariant valid.
-- This preserves every submission and grade while binding it to its canonical
-- assignment tenant/class.
update public.club_assignment_submissions s
set club_id = a.club_id, class_id = a.class_id, updated_at = now()
from public.club_assignments a
where a.id = s.assignment_id
  and (s.club_id is distinct from a.club_id or s.class_id is distinct from a.class_id);

alter table public.club_assignment_submissions
  add constraint club_assignment_submissions_assignment_scope_fk
  foreign key (assignment_id, club_id, class_id)
  references public.club_assignments(id, club_id, class_id)
  on delete cascade
  not valid;

alter table public.club_assignment_submissions
  validate constraint club_assignment_submissions_assignment_scope_fk;

alter table public.assignment_submission_files
  add column if not exists state text not null default 'verified',
  add column if not exists verified_at timestamptz;

alter table public.assignment_submission_files
  drop constraint if exists assignment_submission_files_state_check,
  add constraint assignment_submission_files_state_check
    check (state in ('pending', 'verified', 'failed'));

create index if not exists assignment_submission_files_submission_state_idx
  on public.assignment_submission_files(submission_id, state);

create table if not exists public.club_assignment_grade_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.club_assignment_submissions(id) on delete cascade,
  revision_number integer not null check (revision_number in (0, 1)),
  grade_status text not null check (grade_status in ('graded', 'returned', 'resubmit_requested')),
  score numeric(5,2),
  score_max numeric(5,2),
  rubric_breakdown jsonb not null default '{}'::jsonb,
  feedback text,
  graded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists club_assignment_grade_events_submission_idx
  on public.club_assignment_grade_events(submission_id, created_at desc);

alter table public.club_assignment_grade_events enable row level security;
revoke all on public.club_assignment_grade_events from anon, authenticated;
grant select on public.club_assignment_grade_events to authenticated;

-- Resolve access from the assignment namespace, not only its club. A coach
-- may read a class-bound submission only when assigned to that class.
create or replace function private.can_submit_homework_assignment(
  p_assignment_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1
    from public.club_assignments a
    where a.id = p_assignment_id
      and (
        a.class_id is null
        or exists (
          select 1
          from public.classes c
          where c.id = a.class_id
            and c.club_id = a.club_id
        )
      )
      and (
        (
          a.class_id is null
          and exists (
            select 1
            from public.club_memberships cm
            where cm.club_id = a.club_id
              and cm.user_id = p_user_id
              and cm.role = 'student'
              and cm.status = 'active'
          )
        )
        or (
          a.class_id is not null
          and exists (
            select 1
            from public.class_memberships cm
            where cm.class_id = a.class_id
              and cm.user_id = p_user_id
              and cm.member_role = 'student'
              and cm.status = 'active'
          )
        )
      )
  );
$$;

create or replace function private.can_access_homework_storage_path(
  p_path text,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  path_club uuid;
  path_assignment uuid;
  path_user uuid;
  assignment_class uuid;
  assignment_club uuid;
begin
  if p_user_id is null
     or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  then return false;
  end if;
  path_club := split_part(p_path, '/', 1)::uuid;
  path_assignment := split_part(p_path, '/', 2)::uuid;
  path_user := split_part(p_path, '/', 3)::uuid;
  select class_id, club_id into assignment_class, assignment_club
  from public.club_assignments where id = path_assignment;
  if not found or assignment_club <> path_club then return false; end if;
  if assignment_class is not null and not exists (
    select 1 from public.classes c
    where c.id = assignment_class and c.club_id = assignment_club
  ) then return false; end if;
  if not exists (
    select 1
    from public.assignment_submission_files f
    join public.club_assignment_submissions s on s.id = f.submission_id
    where f.storage_path = p_path
      and f.club_id = path_club
      and f.user_id = path_user
      and s.assignment_id = path_assignment
      and f.state = 'verified'
  ) then return false; end if;
  if path_user = p_user_id then
    return private.can_submit_homework_assignment(path_assignment, p_user_id)
      or (
        assignment_class is not null
        and private.can_manage_class(assignment_class, p_user_id)
      )
      or (
        assignment_class is null
        and private.can_manage_new_class(assignment_club, p_user_id)
      );
  end if;
  if assignment_class is not null then
    return private.can_manage_class(assignment_class, p_user_id);
  end if;
  return private.can_manage_new_class(assignment_club, p_user_id);
end;
$$;

-- Uploads are authorized only for the exact pending intent created by the
-- reservation RPC. Pending/failed objects are never readable through storage.
create or replace function private.can_upload_homework_storage_path(
  p_path text,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  path_club uuid;
  path_assignment uuid;
  path_user uuid;
  assignment_club uuid;
begin
  if p_user_id is null
     or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  then return false;
  end if;
  path_club := split_part(p_path, '/', 1)::uuid;
  path_assignment := split_part(p_path, '/', 2)::uuid;
  path_user := split_part(p_path, '/', 3)::uuid;
  if path_user <> p_user_id then return false; end if;
  select club_id into assignment_club
  from public.club_assignments where id = path_assignment;
  if not found or assignment_club <> path_club then return false; end if;
  if not private.can_submit_homework_assignment(path_assignment, p_user_id) then return false; end if;
  return exists (
    select 1
    from public.assignment_submission_files f
    join public.club_assignment_submissions s on s.id = f.submission_id
    where f.storage_path = p_path
      and f.club_id = path_club
      and f.user_id = path_user
      and s.assignment_id = path_assignment
      and s.user_id = p_user_id
      and f.state = 'pending'
  );
end;
$$;

-- Owners may remove only their pending/failed intents; scoped managers retain
-- cleanup authority for their class or classless club assignment.
create or replace function private.can_delete_homework_storage_path(
  p_path text,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  path_club uuid;
  path_assignment uuid;
  path_user uuid;
  assignment_class uuid;
  assignment_club uuid;
  file_state text;
begin
  if p_user_id is null
     or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  then return false;
  end if;
  path_club := split_part(p_path, '/', 1)::uuid;
  path_assignment := split_part(p_path, '/', 2)::uuid;
  path_user := split_part(p_path, '/', 3)::uuid;
  select class_id, club_id into assignment_class, assignment_club
  from public.club_assignments where id = path_assignment;
  if not found or assignment_club <> path_club then return false; end if;
  select f.state into file_state
  from public.assignment_submission_files f
  join public.club_assignment_submissions s on s.id = f.submission_id
  where f.storage_path = p_path
    and f.club_id = path_club
    and f.user_id = path_user
    and s.assignment_id = path_assignment;
  if not found then return false; end if;
  if path_user = p_user_id
     and file_state in ('pending', 'failed')
     and private.can_submit_homework_assignment(path_assignment, p_user_id) then
    return true;
  end if;
  if assignment_class is not null then
    return private.can_manage_class(assignment_class, p_user_id);
  end if;
  return private.can_manage_new_class(assignment_club, p_user_id);
end;
$$;

-- File intents are created only by the reservation RPC; learners can never
-- manufacture a pending row for an arbitrary storage object.
revoke insert, update, delete on public.assignment_submission_files from authenticated;

drop policy if exists "Students can create own assignment submission files"
  on public.assignment_submission_files;
create policy "Students can create own assignment submission files"
  on public.assignment_submission_files for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_submit_homework_assignment(submission_id, (select auth.uid()))
  );

drop policy if exists "Students and managers can view assignment submission files"
  on public.assignment_submission_files;
drop policy if exists "Students and scoped managers view assignment files"
  on public.assignment_submission_files;
create policy "Students and scoped managers view assignment files"
  on public.assignment_submission_files for select
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and private.can_submit_homework_assignment(
        (select s.assignment_id from public.club_assignment_submissions s where s.id = assignment_submission_files.submission_id),
        (select auth.uid())
      )
    )
    or (
      exists (
        select 1 from public.club_assignment_submissions s
        where s.id = assignment_submission_files.submission_id
          and s.class_id is not null
          and assignment_submission_files.state = 'verified'
          and private.can_manage_class(s.class_id, (select auth.uid()))
      )
    )
    or (
      exists (
        select 1 from public.club_assignment_submissions s
        where s.id = assignment_submission_files.submission_id
          and s.class_id is null
          and assignment_submission_files.state = 'verified'
          and private.can_manage_new_class(s.club_id, (select auth.uid()))
      )
    )
  );

drop policy if exists "Students and managers can delete assignment submission files"
  on public.assignment_submission_files;
drop policy if exists "Students and scoped managers delete assignment files"
  on public.assignment_submission_files;
create policy "Students and scoped managers delete assignment files"
  on public.assignment_submission_files for delete
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and state in ('pending', 'failed')
      and private.can_submit_homework_assignment(
        (select s.assignment_id from public.club_assignment_submissions s where s.id = assignment_submission_files.submission_id),
        (select auth.uid())
      )
    )
    or exists (
      select 1 from public.club_assignment_submissions s
      where s.id = assignment_submission_files.submission_id
        and s.class_id is not null
        and private.can_manage_class(s.class_id, (select auth.uid()))
    )
    or exists (
      select 1 from public.club_assignment_submissions s
      where s.id = assignment_submission_files.submission_id
        and s.class_id is null
        and private.can_manage_new_class(s.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Managers view homework grade events" on public.club_assignment_grade_events;
create policy "Managers view homework grade events"
  on public.club_assignment_grade_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_assignment_submissions s
      where s.id = club_assignment_grade_events.submission_id
        and (
          (s.class_id is not null and private.can_manage_class(s.class_id, (select auth.uid())))
          or (s.class_id is null and private.can_manage_new_class(s.club_id, (select auth.uid())))
        )
    )
  );

-- Replace inherited club-wide manager access for class-bound submissions.
drop policy if exists "Students and managers can view submissions" on public.club_assignment_submissions;
drop policy if exists "Students and class managers can view submissions" on public.club_assignment_submissions;
create policy "Students and class managers can view submissions"
  on public.club_assignment_submissions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (class_id is not null and private.can_manage_class(class_id, (select auth.uid())))
    or (class_id is null and private.can_manage_new_class(club_id, (select auth.uid())))
  );

drop policy if exists "Students can create own assignment submissions" on public.club_assignment_submissions;
create policy "Students can create own assignment submissions"
  on public.club_assignment_submissions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_view_club(club_id, (select auth.uid()))
  );

drop policy if exists "Club managers can update submissions" on public.club_assignment_submissions;
revoke update on public.club_assignment_submissions from authenticated;

create or replace function private.prevent_homework_grade_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  raise exception 'Homework grade history is immutable';
end;
$$;

drop trigger if exists club_assignment_grade_events_immutable
  on public.club_assignment_grade_events;
create trigger club_assignment_grade_events_immutable
before update or delete on public.club_assignment_grade_events
for each row execute function private.prevent_homework_grade_event_mutation();

-- Enforce assignment/class/club/user consistency on every homework row. The
-- composite FK below covers normal writes; this trigger also rejects NULL class
-- loopholes when the assignment is class-bound and verifies student enrollment.
create or replace function private.enforce_homework_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  assignment_club uuid;
  assignment_class uuid;
begin
  if tg_op = 'INSERT' and new.source_type <> 'homework' then return new; end if;
  if tg_op = 'UPDATE' and old.source_type <> 'homework' and new.source_type <> 'homework' then return new; end if;
  if tg_op = 'INSERT' and coalesce(current_setting('app.homework_reservation', true), 'off') <> 'on' then
    raise exception 'Homework submissions must be reserved transactionally';
  end if;
  if tg_op = 'UPDATE' then
    if new.submission_state is distinct from old.submission_state
       and coalesce(current_setting('app.homework_state_transition', true), 'off') <> 'on' then
      raise exception 'Homework submission state is server controlled';
    end if;
    if (
      new.status is distinct from old.status
      or new.grade_status is distinct from old.grade_status
      or new.score is distinct from old.score
      or new.score_max is distinct from old.score_max
      or new.rubric_breakdown is distinct from old.rubric_breakdown
      or new.feedback is distinct from old.feedback
      or new.graded_by is distinct from old.graded_by
      or new.graded_at is distinct from old.graded_at
    ) and coalesce(current_setting('app.homework_grade_transition', true), 'off') <> 'on' then
      raise exception 'Homework score and grade fields are server controlled';
    end if;
  end if;

  select club_id, class_id
    into assignment_club, assignment_class
  from public.club_assignments
  where id = new.assignment_id;
  if assignment_club is null then raise exception 'Assignment not found'; end if;
  if new.club_id <> assignment_club or new.class_id is distinct from assignment_class then
    raise exception 'Homework submission organization does not match assignment';
  end if;
  if assignment_class is not null and not exists (
    select 1
    from public.class_memberships cm
    where cm.class_id = assignment_class
      and cm.user_id = new.user_id
      and cm.member_role = 'student'
      and cm.status = 'active'
  ) then
    raise exception 'Homework submission requires active class enrollment';
  end if;
  if new.revision_of is null and new.revision_number <> 0 then
    raise exception 'Initial homework submission must have revision zero';
  end if;
  if new.revision_of is not null and new.revision_number <> 1 then
    raise exception 'Homework revision must be revision one';
  end if;
  return new;
end;
$$;

drop trigger if exists club_assignment_submissions_enforce_integrity
  on public.club_assignment_submissions;
create trigger club_assignment_submissions_enforce_integrity
before insert or update
on public.club_assignment_submissions
for each row execute function private.enforce_homework_submission_integrity();

-- Keep pending file intents tied to the exact assignment/user namespace. The
-- storage object itself is checked by the server finalizer immediately before
-- this row becomes verified/submitted.
create or replace function private.enforce_homework_file_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  submission_assignment uuid;
  expected_prefix text;
begin
  select assignment_id into submission_assignment
  from public.club_assignment_submissions
  where id = new.submission_id
    and club_id = new.club_id
    and user_id = new.user_id;
  if submission_assignment is null then raise exception 'Submission owner or organization mismatch'; end if;
  expected_prefix := new.club_id::text || '/' || submission_assignment::text || '/' || new.user_id::text || '/';
  if left(new.storage_path, length(expected_prefix)) <> expected_prefix then
    raise exception 'Submission file path is outside its assignment namespace';
  end if;
  return new;
end;
$$;

drop trigger if exists assignment_submission_files_enforce_integrity
  on public.assignment_submission_files;
create trigger assignment_submission_files_enforce_integrity
before insert or update of submission_id, club_id, user_id, storage_path
on public.assignment_submission_files
for each row execute function private.enforce_homework_file_integrity();

-- Replace inherited storage policies that granted every club coach access to
-- every class-bound upload in the club.
drop policy if exists "Students can upload own assignment submission files" on storage.objects;
drop policy if exists "Students and scoped managers read files" on storage.objects;
drop policy if exists "Students and scoped managers delete files" on storage.objects;
create policy "Students can upload own assignment submission files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assignment-submissions'
    and split_part(name, '/', 3) = (select auth.uid())::text
    and private.can_upload_homework_storage_path(name, (select auth.uid()))
  );

drop policy if exists "Students and managers can read assignment submission files" on storage.objects;
create policy "Students and scoped managers read files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and private.can_access_homework_storage_path(name, (select auth.uid()))
  );

drop policy if exists "Students and managers can delete assignment submission files" on storage.objects;
create policy "Students and scoped managers delete files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and private.can_delete_homework_storage_path(name, (select auth.uid()))
  );

-- Atomically reserve an attempt. Draft/uploading rows do not count toward the
-- assignment limit; only a finalized submitted row does. The assignment lock
-- serializes concurrent reservations for the same assignment.
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
  if assignment_row.due_at is not null and assignment_row.due_at < now() then raise exception 'ASSIGNMENT_PAST_DUE'; end if;
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

create or replace function public.mark_homework_submission_uploading(
  p_submission_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  submission public.club_assignment_submissions%rowtype;
begin
  if uid is null or p_user_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  select * into submission from public.club_assignment_submissions where id = p_submission_id for update;
  if not found or submission.user_id <> uid then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if not private.can_submit_homework_assignment(submission.assignment_id, uid) then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;
  if submission.submission_state = 'submitted' or submission.submission_state = 'uploading' then return submission.id; end if;
  if submission.submission_state = 'failed' then raise exception 'SUBMISSION_FAILED'; end if;
  perform set_config('app.homework_state_transition', 'on', true);
  update public.club_assignment_submissions
  set submission_state = 'uploading', updated_at = now()
  where id = submission.id;
  return submission.id;
end;
$$;

-- Finalization is idempotent and atomic after the server has verified every
-- storage object. The path set must exactly equal the reserved intent rows.
create or replace function public.finalize_homework_submission(
  p_submission_id uuid,
  p_user_id uuid,
  p_storage_paths jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  submission public.club_assignment_submissions%rowtype;
  pending_count integer;
  requested_count integer := coalesce(jsonb_array_length(coalesce(p_storage_paths, '[]'::jsonb)), 0);
  file_row record;
  object_metadata jsonb;
  actual_size bigint;
  actual_mime text;
  object_owner uuid;
  object_owner_id text;
begin
  if uid is null or p_user_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  select * into submission from public.club_assignment_submissions where id = p_submission_id for update;
  if not found or submission.user_id <> uid then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if not private.can_submit_homework_assignment(submission.assignment_id, uid) then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;
  if submission.submission_state = 'submitted' then return submission.id; end if;
  if submission.submission_state = 'failed' then raise exception 'SUBMISSION_FAILED'; end if;

  select count(*)::integer into pending_count
  from public.assignment_submission_files f
  where f.submission_id = submission.id and f.state = 'pending';
  if pending_count <> requested_count then raise exception 'FILE_SET_MISMATCH'; end if;
  if pending_count > 0 and exists (
    select 1 from public.assignment_submission_files f
    where f.submission_id = submission.id
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(p_storage_paths, '[]'::jsonb)) p(path)
        where p.path = f.storage_path
      )
  ) then raise exception 'FILE_SET_MISMATCH'; end if;

  -- Do not trust the server action as the only enforcement boundary: an
  -- authenticated caller can invoke this RPC directly. Verify the storage
  -- object in the same transaction immediately before finalization.
  for file_row in
    select storage_path, mime_type, size_bytes
    from public.assignment_submission_files
    where submission_id = submission.id and state = 'pending'
  loop
    select metadata, owner, owner_id into object_metadata, object_owner, object_owner_id
    from storage.objects
    where bucket_id = 'assignment-submissions'
      and name = file_row.storage_path;
    if object_metadata is null then raise exception 'STORAGE_OBJECT_NOT_FOUND'; end if;
    if object_owner is distinct from uid and object_owner_id is distinct from uid::text then
      raise exception 'STORAGE_OBJECT_OWNER_MISMATCH';
    end if;
    actual_size := nullif(object_metadata->>'size', '')::bigint;
    actual_mime := nullif(trim(coalesce(object_metadata->>'mimetype', object_metadata->>'contentType', '')), '');
    if actual_size is null or actual_size <> file_row.size_bytes then
      raise exception 'STORAGE_OBJECT_SIZE_MISMATCH';
    end if;
    if actual_mime is distinct from file_row.mime_type then
      raise exception 'STORAGE_OBJECT_MIME_MISMATCH';
    end if;
  end loop;

  perform set_config('app.homework_state_transition', 'on', true);
  update public.assignment_submission_files
  set state = 'verified', verified_at = now()
  where submission_id = submission.id and state = 'pending';
  update public.club_assignment_submissions
  set submission_state = 'submitted', submitted_at = now(), updated_at = now(), failure_reason = null
  where id = submission.id;
  return submission.id;
end;
$$;

create or replace function public.fail_homework_submission(
  p_submission_id uuid,
  p_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  submission public.club_assignment_submissions%rowtype;
begin
  if uid is null or p_user_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  select * into submission from public.club_assignment_submissions where id = p_submission_id for update;
  if not found or submission.user_id <> uid then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if not private.can_submit_homework_assignment(submission.assignment_id, uid) then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;
  if submission.submission_state = 'submitted' then return submission.id; end if;
  perform set_config('app.homework_state_transition', 'on', true);
  update public.assignment_submission_files
  set state = 'failed'
  where submission_id = submission.id and state = 'pending';
  update public.club_assignment_submissions
  set submission_state = 'failed', failure_reason = left(nullif(btrim(p_reason), ''), 500), updated_at = now()
  where id = submission.id;
  return submission.id;
end;
$$;

create or replace function public.grade_homework_submission(
  p_submission_id uuid,
  p_club_id uuid,
  p_grade_status text,
  p_score numeric,
  p_score_max numeric,
  p_rubric_breakdown jsonb,
  p_feedback text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  submission public.club_assignment_submissions%rowtype;
  event_id uuid;
begin
  if uid is null then raise exception 'FORBIDDEN'; end if;
  if p_grade_status not in ('graded', 'returned', 'resubmit_requested') then raise exception 'INVALID_GRADE_STATUS'; end if;
  if p_score is not null and p_score < 0 then raise exception 'INVALID_SCORE'; end if;
  if p_score_max is not null and p_score_max <= 0 then raise exception 'INVALID_SCORE_MAX'; end if;
  if p_score is not null and p_score_max is not null and p_score > p_score_max then raise exception 'INVALID_SCORE'; end if;

  select * into submission
  from public.club_assignment_submissions
  where id = p_submission_id and club_id = p_club_id
  for update;
  if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if submission.class_id is not null then
    if not private.can_manage_class(submission.class_id, uid) then raise exception 'FORBIDDEN'; end if;
  elsif not private.can_manage_new_class(p_club_id, uid) then
    raise exception 'FORBIDDEN';
  end if;
  if submission.submission_state <> 'submitted' then raise exception 'SUBMISSION_NOT_FINALIZED'; end if;

  perform set_config('app.homework_grade_transition', 'on', true);
  insert into public.club_assignment_grade_events (
    submission_id, revision_number, grade_status, score, score_max,
    rubric_breakdown, feedback, graded_by
  ) values (
    submission.id, submission.revision_number, p_grade_status, p_score, p_score_max,
    coalesce(p_rubric_breakdown, '{}'::jsonb), nullif(btrim(p_feedback), ''), uid
  ) returning id into event_id;

  update public.club_assignment_submissions
  set grade_status = p_grade_status,
      score = p_score,
      score_max = p_score_max,
      rubric_breakdown = coalesce(p_rubric_breakdown, '{}'::jsonb),
      feedback = nullif(btrim(p_feedback), ''),
      graded_by = uid,
      graded_at = now(),
      updated_at = now()
  where id = submission.id;
  return event_id;
end;
$$;

-- A tightly scoped manager-only name resolver. It returns no email or profile
-- metadata and only names users who submitted to the requested assignment.
create or replace function public.get_homework_submission_roster(p_assignment_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  assignment_club uuid;
  assignment_class uuid;
  uid uuid := auth.uid();
begin
  select club_id, class_id into assignment_club, assignment_class
  from public.club_assignments where id = p_assignment_id;
  if assignment_club is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if not (
    (assignment_class is not null and private.can_manage_class(assignment_class, uid))
    or (assignment_class is null and private.can_manage_new_class(assignment_club, uid))
  ) then raise exception 'FORBIDDEN'; end if;

  return query
  select distinct s.user_id, coalesce(nullif(trim(p.display_name), ''), 'Student')
  from public.club_assignment_submissions s
  join public.profiles p on p.id = s.user_id
  where s.assignment_id = p_assignment_id
    and s.club_id = assignment_club;
end;
$$;

-- Service-role cleanup claim for abandoned browser sessions. The RPC marks
-- stale intents and returns their paths; the protected worker removes objects
-- through the Storage API so both metadata and underlying blobs are deleted.
-- Failed/draft rows never count toward required attempts, so cleanup does not
-- consume learner attempts. Learners retry by reserving with a new key.
create or replace function public.cleanup_stale_homework_submissions(
  p_before timestamptz,
  p_limit integer default 100
)
returns table (submission_id uuid, previous_state text, removed_paths jsonb)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  submission_row record;
  paths jsonb;
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 1000));
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_before is null then raise exception 'CUTOFF_REQUIRED'; end if;

  for submission_row in
    select id, submission_state
    from public.club_assignment_submissions
    where submission_state in ('draft', 'uploading', 'failed')
      and updated_at < p_before
    order by updated_at asc
    limit limit_value
    for update skip locked
  loop
    select coalesce(jsonb_agg(f.storage_path order by f.created_at), '[]'::jsonb)
      into paths
    from public.assignment_submission_files f
    where f.submission_id = submission_row.id
      and f.state in ('pending', 'failed');

    update public.assignment_submission_files f
    set state = 'failed', verified_at = null
    where f.submission_id = submission_row.id
      and f.state in ('pending', 'failed');

    perform set_config('app.homework_state_transition', 'on', true);
    update public.club_assignment_submissions
    set submission_state = 'failed',
        failure_reason = 'stale submission cleanup',
        updated_at = now()
    where id = submission_row.id;

    submission_id := submission_row.id;
    previous_state := submission_row.submission_state;
    removed_paths := paths;
    return next;
  end loop;
end;
$$;

revoke all on function public.reserve_homework_submission(uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.mark_homework_submission_uploading(uuid, uuid) from public;
revoke all on function public.finalize_homework_submission(uuid, uuid, jsonb) from public;
revoke all on function public.fail_homework_submission(uuid, uuid, text) from public;
revoke all on function public.grade_homework_submission(uuid, uuid, text, numeric, numeric, jsonb, text) from public;
revoke all on function public.get_homework_submission_roster(uuid) from public;
revoke all on function public.cleanup_stale_homework_submissions(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.reserve_homework_submission(uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.mark_homework_submission_uploading(uuid, uuid) to authenticated;
grant execute on function public.finalize_homework_submission(uuid, uuid, jsonb) to authenticated;
grant execute on function public.fail_homework_submission(uuid, uuid, text) to authenticated;
grant execute on function public.grade_homework_submission(uuid, uuid, text, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.get_homework_submission_roster(uuid) to authenticated;
grant execute on function public.cleanup_stale_homework_submissions(timestamptz, integer) to service_role;

revoke all on function private.prevent_homework_grade_event_mutation() from public;
revoke all on function private.enforce_homework_submission_integrity() from public;
revoke all on function private.enforce_homework_file_integrity() from public;
revoke all on function private.can_submit_homework_assignment(uuid, uuid) from public;
revoke all on function private.can_access_homework_storage_path(text, uuid) from public;
revoke all on function private.can_upload_homework_storage_path(text, uuid) from public;
revoke all on function private.can_delete_homework_storage_path(text, uuid) from public;
grant execute on function private.can_submit_homework_assignment(uuid, uuid) to authenticated;
grant execute on function private.can_access_homework_storage_path(text, uuid) to authenticated;
grant execute on function private.can_upload_homework_storage_path(text, uuid) to authenticated;
grant execute on function private.can_delete_homework_storage_path(text, uuid) to authenticated;

commit;
