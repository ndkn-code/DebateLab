-- DebateLab admin classes, course assignments, and attendance
-- Course-first adaptation of Lumist's class/attendance workflows.

alter table public.courses
  add column if not exists visibility text not null default 'public';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'courses_visibility_check'
      and conrelid = 'public.courses'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'courses_visibility_check'
        and conrelid = 'public.courses'::regclass
        and pg_get_constraintdef(oid) like '%class_restricted%'
    ) then
      alter table public.courses drop constraint courses_visibility_check;
      alter table public.courses
        add constraint courses_visibility_check
        check (visibility in ('public', 'premium', 'class_restricted'));
    end if;
  else
    alter table public.courses
      add constraint courses_visibility_check
      check (visibility in ('public', 'premium', 'class_restricted'));
  end if;
end;
$$;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  grade_level text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  start_date date,
  end_date date,
  meeting_schedule text,
  room text,
  max_students integer,
  teacher_user_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'student'
    check (member_role in ('student', 'teacher')),
  status text not null default 'active'
    check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, user_id, member_role)
);

create table if not exists public.class_course_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (class_id, course_id)
);

create table if not exists public.class_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  session_date date not null,
  title text,
  notes text,
  taken_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, course_id, session_date)
);

create table if not exists public.class_attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_attendance_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists idx_classes_status_dates
  on public.classes(status, start_date, end_date);
create index if not exists idx_classes_search
  on public.classes using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(code, '') || ' ' || coalesce(grade_level, ''))
  );
create index if not exists idx_class_memberships_user_status
  on public.class_memberships(user_id, status);
create index if not exists idx_class_memberships_class_role_status
  on public.class_memberships(class_id, member_role, status);
create index if not exists idx_class_course_assignments_course_class
  on public.class_course_assignments(course_id, class_id);
create index if not exists idx_class_attendance_sessions_class_date
  on public.class_attendance_sessions(class_id, session_date desc);
create index if not exists idx_class_attendance_sessions_course_date
  on public.class_attendance_sessions(course_id, session_date desc);
create index if not exists idx_class_attendance_records_session_status
  on public.class_attendance_records(session_id, status);
create index if not exists idx_class_attendance_records_user
  on public.class_attendance_records(user_id);

alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.class_course_assignments enable row level security;
alter table public.class_attendance_sessions enable row level security;
alter table public.class_attendance_records enable row level security;

drop policy if exists "Admins can manage classes" on public.classes;
create policy "Admins can manage classes"
  on public.classes for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Students can view own classes" on public.classes;
create policy "Students can view own classes"
  on public.classes for select
  using (
    private.is_admin(auth.uid())
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = classes.id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop policy if exists "Admins can manage class memberships" on public.class_memberships;
create policy "Admins can manage class memberships"
  on public.class_memberships for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own class memberships" on public.class_memberships;
create policy "Users can view own class memberships"
  on public.class_memberships for select
  using (private.is_admin(auth.uid()) or user_id = auth.uid());

drop policy if exists "Admins can manage class course assignments" on public.class_course_assignments;
create policy "Admins can manage class course assignments"
  on public.class_course_assignments for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Students can view assigned class courses" on public.class_course_assignments;
create policy "Students can view assigned class courses"
  on public.class_course_assignments for select
  using (
    private.is_admin(auth.uid())
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = class_course_assignments.class_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop policy if exists "Admins can manage class attendance sessions" on public.class_attendance_sessions;
create policy "Admins can manage class attendance sessions"
  on public.class_attendance_sessions for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Students can view own class attendance sessions" on public.class_attendance_sessions;
create policy "Students can view own class attendance sessions"
  on public.class_attendance_sessions for select
  using (
    private.is_admin(auth.uid())
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = class_attendance_sessions.class_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop policy if exists "Admins can manage class attendance records" on public.class_attendance_records;
create policy "Admins can manage class attendance records"
  on public.class_attendance_records for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Students can view own class attendance records" on public.class_attendance_records;
create policy "Students can view own class attendance records"
  on public.class_attendance_records for select
  using (private.is_admin(auth.uid()) or user_id = auth.uid());

create or replace view public.admin_class_list_rows
with (security_invoker = true)
as
select
  c.id,
  c.code,
  c.title,
  c.description,
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

create or replace view public.admin_course_list_rows
with (security_invoker = true)
as
select
  c.*,
  coalesce(e.enrollment_count, 0)::integer as enrollment_count,
  coalesce(a.assigned_class_count, 0)::integer as assigned_class_count
from public.courses c
left join (
  select course_id, count(*) as enrollment_count
  from public.enrollments
  group by course_id
) e on e.course_id = c.id
left join (
  select course_id, count(*) as assigned_class_count
  from public.class_course_assignments
  group by course_id
) a on a.course_id = c.id;

create or replace view public.admin_popular_courses
with (security_invoker = true)
as
select
  c.id as course_id,
  c.title,
  count(e.id)::integer as enrollment_count
from public.courses c
left join public.enrollments e on e.course_id = c.id
where c.is_published = true
  and coalesce(c.is_archived, false) = false
group by c.id, c.title
order by count(e.id) desc, c.title asc;
