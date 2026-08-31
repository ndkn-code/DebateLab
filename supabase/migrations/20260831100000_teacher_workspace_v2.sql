-- Teacher workspace v2 foundation.
--
-- This migration is additive.  The existing lms_pilot_flags table remains the
-- feature-flag store; teacher_workspace_v2 is deliberately a separate key from
-- ielts_lms_pilot_v1 so the public IELTS flag cannot grant teacher access (or
-- vice versa).

begin;

do $$
begin
  if to_regclass('public.lms_pilot_flags') is null then
    raise exception 'lms_pilot_flags must be installed before teacher_workspace_v2';
  end if;
end;
$$;

create or replace function private.teacher_workspace_enabled(
  p_club_id uuid,
  p_class_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select coalesce(
    (select f.enabled
       from public.lms_pilot_flags f
      where f.club_id = p_club_id
        and f.feature_key = 'teacher_workspace_v2'
        and f.class_id = p_class_id
      limit 1),
    (select f.enabled
       from public.lms_pilot_flags f
      where f.club_id = p_club_id
        and f.feature_key = 'teacher_workspace_v2'
        and f.class_id is null
      limit 1),
    false
  );
$$;

create or replace function private.lms_occurrence_feature_enabled(
  p_club_id uuid,
  p_class_id uuid,
  p_program_type text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select case
    when p_program_type = 'ielts'
      then private.lms_pilot_enabled(p_club_id, p_class_id)
        or private.teacher_workspace_enabled(p_club_id, p_class_id)
    when p_program_type in ('debate', 'public_speaking')
      then private.teacher_workspace_enabled(p_club_id, p_class_id)
    else false
  end;
$$;

-- The legacy communication/content triggers were IELTS-only. Teacher workspace
-- v2 is subject-neutral, while every pre-existing IELTS pilot flag retains its
-- original IELTS-only semantics.
create or replace function private.validate_lms_class_club_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  class_club uuid;
  class_program text;
begin
  if new.class_id is null then return new; end if;
  select c.club_id, c.program_type into class_club, class_program
    from public.classes c where c.id = new.class_id;
  if class_club is null or class_club <> new.club_id then
    raise exception 'LMS_CLASS_CLUB_SCOPE_MISMATCH';
  end if;
  if tg_table_name = 'lms_pilot_flags'
     and coalesce(to_jsonb(new) ->> 'feature_key', '') <> 'teacher_workspace_v2'
     and class_program <> 'ielts' then
    raise exception 'LMS_PILOT_REQUIRES_IELTS_CLASS';
  end if;
  if class_program not in ('ielts', 'debate', 'public_speaking') then
    raise exception 'LMS_CLASS_PROGRAM_UNSUPPORTED';
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_content_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  class_row record;
begin
  if new.scope_class_id is null then return new; end if;
  select c.club_id, c.program_type into class_row
    from public.classes c where c.id = new.scope_class_id;
  if not found or class_row.club_id <> new.club_id
     or class_row.program_type not in ('ielts', 'debate', 'public_speaking')
     or not private.lms_occurrence_feature_enabled(new.club_id, new.scope_class_id, class_row.program_type) then
    raise exception 'LMS_CONTENT_CLASS_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  resource_row record;
  target_ok boolean := false;
begin
  select r.club_id, r.scope_class_id into resource_row
    from public.lms_resources r where r.id = new.resource_id;
  if not found or (new.class_id is null) = (new.course_id is null) then
    raise exception 'LMS_RESOURCE_ASSIGNMENT_TARGET_REQUIRED';
  end if;
  if resource_row.scope_class_id is not null
     and (new.class_id is distinct from resource_row.scope_class_id or new.course_id is not null) then
    raise exception 'LMS_RESOURCE_SCOPE_CLASS_REQUIRED';
  end if;
  if new.class_id is not null then
    select exists (
      select 1 from public.classes c
       where c.id = new.class_id and c.club_id = resource_row.club_id
         and c.program_type in ('ielts', 'debate', 'public_speaking')
         and private.lms_occurrence_feature_enabled(c.club_id, c.id, c.program_type)
    ) into target_ok;
  else
    select exists (
      select 1
        from public.class_course_assignments assignment
        join public.classes c on c.id = assignment.class_id
       where assignment.course_id = new.course_id
         and c.club_id = resource_row.club_id
         and c.program_type in ('ielts', 'debate', 'public_speaking')
         and private.lms_occurrence_feature_enabled(c.club_id, c.id, c.program_type)
    ) into target_ok;
  end if;
  if not target_ok then raise exception 'LMS_RESOURCE_SCOPE_MISMATCH'; end if;
  return new;
end;
$$;

create or replace function private.enqueue_lms_outbox(
  p_club_id uuid,
  p_class_id uuid,
  p_event_type text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_title text default '',
  p_body text default '',
  p_recipient_id uuid default null,
  p_recipient_ids jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_id uuid;
  v_recipient_ids jsonb;
  v_email_recipient_ids jsonb;
  v_email_enabled boolean;
begin
  if p_club_id is null then return null; end if;
  if p_class_id is null then
    if not private.lms_pilot_enabled(p_club_id, null)
       and not private.teacher_workspace_enabled(p_club_id, null) then return null; end if;
  elsif not exists (
    select 1 from public.classes c
     where c.id = p_class_id and c.club_id = p_club_id
       and private.lms_occurrence_feature_enabled(c.club_id, c.id, c.program_type)
  ) then return null;
  end if;

  if p_recipient_ids is not null then
    v_recipient_ids := p_recipient_ids;
    select coalesce(jsonb_agg(profile.id order by profile.id), '[]'::jsonb)
      into v_email_recipient_ids
      from public.profiles profile
     where profile.id in (select value::uuid from jsonb_array_elements_text(p_recipient_ids))
       and coalesce((profile.preferences ->> 'email_notifications')::boolean, true);
  elsif p_recipient_id is not null then
    select coalesce((profile.preferences ->> 'email_notifications')::boolean, true)
      into v_email_enabled from public.profiles profile where profile.id = p_recipient_id;
    v_recipient_ids := jsonb_build_array(p_recipient_id);
    v_email_recipient_ids := case when coalesce(v_email_enabled, true)
      then jsonb_build_array(p_recipient_id) else '[]'::jsonb end;
  elsif p_class_id is not null then
    select recipients.recipient_ids, recipients.email_recipient_ids
      into v_recipient_ids, v_email_recipient_ids
      from private.lms_outbox_recipients(p_class_id) recipients;
  else
    v_recipient_ids := '[]'::jsonb;
    v_email_recipient_ids := '[]'::jsonb;
  end if;

  insert into public.lms_outbox_events (
    club_id, class_id, event_type, dedupe_key, payload,
    recipient_ids, email_recipient_ids
  ) values (
    p_club_id, p_class_id, p_event_type, p_dedupe_key,
    jsonb_set(coalesce(p_payload, '{}'::jsonb), '{notification}',
      jsonb_build_object('title', p_title, 'body', p_body)),
    v_recipient_ids, v_email_recipient_ids
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- The core-loop validator originally accepted only IELTS cohorts.  Keep all
-- denormalized class/org/course/date checks and widen only the program + pilot
-- decision to the three supported teaching programs.
create or replace function private.validate_lms_lesson_occurrence_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  class_row record;
  content_course uuid;
  schedule_row record;
begin
  select c.club_id, c.program_type into class_row
    from public.classes c where c.id = new.class_id;
  if not found or class_row.club_id is distinct from new.club_id then
    raise exception 'LMS_OCCURRENCE_CLASS_SCOPE_MISMATCH';
  end if;
  if class_row.program_type not in ('ielts', 'debate', 'public_speaking') then
    raise exception 'LMS_OCCURRENCE_PROGRAM_UNSUPPORTED';
  end if;
  if not private.lms_occurrence_feature_enabled(
    new.club_id, new.class_id, class_row.program_type
  ) then
    raise exception 'LMS_PILOT_DISABLED';
  end if;

  if new.lesson_id is not null then
    select m.course_id into content_course
      from public.lessons l
      join public.course_modules m on m.id = l.module_id
     where l.id = new.lesson_id;
    if content_course is distinct from new.course_id then
      raise exception 'LMS_OCCURRENCE_LESSON_COURSE_MISMATCH';
    end if;
  end if;
  if new.activity_id is not null then
    select m.course_id into content_course
      from public.activities a
      join public.course_modules m on m.id = a.module_id
     where a.id = new.activity_id;
    if content_course is distinct from new.course_id then
      raise exception 'LMS_OCCURRENCE_ACTIVITY_COURSE_MISMATCH';
    end if;
  end if;
  if new.class_schedule_id is not null then
    select s.class_id, s.course_id, s.timezone into schedule_row
      from public.class_schedules s where s.id = new.class_schedule_id;
    if not found or schedule_row.class_id <> new.class_id
       or (schedule_row.course_id is not null and schedule_row.course_id <> new.course_id) then
      raise exception 'LMS_OCCURRENCE_SCHEDULE_SCOPE_MISMATCH';
    end if;
  end if;
  if new.occurrence_date <> (new.starts_at at time zone new.timezone)::date then
    raise exception 'LMS_OCCURRENCE_LOCAL_DATE_MISMATCH';
  end if;
  return new;
end;
$$;

-- Teacher workspace access is exact-class for teachers and organization-wide
-- for owners/admins.  Platform admins retain their existing global authority.
create or replace function private.can_access_teacher_workspace(
  p_class_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1
      from public.classes c
     where c.id = p_class_id
       and private.teacher_workspace_enabled(c.club_id, c.id)
       and (
         private.is_admin(p_user_id)
         or private.organization_role(c.club_id, p_user_id) in ('owner', 'admin')
         or (
           private.organization_role(c.club_id, p_user_id) in ('teacher', 'coach')
           and exists (
             select 1 from public.profiles p
              where p.id = p_user_id and p.role = 'teacher'
           )
           and exists (
             select 1 from public.class_memberships cm
              where cm.class_id = c.id
                and cm.user_id = p_user_id
                and cm.member_role = 'teacher'
                and cm.status = 'active'
           )
         )
       )
  );
$$;

create or replace function private.has_teacher_ielts_entitlement(
  p_user_id uuid,
  p_club_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1
      from public.classes c
     where c.program_type = 'ielts'
       and (p_club_id is null or c.club_id = p_club_id)
       and private.can_access_teacher_workspace(c.id, p_user_id)
  );
$$;

-- Existing LMS flag reads intentionally hide organization-level flags from
-- ordinary teachers.  Teacher workspace capability needs the enabled org flag
-- to resolve class inheritance, so expose only the teacher's exact enabled
-- organization scope (never another organization's flag).
drop policy if exists "Teacher workspace users read organization flags"
  on public.lms_pilot_flags;
create policy "Teacher workspace users read organization flags"
on public.lms_pilot_flags for select to authenticated
using (
  feature_key = 'teacher_workspace_v2'
  and class_id is null
  and exists (
    select 1
      from public.classes c
     where c.club_id = lms_pilot_flags.club_id
       and private.can_access_teacher_workspace(c.id, (select auth.uid()))
  )
);

revoke all on function private.teacher_workspace_enabled(uuid, uuid),
  private.lms_occurrence_feature_enabled(uuid, uuid, text),
  private.can_access_teacher_workspace(uuid, uuid),
  private.has_teacher_ielts_entitlement(uuid, uuid)
  from public, anon;
grant execute on function private.teacher_workspace_enabled(uuid, uuid),
  private.lms_occurrence_feature_enabled(uuid, uuid, text),
  private.can_access_teacher_workspace(uuid, uuid),
  private.has_teacher_ielts_entitlement(uuid, uuid)
  to authenticated, service_role;

create table if not exists public.teacher_workspace_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_calendar_view text not null default 'week'
    check (default_calendar_view in ('day', 'week', 'month', 'agenda')),
  week_start smallint not null default 1 check (week_start between 0 and 6),
  working_hour_start time not null default '08:00',
  working_hour_end time not null default '20:00',
  timezone_mode text not null default 'class'
    check (timezone_mode in ('class', 'user', 'fixed')),
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (working_hour_end > working_hour_start),
  check (timezone_mode <> 'fixed' or timezone is not null)
);

create table if not exists public.teacher_workspace_class_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  color_token text not null default 'blue'
    check (color_token in ('blue', 'teal', 'amber', 'coral', 'violet', 'pink', 'slate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, class_id)
);

alter table public.teacher_workspace_preferences enable row level security;
alter table public.teacher_workspace_class_preferences enable row level security;
revoke all on public.teacher_workspace_preferences,
  public.teacher_workspace_class_preferences from anon;
grant select, insert, update, delete on public.teacher_workspace_preferences,
  public.teacher_workspace_class_preferences to authenticated;

drop policy if exists "Teachers manage own workspace preferences"
  on public.teacher_workspace_preferences;
create policy "Teachers manage own workspace preferences"
on public.teacher_workspace_preferences for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
      from public.classes c
     where private.can_access_teacher_workspace(c.id, (select auth.uid()))
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
      from public.classes c
     where private.can_access_teacher_workspace(c.id, (select auth.uid()))
  )
);

drop policy if exists "Teachers manage own class colors"
  on public.teacher_workspace_class_preferences;
create policy "Teachers manage own class colors"
on public.teacher_workspace_class_preferences for all to authenticated
using (
  user_id = (select auth.uid())
  and private.can_access_teacher_workspace(class_id, (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and private.can_access_teacher_workspace(class_id, (select auth.uid()))
);

-- Teacher views must see occurrences enabled by either the legacy IELTS pilot
-- or the independent teacher workspace pilot.  Learner historical rules remain
-- unchanged after this feature gate.
create or replace function private.can_view_lms_occurrence(
  p_occurrence_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1
      from public.lms_lesson_occurrences o
      join public.classes c on c.id = o.class_id
     where o.id = p_occurrence_id
       and private.lms_occurrence_feature_enabled(o.club_id, o.class_id, c.program_type)
       and (
         private.can_manage_class(o.class_id, p_user_id)
         or (
           o.published_at is not null
           and o.status <> 'cancelled'
           and (
             exists (
               select 1 from public.class_memberships active_student
                where active_student.class_id = o.class_id
                  and active_student.user_id = p_user_id
                  and active_student.member_role = 'student'
                  and active_student.status = 'active'
             )
             or (
               o.starts_at <= now()
               and exists (
                 select 1 from public.lms_occurrence_roster_snapshots snapshot
                  where snapshot.occurrence_id = o.id
                    and snapshot.user_id = p_user_id
               )
             )
           )
         )
       )
  );
$$;

create or replace function private.can_read_lms_resource(
  p_resource_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1
      from public.lms_resources resource
     where resource.id = p_resource_id
       and (
         private.is_admin(p_user_id)
         or private.can_manage_lms_pilot(resource.club_id, p_user_id)
         or (resource.scope_class_id is not null and private.can_manage_class(resource.scope_class_id, p_user_id))
         or exists (
           select 1 from public.lms_resource_assignments placement
            where placement.resource_id = resource.id
              and placement.class_id is not null
              and private.can_manage_class(placement.class_id, p_user_id)
         )
         or (
           resource.status = 'published'
           and exists (
             select 1
               from public.lms_resource_assignments placement
               join public.classes c on c.id = placement.class_id
               join public.class_memberships member
                 on member.class_id = c.id and member.user_id = p_user_id
                and member.member_role = 'student' and member.status = 'active'
              where placement.resource_id = resource.id
                and placement.class_id is not null
                and c.club_id = resource.club_id
                and private.lms_occurrence_feature_enabled(c.club_id, c.id, c.program_type)
           )
         )
         or (
           resource.status = 'published'
           and exists (
             select 1
               from public.lms_resource_assignments placement
               join public.class_course_assignments course_assignment
                 on course_assignment.course_id = placement.course_id
               join public.classes c on c.id = course_assignment.class_id
               join public.class_memberships member
                 on member.class_id = c.id and member.user_id = p_user_id
                and member.member_role = 'student' and member.status = 'active'
              where placement.resource_id = resource.id
                and placement.course_id is not null
                and c.club_id = resource.club_id
                and private.lms_occurrence_feature_enabled(c.club_id, c.id, c.program_type)
           )
         )
       )
  );
$$;

drop policy if exists "LMS class announcement reads" on public.lms_announcements;
create policy "LMS class announcement reads"
on public.lms_announcements for select to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
  or (
    status = 'published'
    and coalesce(published_at, publish_at) <= now()
    and exists (
      select 1 from public.classes c
       where c.id = lms_announcements.class_id
         and c.club_id = lms_announcements.club_id
         and private.lms_occurrence_feature_enabled(c.club_id, c.id, c.program_type)
    )
    and private.can_view_lms_class(class_id, (select auth.uid()))
  )
);

drop policy if exists "LMS managers write resources" on public.lms_resources;
create policy "LMS managers write resources"
on public.lms_resources for all to authenticated
using (
  private.is_admin((select auth.uid()))
  or (scope_class_id is not null
      and private.teacher_workspace_enabled(club_id, scope_class_id)
      and private.can_manage_class(scope_class_id, (select auth.uid())))
  or (scope_class_id is null and private.can_manage_lms_pilot(club_id, (select auth.uid())))
)
with check (
  private.is_admin((select auth.uid()))
  or (scope_class_id is not null
      and private.teacher_workspace_enabled(club_id, scope_class_id)
      and private.can_manage_class(scope_class_id, (select auth.uid())))
  or (scope_class_id is null and private.can_manage_lms_pilot(club_id, (select auth.uid())))
);

create index if not exists teacher_workspace_class_preferences_class_idx
  on public.teacher_workspace_class_preferences(class_id, user_id);
create index if not exists lms_pilot_flags_teacher_workspace_idx
  on public.lms_pilot_flags(club_id, class_id, enabled)
  where feature_key = 'teacher_workspace_v2';

commit;
