-- IELTS LMS pilot: communications, reusable content, and durable delivery.
-- Additive only. The pilot is opt-in per organisation/cohort and can be rolled
-- back by disabling the flag; no learner content or audit rows are deleted.

begin;

create table if not exists public.lms_pilot_flags (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  feature_key text not null default 'ielts_lms_pilot_v1',
  enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  disabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, class_id, feature_key)
);

create table if not exists public.lms_announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null check (length(btrim(body)) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  publish_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_outbox_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  event_type text not null check (event_type in ('assignment_published', 'due_soon', 'returned', 'resubmission', 'result_published', 'announcement')),
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  recipient_ids jsonb not null default '[]'::jsonb,
  email_recipient_ids jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  outbox_event_id uuid references public.lms_outbox_events(id) on delete set null,
  event_type text not null check (event_type in ('assignment_published', 'due_soon', 'returned', 'resubmission', 'result_published', 'announcement')),
  dedupe_key text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);

create table if not exists public.lms_resources (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  kind text not null check (kind in ('link', 'file')),
  url text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  provenance text,
  license_status text not null default 'pending' check (license_status in ('pending', 'approved', 'restricted', 'rejected')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null and storage_path is null) or (kind = 'file' and storage_path is not null and url is null)),
  check (status <> 'published' or (length(btrim(coalesce(provenance, ''))) > 0 and license_status = 'approved'))
);

alter table public.lms_resources add column if not exists scope_class_id uuid references public.classes(id) on delete cascade;

create table if not exists public.lms_resource_assignments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.lms_resources(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  check ((class_id is null) <> (course_id is null)),
  unique (resource_id, class_id, course_id)
);

create table if not exists public.lms_vocabulary_sets (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  provenance text,
  license_status text not null default 'pending' check (license_status in ('pending', 'approved', 'restricted', 'rejected')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (length(btrim(coalesce(provenance, ''))) > 0 and license_status = 'approved'))
);

alter table public.lms_vocabulary_sets add column if not exists scope_class_id uuid references public.classes(id) on delete cascade;

create table if not exists public.lms_vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.lms_vocabulary_sets(id) on delete cascade,
  term text not null check (length(btrim(term)) between 1 and 200),
  definition text not null check (length(btrim(definition)) between 1 and 2000),
  example text,
  translation text,
  order_index integer not null default 0 check (order_index >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, term)
);

create table if not exists public.lms_vocabulary_assignments (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.lms_vocabulary_sets(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  check ((class_id is null) <> (course_id is null)),
  unique (set_id, class_id, course_id)
);

create index if not exists lms_announcements_class_idx on public.lms_announcements(class_id, status, publish_at desc);
create index if not exists lms_outbox_pending_idx on public.lms_outbox_events(status, available_at, created_at);
create index if not exists lms_outbox_class_idx on public.lms_outbox_events(class_id, created_at desc);
create index if not exists lms_notifications_recipient_idx on public.lms_notifications(recipient_id, created_at desc);
create index if not exists lms_resources_club_status_idx on public.lms_resources(club_id, status, updated_at desc);
create unique index if not exists lms_pilot_flags_org_feature_uidx on public.lms_pilot_flags(club_id, feature_key) where class_id is null;
create unique index if not exists lms_pilot_flags_class_feature_uidx on public.lms_pilot_flags(club_id, class_id, feature_key) where class_id is not null;
create index if not exists lms_resources_scope_class_idx on public.lms_resources(scope_class_id) where scope_class_id is not null;
create unique index if not exists lms_resource_assignments_class_uidx on public.lms_resource_assignments(resource_id, class_id) where class_id is not null;
create unique index if not exists lms_resource_assignments_course_uidx on public.lms_resource_assignments(resource_id, course_id) where course_id is not null;
create index if not exists lms_resource_assignments_class_idx on public.lms_resource_assignments(class_id, resource_id);
create index if not exists lms_resource_assignments_course_idx on public.lms_resource_assignments(course_id, resource_id);
create index if not exists lms_vocabulary_sets_club_status_idx on public.lms_vocabulary_sets(club_id, status, updated_at desc);
create index if not exists lms_vocabulary_sets_scope_class_idx on public.lms_vocabulary_sets(scope_class_id) where scope_class_id is not null;
create unique index if not exists lms_vocabulary_assignments_class_uidx on public.lms_vocabulary_assignments(set_id, class_id) where class_id is not null;
create unique index if not exists lms_vocabulary_assignments_course_uidx on public.lms_vocabulary_assignments(set_id, course_id) where course_id is not null;
create index if not exists lms_vocabulary_assignments_class_idx on public.lms_vocabulary_assignments(class_id, set_id);
create index if not exists lms_vocabulary_assignments_course_idx on public.lms_vocabulary_assignments(course_id, set_id);

create or replace function private.lms_pilot_enabled(p_club_id uuid, p_class_id uuid default null)
returns boolean language sql stable security definer set search_path = public, private as $$
  select coalesce(
    (select f.enabled from public.lms_pilot_flags f where f.club_id = p_club_id and f.feature_key = 'ielts_lms_pilot_v1' and f.class_id = p_class_id limit 1),
    (select f.enabled from public.lms_pilot_flags f where f.club_id = p_club_id and f.feature_key = 'ielts_lms_pilot_v1' and f.class_id is null limit 1),
    false
  );
$$;

create or replace function private.can_view_lms_class(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and (private.is_admin(p_user_id) or exists (
    select 1 from public.class_memberships cm
    where cm.class_id = p_class_id and cm.user_id = p_user_id and cm.status = 'active'
  ));
$$;

create or replace function private.can_manage_lms_pilot(p_club_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and (private.is_admin(p_user_id) or exists (
    select 1 from public.club_memberships cm
    where cm.club_id = p_club_id and cm.user_id = p_user_id and cm.status = 'active' and cm.role = 'owner'
  ));
$$;

create or replace function private.lms_outbox_recipients(p_class_id uuid)
returns table(recipient_ids jsonb, email_recipient_ids jsonb)
language sql stable security definer set search_path = public, private as $$
  select
    coalesce(jsonb_agg(cm.user_id order by cm.user_id) filter (where cm.user_id is not null), '[]'::jsonb),
    coalesce(jsonb_agg(cm.user_id order by cm.user_id) filter (where cm.user_id is not null and coalesce((p.preferences ->> 'email_notifications')::boolean, true)), '[]'::jsonb)
  from public.class_memberships cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = p_class_id and cm.member_role = 'student' and cm.status = 'active';
$$;

create or replace function private.lms_manager_recipients(p_class_id uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(distinct ids.user_id order by ids.user_id), '[]'::jsonb)
  from (
    select cm.user_id from public.class_memberships cm where cm.class_id = p_class_id and cm.member_role = 'teacher' and cm.status = 'active'
    union
    select club_memberships.user_id from public.club_memberships join public.classes c on c.club_id = club_memberships.club_id where c.id = p_class_id and club_memberships.role = 'owner' and club_memberships.status = 'active'
  ) ids;
$$;

drop function if exists private.enqueue_lms_outbox(uuid, uuid, text, text, jsonb, text, text, uuid);
create or replace function private.enqueue_lms_outbox(
  p_club_id uuid, p_class_id uuid, p_event_type text, p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb, p_title text default '', p_body text default '', p_recipient_id uuid default null, p_recipient_ids jsonb default null
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare v_id uuid; v_recipient_ids jsonb; v_email_recipient_ids jsonb; v_email_enabled boolean;
begin
  if p_club_id is null or not private.lms_pilot_enabled(p_club_id, p_class_id) then return null; end if;
  if p_recipient_ids is not null then
    v_recipient_ids := p_recipient_ids;
    select coalesce(jsonb_agg(p.id order by p.id), '[]'::jsonb) into v_email_recipient_ids
    from public.profiles p where p.id in (select value::uuid from jsonb_array_elements_text(p_recipient_ids)) and coalesce((p.preferences ->> 'email_notifications')::boolean, true);
  elsif p_recipient_id is not null then
    select coalesce((p.preferences ->> 'email_notifications')::boolean, true) into v_email_enabled
    from public.profiles p where p.id = p_recipient_id;
    v_recipient_ids := jsonb_build_array(p_recipient_id);
    v_email_recipient_ids := case when coalesce(v_email_enabled, true) then jsonb_build_array(p_recipient_id) else '[]'::jsonb end;
  elsif p_class_id is not null then
    select recipient_ids, email_recipient_ids into v_recipient_ids, v_email_recipient_ids
    from private.lms_outbox_recipients(p_class_id);
  else
    v_recipient_ids := '[]'::jsonb;
    v_email_recipient_ids := '[]'::jsonb;
  end if;
  insert into public.lms_outbox_events (club_id, class_id, event_type, dedupe_key, payload, recipient_ids, email_recipient_ids)
  values (p_club_id, p_class_id, p_event_type, p_dedupe_key,
    jsonb_set(coalesce(p_payload, '{}'::jsonb), '{notification}', jsonb_build_object('title', p_title, 'body', p_body)),
    v_recipient_ids, v_email_recipient_ids)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.materialize_lms_notification()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare v_recipient text;
  v_title text := coalesce(new.payload #>> '{notification,title}', initcap(replace(new.event_type, '_', ' ')));
  v_body text := coalesce(new.payload #>> '{notification,body}', 'There is a new update in your class.');
begin
  for v_recipient in select jsonb_array_elements_text(new.recipient_ids) loop
    insert into public.lms_notifications(recipient_id, outbox_event_id, event_type, dedupe_key, title, body)
    values (v_recipient::uuid, new.id, new.event_type, new.dedupe_key, v_title, v_body)
    on conflict (recipient_id, dedupe_key) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists lms_outbox_materialize_notification on public.lms_outbox_events;
create trigger lms_outbox_materialize_notification after insert on public.lms_outbox_events
for each row execute function private.materialize_lms_notification();

create or replace function private.enqueue_lms_assignment_published()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare c uuid; n text; b text;
begin
  if new.class_id is null or new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then return new; end if;
  select club_id into c from public.classes
  where id = new.class_id and program_type = 'ielts'
    and new.assignment_type = 'ielts_mock' and new.ielts_test_id is not null;
  if c is null then return new; end if;
  n := new.title; b := 'A new assignment is available: ' || new.title;
  perform private.enqueue_lms_outbox(c, new.class_id, 'assignment_published', 'assignment-published:' || new.id::text, jsonb_build_object('assignmentId', new.id), 'New assignment', b);
  return new;
end;
$$;
drop trigger if exists lms_assignment_published on public.club_assignments;
create trigger lms_assignment_published after insert or update of status on public.club_assignments
for each row execute function private.enqueue_lms_assignment_published();

create or replace function private.enqueue_lms_announcement_published()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform private.enqueue_lms_outbox(new.club_id, new.class_id, 'announcement', 'announcement-published:' || new.id::text, jsonb_build_object('announcementId', new.id), new.title, new.body);
  end if;
  return new;
end;
$$;
drop trigger if exists lms_announcement_published on public.lms_announcements;
create trigger lms_announcement_published after insert or update of status on public.lms_announcements
for each row execute function private.enqueue_lms_announcement_published();

create or replace function private.enqueue_lms_ielts_review_event()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare event_type text; key text; title text; body text;
begin
  if new.status = 'returned' and (tg_op = 'INSERT' or old.status <> 'returned') then
    event_type := 'returned'; key := 'review-returned:' || new.id::text || ':' || new.revision::text; title := 'Review returned'; body := coalesce(new.returned_note, 'Your teacher returned work for resubmission.');
    perform private.enqueue_lms_outbox(new.club_id, new.class_id, event_type, key, jsonb_build_object('reviewId', new.id, 'attemptId', new.attempt_id), title, body, new.user_id);
  elsif new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform private.enqueue_lms_outbox(new.club_id, new.class_id, 'result_published', 'attempt-result-published:' || new.attempt_id::text, jsonb_build_object('reviewId', new.id, 'attemptId', new.attempt_id), 'Result published', 'Your teacher published a new result.', new.user_id);
  end if;
  return new;
end;
$$;
drop trigger if exists lms_ielts_review_event on public.ielts_teacher_reviews;
create trigger lms_ielts_review_event after insert or update of status on public.ielts_teacher_reviews
for each row execute function private.enqueue_lms_ielts_review_event();

create or replace function private.enqueue_lms_ielts_resubmission()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare a record; managers jsonb;
begin
  if new.revision = old.revision then return new; end if;
  select club_id, class_id, user_id into a from public.ielts_attempts where id = new.attempt_id;
  managers := private.lms_manager_recipients(a.class_id);
  perform private.enqueue_lms_outbox(a.club_id, a.class_id, 'resubmission', 'resubmission:' || new.attempt_id::text || ':' || new.revision::text, jsonb_build_object('attemptId', new.attempt_id, 'revision', new.revision), 'Resubmission received', 'A learner resubmitted IELTS work for teacher review.', null, managers);
  return new;
end;
$$;
drop trigger if exists lms_ielts_writing_resubmission on public.writing_responses;
create trigger lms_ielts_writing_resubmission after update of revision on public.writing_responses
for each row execute function private.enqueue_lms_ielts_resubmission();
drop trigger if exists lms_ielts_speaking_resubmission on public.speaking_responses;
create trigger lms_ielts_speaking_resubmission after update of revision on public.speaking_responses
for each row execute function private.enqueue_lms_ielts_resubmission();

create or replace function private.enqueue_lms_result_published()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') and new.class_id is not null then
    perform private.enqueue_lms_outbox(new.club_id, new.class_id, 'result_published', 'attempt-result-published:' || new.id::text, jsonb_build_object('attemptId', new.id), 'Result published', 'Your IELTS result is ready.', new.user_id);
  end if;
  return new;
end;
$$;
drop trigger if exists lms_ielts_result_published on public.ielts_attempts;
create trigger lms_ielts_result_published after insert or update of status on public.ielts_attempts
for each row execute function private.enqueue_lms_result_published();

create or replace function public.enqueue_lms_due_soon_events(p_horizon interval default interval '24 hours')
returns integer language plpgsql security definer set search_path = public, private as $$
declare row record; count integer := 0;
begin
  for row in select a.id, a.club_id, a.class_id, a.title, a.due_at
    from public.club_assignments a
    join public.classes c on c.id = a.class_id and c.program_type = 'ielts'
    where a.class_id is not null and a.status = 'active' and a.due_at is not null
      and a.assignment_type = 'ielts_mock' and a.ielts_test_id is not null
      and a.due_at > now() and a.due_at <= now() + p_horizon loop
    perform private.enqueue_lms_outbox(row.club_id, row.class_id, 'due_soon', 'assignment-due-soon:' || row.id::text, jsonb_build_object('assignmentId', row.id, 'dueAt', row.due_at), 'Assignment due soon', 'Assignment "' || row.title || '" is due soon.');
    count := count + 1;
  end loop;
  return count;
end;
$$;

-- Email/in-app workers claim the same durable event. The lock and status
-- transition make retries safe when a worker crashes after claiming.
create or replace function public.claim_lms_outbox_events(p_limit integer default 50)
returns setof public.lms_outbox_events
language plpgsql security definer set search_path = public, private as $$
begin
  return query
  with candidates as (
    select id from public.lms_outbox_events
    where status in ('pending', 'failed') and available_at <= now()
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.lms_outbox_events e
  set status = 'processing', attempts = e.attempts + 1, updated_at = now()
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

create or replace function public.complete_lms_outbox_event(p_event_id uuid, p_success boolean, p_error text default null)
returns public.lms_outbox_events
language plpgsql security definer set search_path = public, private as $$
declare result public.lms_outbox_events;
begin
  update public.lms_outbox_events
  set status = case when p_success then 'sent' else 'failed' end,
      last_error = case when p_success then null else nullif(trim(p_error), '') end,
      processed_at = case when p_success then now() else null end,
      available_at = case when p_success then available_at else now() + interval '5 minutes' end,
      updated_at = now()
  where id = p_event_id and status = 'processing'
  returning * into result;
  if result.id is null then raise exception 'LMS_OUTBOX_EVENT_NOT_PROCESSING'; end if;
  return result;
end;
$$;

-- Cross-club denormalised references are rejected before they can be visible.
create or replace function private.validate_lms_assignment_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare resource_club uuid; resource_scope uuid; class_club uuid; course_ok boolean;
begin
  select club_id, scope_class_id into resource_club, resource_scope from public.lms_resources where id = new.resource_id;
  if (new.class_id is null) = (new.course_id is null) then raise exception 'LMS_RESOURCE_ASSIGNMENT_TARGET_REQUIRED'; end if;
  if resource_scope is not null and (new.class_id is distinct from resource_scope or new.course_id is not null) then raise exception 'LMS_RESOURCE_SCOPE_CLASS_REQUIRED'; end if;
  if new.class_id is not null then select club_id into class_club from public.classes where id = new.class_id; if class_club is null or class_club <> resource_club then raise exception 'LMS_RESOURCE_SCOPE_MISMATCH'; end if; end if;
  if new.class_id is not null and not exists (select 1 from public.classes c where c.id = new.class_id and c.club_id = resource_club and c.program_type = 'ielts') then raise exception 'LMS_RESOURCE_REQUIRES_IELTS_CLASS'; end if;
  if new.course_id is not null then
    select exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id where cca.course_id = new.course_id and c.club_id = resource_club and c.program_type = 'ielts') into course_ok;
    if not course_ok then raise exception 'LMS_RESOURCE_COURSE_REQUIRES_IELTS_CLASS_ASSIGNMENT'; end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_class_club_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare class_club uuid; class_program text;
begin
  if new.class_id is not null then
    select club_id, program_type into class_club, class_program from public.classes where id = new.class_id;
    if class_club is null or class_club <> new.club_id then raise exception 'LMS_CLASS_CLUB_SCOPE_MISMATCH'; end if;
    if class_program <> 'ielts' then raise exception 'LMS_PILOT_REQUIRES_IELTS_CLASS'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists lms_pilot_class_scope on public.lms_pilot_flags;
create trigger lms_pilot_class_scope before insert or update on public.lms_pilot_flags for each row execute function private.validate_lms_class_club_scope();
drop trigger if exists lms_announcement_class_scope on public.lms_announcements;
create trigger lms_announcement_class_scope before insert or update on public.lms_announcements for each row execute function private.validate_lms_class_club_scope();

create or replace function private.validate_lms_content_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare class_club uuid;
begin
  if new.scope_class_id is not null then
    select club_id into class_club from public.classes where id = new.scope_class_id;
    if class_club is null or class_club <> new.club_id or not exists (select 1 from public.classes where id = new.scope_class_id and program_type = 'ielts') then raise exception 'LMS_CONTENT_CLASS_SCOPE_MISMATCH'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists lms_resource_content_scope on public.lms_resources;
create trigger lms_resource_content_scope before insert or update on public.lms_resources for each row execute function private.validate_lms_content_scope();
drop trigger if exists lms_vocab_content_scope on public.lms_vocabulary_sets;
create trigger lms_vocab_content_scope before insert or update on public.lms_vocabulary_sets for each row execute function private.validate_lms_content_scope();

-- Read helpers run as the schema owner so resource/set policies do not recurse
-- through their assignment policies. They still apply the complete tenant and
-- pilot checks explicitly.
create or replace function private.can_read_lms_resource(p_resource_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.lms_resources r
    where r.id = p_resource_id and (
      private.is_admin(p_user_id) or private.can_manage_lms_pilot(r.club_id, p_user_id)
      or (r.scope_class_id is not null and private.can_manage_class(r.scope_class_id, p_user_id))
      or exists (select 1 from public.lms_resource_assignments ra where ra.resource_id = r.id and ra.class_id is not null and private.can_manage_class(ra.class_id, p_user_id))
      or (r.status = 'published' and exists (
        select 1 from public.lms_resource_assignments ra
        join public.class_memberships cm on cm.class_id = ra.class_id and cm.member_role = 'student' and cm.status = 'active' and cm.user_id = p_user_id
        join public.classes c on c.id = ra.class_id
        where ra.resource_id = r.id and ra.class_id is not null and c.club_id = r.club_id and c.program_type = 'ielts' and private.lms_pilot_enabled(r.club_id, ra.class_id)
      ))
      or (r.status = 'published' and exists (
        select 1 from public.lms_resource_assignments ra
        join public.class_course_assignments cca on cca.course_id = ra.course_id
        join public.classes c on c.id = cca.class_id
        join public.class_memberships cm on cm.class_id = c.id and cm.member_role = 'student' and cm.status = 'active' and cm.user_id = p_user_id
        where ra.resource_id = r.id and ra.course_id is not null and c.club_id = r.club_id and c.program_type = 'ielts' and private.lms_pilot_enabled(r.club_id, c.id)
      ))
    )
  );
$$;

create or replace function private.can_read_lms_resource_assignment(p_assignment_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.lms_resource_assignments ra join public.lms_resources r on r.id = ra.resource_id where ra.id = p_assignment_id and private.can_read_lms_resource(r.id, p_user_id));
$$;

create or replace function private.can_manage_lms_resource(p_resource_id uuid, p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.lms_resources r where r.id = p_resource_id and (private.is_admin(p_user_id) or private.can_manage_lms_pilot(r.club_id, p_user_id) or (p_class_id is not null and private.can_manage_class(p_class_id, p_user_id))));
$$;

create or replace function private.can_read_lms_vocabulary_set(p_set_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.lms_vocabulary_sets s
    where s.id = p_set_id and (
      private.is_admin(p_user_id) or private.can_manage_lms_pilot(s.club_id, p_user_id)
      or (s.scope_class_id is not null and private.can_manage_class(s.scope_class_id, p_user_id))
      or exists (select 1 from public.lms_vocabulary_assignments va where va.set_id = s.id and va.class_id is not null and private.can_manage_class(va.class_id, p_user_id))
      or (s.status = 'published' and exists (
        select 1 from public.lms_vocabulary_assignments va
        join public.class_memberships cm on cm.class_id = va.class_id and cm.member_role = 'student' and cm.status = 'active' and cm.user_id = p_user_id
        join public.classes c on c.id = va.class_id
        where va.set_id = s.id and va.class_id is not null and c.club_id = s.club_id and c.program_type = 'ielts' and private.lms_pilot_enabled(s.club_id, va.class_id)
      ))
      or (s.status = 'published' and exists (
        select 1 from public.lms_vocabulary_assignments va
        join public.class_course_assignments cca on cca.course_id = va.course_id
        join public.classes c on c.id = cca.class_id
        join public.class_memberships cm on cm.class_id = c.id and cm.member_role = 'student' and cm.status = 'active' and cm.user_id = p_user_id
        where va.set_id = s.id and va.course_id is not null and c.club_id = s.club_id and c.program_type = 'ielts' and private.lms_pilot_enabled(s.club_id, c.id)
      ))
    )
  );
$$;

create or replace function private.can_read_lms_vocabulary_assignment(p_assignment_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.lms_vocabulary_assignments va where va.id = p_assignment_id and private.can_read_lms_vocabulary_set(va.set_id, p_user_id));
$$;

create or replace function private.can_manage_lms_vocabulary_set(p_set_id uuid, p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.lms_vocabulary_sets s where s.id = p_set_id and (private.is_admin(p_user_id) or private.can_manage_lms_pilot(s.club_id, p_user_id) or (p_class_id is not null and private.can_manage_class(p_class_id, p_user_id))));
$$;
drop trigger if exists lms_resource_assignment_scope on public.lms_resource_assignments;
create trigger lms_resource_assignment_scope before insert or update on public.lms_resource_assignments for each row execute function private.validate_lms_assignment_scope();

create or replace function private.validate_lms_vocab_assignment_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare set_club uuid; set_scope uuid; class_club uuid; course_ok boolean;
begin
  select club_id, scope_class_id into set_club, set_scope from public.lms_vocabulary_sets where id = new.set_id;
  if (new.class_id is null) = (new.course_id is null) then raise exception 'LMS_VOCAB_ASSIGNMENT_TARGET_REQUIRED'; end if;
  if set_scope is not null and (new.class_id is distinct from set_scope or new.course_id is not null) then raise exception 'LMS_VOCAB_SCOPE_CLASS_REQUIRED'; end if;
  if new.class_id is not null then select club_id into class_club from public.classes where id = new.class_id; if class_club is null or class_club <> set_club then raise exception 'LMS_VOCAB_SCOPE_MISMATCH'; end if; end if;
  if new.class_id is not null and not exists (select 1 from public.classes c where c.id = new.class_id and c.club_id = set_club and c.program_type = 'ielts') then raise exception 'LMS_VOCAB_REQUIRES_IELTS_CLASS'; end if;
  if new.course_id is not null then
    select exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id where cca.course_id = new.course_id and c.club_id = set_club and c.program_type = 'ielts') into course_ok;
    if not course_ok then raise exception 'LMS_VOCAB_COURSE_REQUIRES_IELTS_CLASS_ASSIGNMENT'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists lms_vocab_assignment_scope on public.lms_vocabulary_assignments;
create trigger lms_vocab_assignment_scope before insert or update on public.lms_vocabulary_assignments for each row execute function private.validate_lms_vocab_assignment_scope();

alter table public.lms_pilot_flags enable row level security;
alter table public.lms_announcements enable row level security;
alter table public.lms_outbox_events enable row level security;
alter table public.lms_notifications enable row level security;
alter table public.lms_resources enable row level security;
alter table public.lms_resource_assignments enable row level security;
alter table public.lms_vocabulary_sets enable row level security;
alter table public.lms_vocabulary_items enable row level security;
alter table public.lms_vocabulary_assignments enable row level security;

drop policy if exists "LMS managers manage pilot flags" on public.lms_pilot_flags;
create policy "LMS managers manage pilot flags" on public.lms_pilot_flags for all to authenticated using (private.can_manage_lms_pilot(club_id, auth.uid())) with check (private.can_manage_lms_pilot(club_id, auth.uid()));
drop policy if exists "LMS users read enabled pilot flags" on public.lms_pilot_flags;
create policy "LMS users read enabled pilot flags" on public.lms_pilot_flags for select to authenticated using (private.is_admin(auth.uid()) or private.can_manage_club(club_id, auth.uid()) or (class_id is not null and private.can_view_lms_class(class_id, auth.uid())));

drop policy if exists "LMS class announcement reads" on public.lms_announcements;
create policy "LMS class announcement reads" on public.lms_announcements for select to authenticated using (private.is_admin(auth.uid()) or private.can_manage_class(class_id, auth.uid()) or (status = 'published' and private.lms_pilot_enabled(club_id, class_id) and private.can_view_lms_class(class_id, auth.uid())));
drop policy if exists "LMS managers write announcements" on public.lms_announcements;
create policy "LMS managers write announcements" on public.lms_announcements for all to authenticated using (private.is_admin(auth.uid()) or private.can_manage_class(class_id, auth.uid())) with check (private.is_admin(auth.uid()) or private.can_manage_class(class_id, auth.uid()));

drop policy if exists "LMS users read own notifications" on public.lms_notifications;
create policy "LMS users read own notifications" on public.lms_notifications for select to authenticated using (recipient_id = auth.uid() or private.is_admin(auth.uid()));
drop policy if exists "LMS users update own notifications" on public.lms_notifications;
create policy "LMS users update own notifications" on public.lms_notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists "LMS managers read outbox" on public.lms_outbox_events;
create policy "LMS managers read outbox" on public.lms_outbox_events for select to authenticated using (private.is_admin(auth.uid()) or (class_id is not null and private.can_manage_class(class_id, auth.uid())));

drop policy if exists "LMS resource reads" on public.lms_resources;
create policy "LMS resource reads" on public.lms_resources for select to authenticated using (private.can_read_lms_resource(id, auth.uid()));
drop policy if exists "LMS managers write resources" on public.lms_resources;
create policy "LMS managers write resources" on public.lms_resources for all to authenticated using (private.lms_pilot_enabled(club_id, scope_class_id) and (private.can_manage_lms_pilot(club_id, auth.uid()) or (scope_class_id is not null and private.can_manage_class(scope_class_id, auth.uid())))) with check (private.lms_pilot_enabled(club_id, scope_class_id) and (private.can_manage_lms_pilot(club_id, auth.uid()) or (scope_class_id is not null and private.can_manage_class(scope_class_id, auth.uid()))));
drop policy if exists "LMS resource assignment reads" on public.lms_resource_assignments;
create policy "LMS resource assignment reads" on public.lms_resource_assignments for select to authenticated using (private.can_read_lms_resource_assignment(id, auth.uid()));
drop policy if exists "LMS managers write resource assignments" on public.lms_resource_assignments;
create policy "LMS managers write resource assignments" on public.lms_resource_assignments for all to authenticated using (private.can_manage_lms_resource(resource_id, class_id, auth.uid())) with check (private.can_manage_lms_resource(resource_id, class_id, auth.uid()));

drop policy if exists "LMS vocabulary reads" on public.lms_vocabulary_sets;
create policy "LMS vocabulary reads" on public.lms_vocabulary_sets for select to authenticated using (private.can_read_lms_vocabulary_set(id, auth.uid()));
drop policy if exists "LMS managers write vocabulary sets" on public.lms_vocabulary_sets;
create policy "LMS managers write vocabulary sets" on public.lms_vocabulary_sets for all to authenticated using (private.can_manage_lms_pilot(club_id, auth.uid()) or (scope_class_id is not null and private.can_manage_class(scope_class_id, auth.uid()))) with check (private.can_manage_lms_pilot(club_id, auth.uid()) or (scope_class_id is not null and private.can_manage_class(scope_class_id, auth.uid())));
drop policy if exists "LMS vocabulary item reads" on public.lms_vocabulary_items;
create policy "LMS vocabulary item reads" on public.lms_vocabulary_items for select to authenticated using (private.can_read_lms_vocabulary_set(set_id, auth.uid()));
drop policy if exists "LMS managers write vocabulary items" on public.lms_vocabulary_items;
create policy "LMS managers write vocabulary items" on public.lms_vocabulary_items for all to authenticated using (exists (select 1 from public.lms_vocabulary_sets s where s.id = set_id and (private.is_admin(auth.uid()) or private.can_manage_lms_pilot(s.club_id, auth.uid()) or exists (select 1 from public.lms_vocabulary_assignments va where va.set_id = s.id and va.class_id is not null and private.can_manage_class(va.class_id, auth.uid()))))) with check (exists (select 1 from public.lms_vocabulary_sets s where s.id = set_id and (private.is_admin(auth.uid()) or private.can_manage_lms_pilot(s.club_id, auth.uid()) or exists (select 1 from public.lms_vocabulary_assignments va where va.set_id = s.id and va.class_id is not null and private.can_manage_class(va.class_id, auth.uid())))));
drop policy if exists "LMS vocabulary assignment reads" on public.lms_vocabulary_assignments;
create policy "LMS vocabulary assignment reads" on public.lms_vocabulary_assignments for select to authenticated using (private.can_read_lms_vocabulary_assignment(id, auth.uid()));
drop policy if exists "LMS managers write vocabulary assignments" on public.lms_vocabulary_assignments;
create policy "LMS managers write vocabulary assignments" on public.lms_vocabulary_assignments for all to authenticated using (private.can_manage_lms_vocabulary_set(set_id, class_id, auth.uid())) with check (private.can_manage_lms_vocabulary_set(set_id, class_id, auth.uid()));

grant select, insert, update, delete on public.lms_pilot_flags, public.lms_announcements, public.lms_resources, public.lms_resource_assignments, public.lms_vocabulary_sets, public.lms_vocabulary_items, public.lms_vocabulary_assignments to authenticated;
grant select, update on public.lms_notifications to authenticated;
grant select on public.lms_outbox_events to authenticated;
grant all on public.lms_outbox_events, public.lms_notifications to service_role;

-- SECURITY DEFINER trigger helpers must never be callable by API roles.
revoke all on function private.lms_outbox_recipients(uuid) from public, anon, authenticated;
revoke all on function private.lms_manager_recipients(uuid) from public, anon, authenticated;
revoke all on function private.enqueue_lms_outbox(uuid, uuid, text, text, jsonb, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.materialize_lms_notification() from public, anon, authenticated;
revoke all on function private.enqueue_lms_assignment_published() from public, anon, authenticated;
revoke all on function private.enqueue_lms_announcement_published() from public, anon, authenticated;
revoke all on function private.enqueue_lms_ielts_review_event() from public, anon, authenticated;
revoke all on function private.enqueue_lms_ielts_resubmission() from public, anon, authenticated;
revoke all on function private.enqueue_lms_result_published() from public, anon, authenticated;
revoke all on function private.validate_lms_assignment_scope() from public, anon, authenticated;
revoke all on function private.validate_lms_vocab_assignment_scope() from public, anon, authenticated;
revoke all on function private.validate_lms_class_club_scope() from public, anon, authenticated;
revoke all on function private.validate_lms_content_scope() from public, anon, authenticated;
revoke all on function private.can_read_lms_resource(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_lms_resource_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_lms_resource(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_lms_vocabulary_set(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_lms_vocabulary_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_lms_vocabulary_set(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_lms_pilot(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_view_lms_class(uuid, uuid) from public, anon, authenticated;
revoke all on function private.lms_pilot_enabled(uuid, uuid) from public, anon;
revoke all on function public.enqueue_lms_due_soon_events(interval) from public, anon, authenticated;
revoke all on function public.claim_lms_outbox_events(integer) from public, anon, authenticated;
revoke all on function public.complete_lms_outbox_event(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.enqueue_lms_due_soon_events(interval) to service_role;
grant execute on function public.claim_lms_outbox_events(integer) to service_role;
grant execute on function public.complete_lms_outbox_event(uuid, boolean, text) to service_role;
grant execute on function private.lms_pilot_enabled(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_lms_class(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_manage_lms_pilot(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_lms_resource(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_lms_resource_assignment(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_manage_lms_resource(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_lms_vocabulary_set(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_lms_vocabulary_assignment(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_manage_lms_vocabulary_set(uuid, uuid, uuid) to authenticated, service_role;

-- Resource files are private objects. Upload paths are generated by the server
-- as <club>/<class-or-org>/<uploader>/<nonce>/<safe-name>; storage policies
-- and the resource trigger both enforce that namespace.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lms-resources', 'lms-resources', false, 26214400,
  array[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg',
    'audio/mp4', 'audio/wav', 'audio/x-wav'
  ]
)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_manage_lms_resource_storage(
  p_club_id uuid, p_scope_class_id uuid, p_user_id uuid
) returns boolean
language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null
    and private.lms_pilot_enabled(p_club_id, p_scope_class_id)
    and (p_scope_class_id is null or exists (
      select 1 from public.classes scoped_class
      where scoped_class.id = p_scope_class_id
        and scoped_class.club_id = p_club_id
        and scoped_class.program_type = 'ielts'
    ))
    and (
    private.is_admin(p_user_id)
    or (p_scope_class_id is null and private.can_manage_lms_pilot(p_club_id, p_user_id))
    or (p_scope_class_id is not null and private.can_manage_lms_pilot(p_club_id, p_user_id))
    or exists (
      select 1
      from public.classes c
      join public.club_memberships cm on cm.club_id = c.club_id and cm.user_id = p_user_id
        and cm.role = 'coach' and cm.status = 'active'
      join public.class_memberships tm on tm.class_id = c.id and tm.user_id = p_user_id
        and tm.member_role = 'teacher' and tm.status = 'active'
      where c.id = p_scope_class_id and c.club_id = p_club_id and c.program_type = 'ielts'
        and private.lms_pilot_enabled(c.club_id, c.id)
    )
  );
$$;

create or replace function private.validate_lms_resource_file_integrity()
returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  object_owner text;
  object_owner_id text;
  object_metadata jsonb;
  actual_size bigint;
  actual_mime text;
begin
  if tg_op = 'UPDATE' and old.kind = 'file'
    and (old.status <> 'draft' or new.status <> 'draft' or exists (
      select 1 from public.lms_resource_assignments a where a.resource_id = old.id
    ))
    and (
      new.kind is distinct from old.kind
      or new.storage_path is distinct from old.storage_path
      or new.mime_type is distinct from old.mime_type
      or new.size_bytes is distinct from old.size_bytes
      or new.club_id is distinct from old.club_id
      or new.scope_class_id is distinct from old.scope_class_id
      or new.created_by is distinct from old.created_by
  )
  then raise exception 'LMS_RESOURCE_FILE_IDENTITY_IMMUTABLE'; end if;
  if new.kind <> 'file' then return new; end if;
  if new.storage_path is null or new.mime_type is null or new.size_bytes is null
    or new.storage_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(org|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$'
  then raise exception 'LMS_RESOURCE_FILE_PATH_INVALID'; end if;
  if new.size_bytes <= 0 or new.size_bytes > 26214400 then raise exception 'LMS_RESOURCE_FILE_SIZE_INVALID'; end if;
  if new.mime_type not in (
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg',
    'audio/mp4', 'audio/wav', 'audio/x-wav'
  ) then raise exception 'LMS_RESOURCE_FILE_MIME_INVALID'; end if;
  if split_part(new.storage_path, '/', 1) <> new.club_id::text
    or split_part(new.storage_path, '/', 3) <> new.created_by::text
    or ((new.scope_class_id is null and split_part(new.storage_path, '/', 2) <> 'org')
      or (new.scope_class_id is not null and split_part(new.storage_path, '/', 2) <> new.scope_class_id::text))
  then raise exception 'LMS_RESOURCE_FILE_SCOPE_MISMATCH'; end if;

  select o.owner::text, o.owner_id, o.metadata into object_owner, object_owner_id, object_metadata
    from storage.objects o where o.bucket_id = 'lms-resources' and o.name = new.storage_path;
  if object_metadata is null then raise exception 'LMS_RESOURCE_FILE_NOT_FOUND'; end if;
  if coalesce(object_owner, object_owner_id) is distinct from new.created_by::text then raise exception 'LMS_RESOURCE_FILE_OWNER_MISMATCH'; end if;
  actual_size := nullif(coalesce(object_metadata->>'size', object_metadata->>'size_bytes'), '')::bigint;
  actual_mime := nullif(trim(coalesce(object_metadata->>'mimetype', object_metadata->>'contentType')), '');
  if actual_size is null or actual_size <> new.size_bytes then raise exception 'LMS_RESOURCE_FILE_SIZE_MISMATCH'; end if;
  if actual_mime is distinct from new.mime_type then raise exception 'LMS_RESOURCE_FILE_MIME_MISMATCH'; end if;
  return new;
end;
$$;

drop trigger if exists lms_resource_file_integrity on public.lms_resources;
create trigger lms_resource_file_integrity
before insert or update of kind, storage_path, mime_type, size_bytes, club_id, scope_class_id, created_by
on public.lms_resources for each row execute function private.validate_lms_resource_file_integrity();

drop policy if exists "LMS resource files insert" on storage.objects;
create policy "LMS resource files insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'lms-resources'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(org|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and private.can_manage_lms_resource_storage(
    split_part(name, '/', 1)::uuid,
    case when split_part(name, '/', 2) = 'org' then null::uuid else split_part(name, '/', 2)::uuid end,
    (select auth.uid())
  )
);

drop policy if exists "LMS resource files read" on storage.objects;
create policy "LMS resource files read" on storage.objects for select to authenticated
using (
  bucket_id = 'lms-resources'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(org|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$'
  and (
    private.can_manage_lms_resource_storage(
      split_part(name, '/', 1)::uuid,
      case when split_part(name, '/', 2) = 'org' then null::uuid else split_part(name, '/', 2)::uuid end,
      (select auth.uid())
    )
    or exists (select 1 from public.lms_resources r where r.kind = 'file' and r.storage_path = name and private.can_read_lms_resource(r.id, (select auth.uid())))
  )
);

drop policy if exists "LMS resource files update" on storage.objects;
create policy "LMS resource files update" on storage.objects for update to authenticated
using (
  bucket_id = 'lms-resources'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(org|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and private.can_manage_lms_resource_storage(
    split_part(name, '/', 1)::uuid,
    case when split_part(name, '/', 2) = 'org' then null::uuid else split_part(name, '/', 2)::uuid end,
    (select auth.uid())
  )
  and not exists (
    select 1 from public.lms_resources r
    where r.kind = 'file' and r.storage_path = name
  )
)
with check (
  bucket_id = 'lms-resources'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(org|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and private.can_manage_lms_resource_storage(
    split_part(name, '/', 1)::uuid,
    case when split_part(name, '/', 2) = 'org' then null::uuid else split_part(name, '/', 2)::uuid end,
    (select auth.uid())
  )
  and not exists (
    select 1 from public.lms_resources r
    where r.kind = 'file' and r.storage_path = name
  )
);

drop policy if exists "LMS resource files delete" on storage.objects;
create policy "LMS resource files delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'lms-resources'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(org|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$'
  and not exists (
    select 1 from public.lms_resources r
    where r.kind = 'file' and r.storage_path = name
  )
  and (split_part(name, '/', 3) = (select auth.uid())::text or private.can_manage_lms_resource_storage(
    split_part(name, '/', 1)::uuid,
    case when split_part(name, '/', 2) = 'org' then null::uuid else split_part(name, '/', 2)::uuid end,
    (select auth.uid())
  ))
);

revoke all on function private.can_manage_lms_resource_storage(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.validate_lms_resource_file_integrity() from public, anon, authenticated;
grant execute on function private.can_manage_lms_resource_storage(uuid, uuid, uuid) to authenticated, service_role;

commit;
