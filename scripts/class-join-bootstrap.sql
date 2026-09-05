create extension if not exists pgcrypto;
do $$ begin
  create role anon;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated;
exception when duplicate_object then null;
end $$;
create schema if not exists auth;
create schema if not exists private;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.profiles (id uuid primary key, role text not null);
create table public.clubs (id uuid primary key, name text not null, status text not null default 'active');
create table public.classes (
  id uuid primary key, club_id uuid references public.clubs(id), title text not null,
  status text not null, program_type text not null, max_students integer,
  code text, description text, grade_level text, start_date date, end_date date,
  meeting_schedule text, room text, teacher_user_id uuid, created_by uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.club_memberships (
  id uuid primary key default gen_random_uuid(), club_id uuid not null, user_id uuid not null,
  role text not null, status text not null, invited_by uuid
);
create table public.class_memberships (
  id uuid primary key default gen_random_uuid(), class_id uuid not null, user_id uuid not null,
  member_role text not null, status text not null, removed_at timestamptz,
  created_by uuid, updated_at timestamptz default now(), unique(class_id,user_id,member_role)
);
create table public.admin_activity_log (
  id uuid primary key default gen_random_uuid(), admin_user_id uuid, action text,
  entity_type text, entity_id uuid, changes jsonb, created_at timestamptz default now()
);
create or replace function private.organization_is_admin(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
$$;
create or replace function private.organization_role(p_organization_id uuid, p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select cm.role from public.club_memberships cm where cm.club_id=p_organization_id and cm.user_id=p_user_id and cm.status='active'
  order by case cm.role when 'owner' then 1 when 'admin' then 2 when 'teacher' then 3 when 'coach' then 4 else 5 end limit 1
$$;
create or replace function private.organization_can_manage_class(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and exists (select 1 from public.classes c where c.id=p_class_id and (
    private.organization_is_admin(p_user_id) or private.organization_role(c.club_id,p_user_id) in ('owner','admin') or
    (private.organization_role(c.club_id,p_user_id) in ('teacher','coach') and exists (select 1 from public.profiles p where p.id=p_user_id and p.role='teacher') and exists (select 1 from public.class_memberships cm where cm.class_id=c.id and cm.user_id=p_user_id and cm.member_role='teacher' and cm.status='active'))
  ))
$$;
create or replace function private.can_manage_class(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.organization_can_manage_class(p_class_id,p_user_id)
$$;
create or replace function private.write_class_operation_audit(p_actor_id uuid,p_action text,p_class_id uuid,p_changes jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_activity_log(admin_user_id,action,entity_type,entity_id,changes)
  values(p_actor_id,p_action,'class',p_class_id,coalesce(p_changes,'{}'::jsonb))
$$;
insert into public.profiles (id,role) values
 ('00000000-0000-0000-0000-000000000001','teacher'),
 ('00000000-0000-0000-0000-000000000002','student'),
 ('00000000-0000-0000-0000-000000000003','student'),
 ('00000000-0000-0000-0000-000000000004','teacher'),
 ('00000000-0000-0000-0000-000000000005','admin');
insert into public.clubs (id,name,status) values
 ('10000000-0000-0000-0000-000000000001','Local Debate Club','active'),
 ('10000000-0000-0000-0000-000000000002','Closed Club','archived');
insert into public.classes (id,club_id,title,status,program_type,max_students,created_by)
values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Local class','active','debate',1,'00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Uses class','active','debate',10,'00000000-0000-0000-0000-000000000001');
insert into public.club_memberships(club_id,user_id,role,status) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner','active'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','student','active'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','student','active');

create or replace function private.enforce_class_organization_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare class_club uuid;
begin
  if auth.uid() is null then return new; end if;
  select club_id into class_club from public.classes where id=new.class_id;
  if new.member_role='student' and not exists (select 1 from public.club_memberships where club_id=class_club and user_id=new.user_id and role='student' and status='active') then raise exception 'STUDENT_MUST_JOIN_ORGANIZATION'; end if;
  return new;
end $$;
create trigger class_memberships_organization_scope before insert or update on public.class_memberships for each row execute function private.enforce_class_organization_scope();
