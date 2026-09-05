-- Isolated contract fixture, NOT a full Supabase clone. Unrelated triggers/storage/auth are omitted.
create extension if not exists pgcrypto;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create schema if not exists private;
create table auth.users(id uuid primary key, email text);
create table public.profiles(id uuid primary key references auth.users(id), role text not null default 'student');
create table public.clubs(id uuid primary key, code text unique, name text not null, owner_user_id uuid, status text not null default 'active');
create table public.club_memberships(club_id uuid,user_id uuid,role text,status text,joined_at timestamptz,primary key(club_id,user_id));
create table public.classes(id uuid primary key default gen_random_uuid(),club_id uuid references public.clubs,title text not null,code text unique,status text not null default 'active',program_type text not null,grade_level text,start_date date,end_date date,description text,meeting_schedule text,room text,max_students integer,created_by uuid,metadata jsonb not null default '{}',updated_at timestamptz not null default now());
create table public.courses(id uuid primary key,title text not null,slug text,subject text,club_id uuid,is_published boolean not null default false,is_archived boolean not null default false,visibility text,created_by uuid,updated_at timestamptz not null default now());
create table public.course_modules(id uuid primary key,course_id uuid,title text not null,sort_order integer not null default 0);
create table public.lessons(id uuid primary key,module_id uuid,title text not null,is_published boolean not null default true);
create table public.class_course_assignments(id uuid primary key default gen_random_uuid(),class_id uuid,course_id uuid,assigned_by uuid,metadata jsonb not null default '{}',unique(class_id,course_id));
create table public.club_assignments(id uuid primary key default gen_random_uuid(),club_id uuid,class_id uuid,title text not null,description text,assignment_type text not null default 'practice',assigned_track text not null default 'debate',topic_title text,topic_category text,due_at timestamptz,required_attempts integer not null default 1,rubric_key text not null default 'debate_v1',rubric_version integer not null default 1,status text not null default 'draft',created_by uuid,metadata jsonb not null default '{}',ielts_test_id uuid,submission_text_enabled boolean not null default true,submission_files_enabled boolean not null default true,submission_max_files integer not null default 5,submission_max_file_mb integer not null default 20,submission_allowed_ext text[],submission_instructions text);
create table public.lms_resource_assignments(id uuid primary key, resource_id uuid, class_id uuid);
create table public.lms_resources(id uuid primary key,scope_class_id uuid);
create table public.lms_materials(id uuid primary key,club_id uuid,scope_class_id uuid,program_type text,title text,status text,updated_at timestamptz not null default now());
create table public.lms_material_versions(id uuid primary key,material_id uuid,processing_status text,content_review_status text,updated_at timestamptz not null default now());
create table public.lms_material_placements(id uuid primary key default gen_random_uuid(),material_id uuid,version_id uuid,club_id uuid,target_type text,class_id uuid,course_id uuid,occurrence_id uuid,assignment_id uuid,source_assignment_id uuid,order_index integer not null default 0,required boolean not null default false,audience_mode text not null default 'all',status text not null default 'draft',release_at timestamptz,expires_at timestamptz,created_by uuid);
create table public.lms_material_rights_approvals(id uuid primary key,material_id uuid,version_id uuid,decision text,expires_at timestamptz,reviewed_at timestamptz not null default now());
create table public.lms_material_audiences(id uuid primary key,placement_id uuid,user_id uuid,status text);
create table public.lms_material_unlock_rules(id uuid primary key,placement_id uuid);
create table public.lms_occurrence_assignments(occurrence_id uuid,assignment_id uuid,primary key(occurrence_id,assignment_id));
create table public.organization_operation_idempotency(actor_id uuid,operation text,idempotency_key text,request_hash text,response_payload jsonb,completed_at timestamptz,primary key(actor_id,operation,idempotency_key));
create table public.organization_audit_events(id uuid primary key default gen_random_uuid(),club_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,changes jsonb,idempotency_key text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function private.organization_is_admin(u uuid) returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=u and role='admin') $$;
create or replace function private.organization_can_academic_admin(o uuid,u uuid) returns boolean language sql stable as $$ select private.organization_is_admin(u) or exists(select 1 from public.club_memberships where club_id=o and user_id=u and status='active' and role in ('owner','admin','head_teacher')) $$;
create or replace function private.organization_can_manage_class(c uuid,u uuid) returns boolean language sql stable as $$ select private.organization_is_admin(u) or exists(select 1 from public.classes x join public.club_memberships m on m.club_id=x.club_id where x.id=c and m.user_id=u and m.status='active' and m.role in ('owner','admin','head_teacher')) $$;
create or replace function private.can_read_curriculum_course(c uuid,u uuid) returns boolean language sql stable as $$ select exists(select 1 from public.courses x where x.id=c and not x.is_archived and ((x.club_id is null and x.is_published) or x.club_id is not null)) $$;
create or replace function private.organization_audit(o uuid,u uuid,a text,t text,e uuid,p jsonb,k text) returns void language sql as $$ insert into public.organization_audit_events(club_id,actor_id,action,entity_type,entity_id,changes,idempotency_key) values(o,u,a,t,e,p,k) $$;
grant select on all tables in schema public to authenticated;

-- Representative relational and status constraints from production DDL.
alter table public.classes add check(status in ('draft','active','archived'));
alter table public.club_assignments add check(status in ('draft','active','archived'));
alter table public.class_course_assignments add foreign key(class_id) references public.classes(id), add foreign key(course_id) references public.courses(id);
alter table public.lms_material_placements add foreign key(material_id) references public.lms_materials(id),add foreign key(version_id) references public.lms_material_versions(id),add foreign key(class_id) references public.classes(id),add check(status in ('draft','scheduled','published','withdrawn')),add check(expires_at is null or release_at is null or expires_at>release_at);
create table public.class_memberships(id uuid primary key, class_id uuid, user_id uuid,member_role text,status text);
create table public.attendance_records(id uuid primary key, class_id uuid, user_id uuid);
create table public.club_assignment_submissions(id uuid primary key, assignment_id uuid, user_id uuid);
create table public.lms_announcements(id uuid primary key, class_id uuid, body text);
create table public.lms_outbox_events(id uuid primary key, class_id uuid);
create table public.student_progress(id uuid primary key, class_id uuid, user_id uuid);
create table public.private_feedback(id uuid primary key, class_id uuid, user_id uuid);
create table public.student_grades(id uuid primary key, class_id uuid, user_id uuid);
grant select on all tables in schema public to authenticated;

create or replace function private.organization_idempotency_lookup(
  p_actor_id uuid, p_operation text, p_idempotency_key text, p_request_hash text
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare row_value public.organization_operation_idempotency%rowtype;
begin
  select * into row_value from public.organization_operation_idempotency
  where actor_id = p_actor_id and operation = p_operation and idempotency_key = p_idempotency_key
  for update;
  if not found then return null; end if;
  if row_value.request_hash is distinct from p_request_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSE';
  end if;
  return row_value.response_payload;
end;
$$;

create or replace function private.lms_material_version_rights_approved(p_version_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_material_rights_approvals approved
    where approved.version_id = p_version_id
      and approved.decision = 'approved'
      and (approved.expires_at is null or approved.expires_at > now())
      and not exists (
        select 1 from public.lms_material_rights_approvals later
        where later.version_id = approved.version_id
          and later.reviewed_at > approved.reviewed_at
          and later.decision in ('rejected', 'revoked')
      )
  );
$$;
