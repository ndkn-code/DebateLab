-- DebateLab admin class schedules and program-aware class levels.

alter table public.classes
  add column if not exists program_type text not null default 'debate';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_program_type_check'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_program_type_check
      check (program_type in ('debate', 'ielts', 'public_speaking'));
  end if;
end;
$$;

update public.classes
set program_type = case
  when title ilike '%ielts%' or code ilike '%ielts%' then 'ielts'
  when title ilike '%public speaking%' or title ilike '%speaking%' or code ilike 'PSC%' then 'public_speaking'
  else 'debate'
end
where program_type is null
  or program_type = 'debate';

update public.classes
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{legacy_grade_level}', to_jsonb(grade_level), true)
where grade_level is not null
  and not (
    (program_type in ('debate', 'public_speaking') and lower(grade_level) in ('beginner', 'intermediate', 'advanced'))
    or (program_type = 'ielts' and grade_level in ('Foundation', 'Band 5-6', 'Band 6.5-7.5', 'Band 8+'))
  )
  and not coalesce(metadata, '{}'::jsonb) ? 'legacy_grade_level';

update public.classes
set grade_level = case
  when program_type in ('debate', 'public_speaking') then
    case lower(coalesce(grade_level, ''))
      when 'beginner' then 'Beginner'
      when 'intermediate' then 'Intermediate'
      when 'advanced' then 'Advanced'
      else 'Beginner'
    end
  when program_type = 'ielts' then
    case coalesce(grade_level, '')
      when 'Foundation' then 'Foundation'
      when 'Band 5-6' then 'Band 5-6'
      when 'Band 6.5-7.5' then 'Band 6.5-7.5'
      when 'Band 8+' then 'Band 8+'
      else 'Foundation'
    end
  else grade_level
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_program_level_check'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_program_level_check
      check (
        (program_type in ('debate', 'public_speaking') and grade_level in ('Beginner', 'Intermediate', 'Advanced'))
        or (program_type = 'ielts' and grade_level in ('Foundation', 'Band 5-6', 'Band 6.5-7.5', 'Band 8+'))
      );
  end if;
end;
$$;

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  room text,
  location text,
  start_date date not null,
  end_date date,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/New_York',
  recurrence_rule jsonb not null default '{"frequency":"none"}'::jsonb,
  recurrence_summary text,
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (end_time > start_time)
);

create index if not exists idx_classes_program_level
  on public.classes(program_type, grade_level, status);
create index if not exists idx_class_schedules_class_range
  on public.class_schedules(class_id, start_date, coalesce(end_date, start_date));
create index if not exists idx_class_schedules_course
  on public.class_schedules(course_id)
  where course_id is not null;
create index if not exists idx_class_schedules_admin_range
  on public.class_schedules(status, start_date, coalesce(end_date, start_date));

alter table public.class_schedules enable row level security;

drop policy if exists "Admins can manage class schedules" on public.class_schedules;
create policy "Admins can manage class schedules"
  on public.class_schedules for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Students can view own class schedules" on public.class_schedules;
create policy "Students can view own class schedules"
  on public.class_schedules for select
  using (
    private.is_admin(auth.uid())
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = class_schedules.class_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop view if exists public.admin_class_list_rows;

create view public.admin_class_list_rows
with (security_invoker = true)
as
select
  c.id,
  c.code,
  c.title,
  c.description,
  c.program_type,
  c.grade_level,
  c.status,
  c.start_date,
  c.end_date,
  c.meeting_schedule,
  c.room,
  c.max_students,
  c.created_at,
  c.updated_at,
  coalesce(m.student_count, 0)::integer as student_count,
  coalesce(a.assigned_course_count, 0)::integer as assigned_course_count,
  coalesce(s.session_count_30d, 0)::integer as session_count_30d,
  coalesce(cs.schedule_count, 0)::integer as schedule_count,
  case
    when coalesce(r.total_records_30d, 0) = 0 then null
    else round(((coalesce(r.present_records_30d, 0) + coalesce(r.late_records_30d, 0))::numeric / r.total_records_30d::numeric) * 100)
  end as attendance_rate_30d
from public.classes c
left join (
  select class_id, count(*) as student_count
  from public.class_memberships
  where member_role = 'student'
    and status = 'active'
  group by class_id
) m on m.class_id = c.id
left join (
  select class_id, count(*) as assigned_course_count
  from public.class_course_assignments
  group by class_id
) a on a.class_id = c.id
left join (
  select class_id, count(*) as session_count_30d
  from public.class_attendance_sessions
  where session_date >= (current_date - interval '30 days')::date
  group by class_id
) s on s.class_id = c.id
left join (
  select class_id, count(*) as schedule_count
  from public.class_schedules
  where status = 'active'
  group by class_id
) cs on cs.class_id = c.id
left join (
  select
    sessions.class_id,
    count(records.id) as total_records_30d,
    count(records.id) filter (where records.status = 'present') as present_records_30d,
    count(records.id) filter (where records.status = 'late') as late_records_30d
  from public.class_attendance_sessions sessions
  left join public.class_attendance_records records on records.session_id = sessions.id
  where sessions.session_date >= (current_date - interval '30 days')::date
  group by sessions.class_id
) r on r.class_id = c.id;

grant select on public.admin_class_list_rows to authenticated;
