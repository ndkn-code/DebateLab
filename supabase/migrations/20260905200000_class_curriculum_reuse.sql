-- Lumist behavior provenance: features/classroom-management/services/server/
-- classroom-module-clone-server.service.ts (calendar shifts, draft copies, idempotency)
-- and classroom-create-server.service.ts (source boundary, atomic completeness).
-- Class curriculum reuse. Adapted from the audited organization class/course/material
-- transactions in 20260902160000_lms_live_operations.sql and the shared LMS release
-- gates in 20260830051000_shared_lms_material_release_gates.sql.
begin;

create or replace function private.class_curriculum_reuse_shift_timestamp(
  p_value timestamptz, p_old_start date, p_new_start date, p_timezone text
) returns timestamptz language plpgsql immutable security definer
set search_path = public, private, extensions as $$
declare v_local timestamp; v_shifted timestamp; v_result timestamptz;
begin
  if p_value is null then return null; end if;
  v_local := p_value at time zone p_timezone;
  v_shifted := v_local + (p_new_start - p_old_start)::integer * interval '1 day';
  v_result := v_shifted at time zone p_timezone;
  if v_result at time zone p_timezone <> v_shifted then raise exception 'REUSE_DST_GAP'; end if;
  return v_result;
end; $$;

create or replace function private.class_curriculum_reuse_preview(
  p_source_class_id uuid, p_dates jsonb default null
) returns jsonb language plpgsql security definer
set search_path = public, private, extensions as $$
declare
  uid uuid := auth.uid(); src public.classes%rowtype; v_dates jsonb := coalesce(p_dates, '{}'::jsonb);
  v_mode text := coalesce(v_dates->>'dateMode','clear'); v_tz text := v_dates->>'timezone';
  v_new_start date := nullif(v_dates->>'startDate','')::date; v_new_end date := nullif(v_dates->>'endDate','')::date;
  v_day integer; v_source jsonb; v_courses jsonb; v_materials jsonb; v_assignments jsonb; v_revision jsonb;
  v_course_ids uuid[]; v_material_ids uuid[]; v_assignment_ids uuid[];
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  select * into src from public.classes c where c.id=p_source_class_id
    and c.club_id is not null and c.status <> 'archived'
    and private.organization_can_academic_admin(c.club_id,uid)
    and private.organization_can_manage_class(c.id,uid)
    and (c.program_type <> 'ielts' or private.organization_is_admin(uid));
  if not found then raise exception 'FORBIDDEN'; end if;
  if v_mode not in ('clear','shift') then raise exception 'REUSE_INVALID_DATES'; end if;
  if jsonb_typeof(v_dates->'courseIds')='array' and (select count(*) from jsonb_array_elements_text(v_dates->'courseIds')) <> (select count(distinct x) from jsonb_array_elements_text(v_dates->'courseIds') x) then raise exception 'REUSE_INVALID_INPUT'; end if;
  if jsonb_typeof(v_dates->'materialPlacementIds')='array' and (select count(*) from jsonb_array_elements_text(v_dates->'materialPlacementIds')) <> (select count(distinct x) from jsonb_array_elements_text(v_dates->'materialPlacementIds') x) then raise exception 'REUSE_INVALID_INPUT'; end if;
  if jsonb_typeof(v_dates->'assignmentIds')='array' and (select count(*) from jsonb_array_elements_text(v_dates->'assignmentIds')) <> (select count(distinct x) from jsonb_array_elements_text(v_dates->'assignmentIds') x) then raise exception 'REUSE_INVALID_INPUT'; end if;
  if v_dates ? 'startDate' and (v_dates->>'startDate') is not null and v_new_start is null then raise exception 'REUSE_INVALID_DATES'; end if;
  if v_dates ? 'endDate' and (v_dates->>'endDate') is not null and v_new_end is null then raise exception 'REUSE_INVALID_DATES'; end if;
  if v_new_start is not null and v_new_end is not null and v_new_end < v_new_start then raise exception 'REUSE_INVALID_DATES'; end if;
  if v_mode='shift' and (src.start_date is null or v_new_start is null) then raise exception 'REUSE_INVALID_DATES'; end if;
  if v_mode='shift' and v_tz is null then raise exception 'REUSE_INVALID_TIMEZONE'; end if;
  if v_tz is not null and not exists (select 1 from pg_timezone_names where name=v_tz) then raise exception 'REUSE_INVALID_TIMEZONE'; end if;
  if v_mode='shift' then v_day := v_new_start-src.start_date; else v_day := null; end if;

  if jsonb_typeof(v_dates->'courseIds')='array' then select array_agg(x::uuid) into v_course_ids from jsonb_array_elements_text(v_dates->'courseIds') x; end if;
  if jsonb_typeof(v_dates->'materialPlacementIds')='array' then select coalesce(array_agg(x::uuid),'{}'::uuid[]) into v_material_ids from jsonb_array_elements_text(v_dates->'materialPlacementIds') x; end if;
  if jsonb_typeof(v_dates->'assignmentIds')='array' then select coalesce(array_agg(x::uuid),'{}'::uuid[]) into v_assignment_ids from jsonb_array_elements_text(v_dates->'assignmentIds') x; end if;

  v_source := jsonb_build_object('id',src.id,'actorId',uid,'title',src.title,'clubId',src.club_id,
    'clubName',(select c.name from public.clubs c where c.id=src.club_id),'programType',src.program_type,
    'startDate',src.start_date,'endDate',src.end_date);
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'eligible',x.ok,'reason',x.reason,
    'modules',x.modules) order by x.title,x.id),'[]'::jsonb) into v_courses
  from (select c.id,case when private.can_read_curriculum_course(c.id,uid) and (c.club_id is null or c.club_id=src.club_id) then c.title else '' end title,
    (not c.is_archived and (c.club_id is null or c.club_id=src.club_id) and (c.club_id is null and c.is_published or c.club_id is not null)
      and c.subject=src.program_type and private.can_read_curriculum_course(c.id,uid)) as ok,
    case when c.is_archived then 'unavailable' when c.subject is distinct from src.program_type then 'program'
      when c.club_id is not null and c.club_id is distinct from src.club_id then 'unavailable'
      when c.club_id is null and not c.is_published then 'unavailable' when not private.can_read_curriculum_course(c.id,uid) then 'unavailable' else null end reason,
    (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'lessonCount',(select count(*) from public.lessons l where l.module_id=m.id and l.is_published)) order by m.sort_order,m.id),'[]'::jsonb) from public.course_modules m where m.course_id=c.id and private.can_read_curriculum_course(c.id,uid) and (c.club_id is null or c.club_id=src.club_id)) modules
    from public.class_course_assignments ca join public.courses c on c.id=ca.course_id where ca.class_id=src.id) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',m.title,'eligible',x.ok,'reason',x.reason,'releaseAt',p.release_at,'expiresAt',p.expires_at) order by p.id),'[]'::jsonb) into v_materials
  from (select p.id,p.release_at,p.expires_at,m.title,
    (m.scope_class_id is null and m.club_id=src.club_id and p.club_id=src.club_id and v.material_id=m.id and m.program_type=src.program_type and m.status<>'archived' and p.status<>'withdrawn' and p.target_type='class' and p.audience_mode='all' and p.source_assignment_id is null and not exists(select 1 from public.lms_material_unlock_rules u where u.placement_id=p.id) and not exists(select 1 from public.lms_material_audiences au where au.placement_id=p.id)
      and v.processing_status='ready' and v.content_review_status='approved' and private.lms_material_version_rights_approved(v.id)) ok,
    case when m.scope_class_id is not null then 'class_scoped' when m.club_id is distinct from src.club_id or m.status='archived' then 'unavailable'
      when m.program_type is distinct from src.program_type then 'program' when p.audience_mode<>'all' or exists(select 1 from public.lms_material_unlock_rules u where u.placement_id=p.id) or exists(select 1 from public.lms_material_audiences au where au.placement_id=p.id) then 'selected_audience'
      when not private.lms_material_version_rights_approved(v.id) then 'rights' when v.processing_status<>'ready' or v.content_review_status<>'approved' then 'not_ready'
      when p.status='withdrawn' or p.target_type<>'class' or p.source_assignment_id is not null then 'unavailable' else null end reason
    from public.lms_material_placements p join public.lms_materials m on m.id=p.material_id join public.lms_material_versions v on v.id=p.version_id where p.class_id=src.id) x
    join public.lms_material_placements p on p.id=x.id join public.lms_materials m on m.id=p.material_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'eligible',x.ok,'reason',x.reason,'dueAt',a.due_at) order by a.due_at nulls last,a.id),'[]'::jsonb) into v_assignments
  from (select a.*,
    (a.status<>'archived' and a.assignment_type in ('practice','case','speech','quiz') and a.ielts_test_id is null and coalesce(a.metadata,'{}'::jsonb)='{}'::jsonb
      and not exists(select 1 from public.lms_material_placements p where p.assignment_id=a.id or p.source_assignment_id=a.id)
      and not exists(select 1 from public.lms_occurrence_assignments oa where oa.assignment_id=a.id)) ok,
    case when a.status='archived' then 'unavailable' when a.assignment_type not in ('practice','case','speech','quiz') or a.ielts_test_id is not null then 'unavailable'
      when coalesce(a.metadata,'{}'::jsonb)<>'{}'::jsonb or exists(select 1 from public.lms_material_placements p where p.assignment_id=a.id or p.source_assignment_id=a.id) or exists(select 1 from public.lms_occurrence_assignments oa where oa.assignment_id=a.id) then 'linked_assignment' else null end reason
    from public.club_assignments a where a.class_id=src.id and a.club_id=src.club_id) x join public.club_assignments a on a.id=x.id;
  if v_mode='shift' and exists (select 1 from public.club_assignments a where a.class_id=src.id and (v_assignment_ids is null or a.id=any(v_assignment_ids)) and a.due_at is not null and exists(select 1 from jsonb_array_elements(v_assignments) q where (q->>'id')::uuid=a.id and (q->>'eligible')::boolean) and ((private.class_curriculum_reuse_shift_timestamp(a.due_at,src.start_date,v_new_start,v_tz) at time zone v_tz)::date < v_new_start or (private.class_curriculum_reuse_shift_timestamp(a.due_at,src.start_date,v_new_start,v_tz) at time zone v_tz)::date > v_new_end)) then raise exception 'REUSE_DATE_OUTSIDE_CLASS'; end if;
  if v_mode='shift' and exists (select 1 from public.lms_material_placements p where p.class_id=src.id and (v_material_ids is null or p.id=any(v_material_ids)) and exists(select 1 from jsonb_array_elements(v_materials) q where (q->>'id')::uuid=p.id and (q->>'eligible')::boolean) and ((p.release_at is not null and ((private.class_curriculum_reuse_shift_timestamp(p.release_at,src.start_date,v_new_start,v_tz) at time zone v_tz)::date < v_new_start or (private.class_curriculum_reuse_shift_timestamp(p.release_at,src.start_date,v_new_start,v_tz) at time zone v_tz)::date > v_new_end)) or (p.expires_at is not null and ((private.class_curriculum_reuse_shift_timestamp(p.expires_at,src.start_date,v_new_start,v_tz) at time zone v_tz)::date < v_new_start or (private.class_curriculum_reuse_shift_timestamp(p.expires_at,src.start_date,v_new_start,v_tz) at time zone v_tz)::date > v_new_end)))) then raise exception 'REUSE_DATE_OUTSIDE_CLASS'; end if;

  v_revision := jsonb_build_object('source',to_jsonb(src),'coursePreview',v_courses,'materialPreview',v_materials,'assignmentPreview',v_assignments,'courses',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('updatedAt',c.updated_at) order by c.id),'[]'::jsonb) from public.class_course_assignments ca join public.courses c on c.id=ca.course_id where ca.class_id=src.id),
    'materials',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('materialUpdatedAt',m.updated_at,'versionUpdatedAt',v.updated_at,'rightsApproved',private.lms_material_version_rights_approved(v.id)) order by p.id),'[]'::jsonb) from public.lms_material_placements p join public.lms_materials m on m.id=p.material_id join public.lms_material_versions v on v.id=p.version_id where p.class_id=src.id),
    'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.club_assignments a where a.class_id=src.id));
  return jsonb_build_object('source',v_source,'courses',v_courses,'materials',v_materials,'assignments',v_assignments,
    'legacyResourceCount',(select count(*) from public.lms_resources r where r.scope_class_id=src.id or exists(select 1 from public.lms_resource_assignments ra where ra.resource_id=r.id and ra.class_id=src.id)),
    'fingerprint',encode(digest(v_revision::text,'sha256'),'hex'),
    'datePreview',case when p_dates is null then null else jsonb_build_object('dayOffset',v_day,
      'assignments',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'dueAt',case when v_mode='shift' then private.class_curriculum_reuse_shift_timestamp(a.due_at,src.start_date,v_new_start,v_tz) else null end)),'[]'::jsonb) from public.club_assignments a where a.class_id=src.id and (v_assignment_ids is null or a.id=any(v_assignment_ids)) and exists(select 1 from jsonb_array_elements(v_assignments) q where (q->>'id')::uuid=a.id and (q->>'eligible')::boolean)),
      'materials',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'releaseAt',case when v_mode='shift' then private.class_curriculum_reuse_shift_timestamp(p.release_at,src.start_date,v_new_start,v_tz) else null end,'expiresAt',case when v_mode='shift' then private.class_curriculum_reuse_shift_timestamp(p.expires_at,src.start_date,v_new_start,v_tz) else null end)),'[]'::jsonb) from public.lms_material_placements p where p.class_id=src.id and (v_material_ids is null or p.id=any(v_material_ids)) and exists(select 1 from jsonb_array_elements(v_materials) q where (q->>'id')::uuid=p.id and (q->>'eligible')::boolean))) end);
end; $$;

create or replace function public.list_class_reuse_sources()
returns jsonb language sql security definer set search_path=public,private,extensions as $$
select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'actorId',auth.uid(),'title',c.title,'clubId',c.club_id,'clubName',o.name,'programType',c.program_type,'startDate',c.start_date,'endDate',c.end_date) order by c.title,c.id),'[]'::jsonb)
from public.classes c join public.clubs o on o.id=c.club_id where c.status<>'archived' and private.organization_can_academic_admin(c.club_id,auth.uid()) and private.organization_can_manage_class(c.id,auth.uid()) and (c.program_type <> 'ielts' or private.organization_is_admin(auth.uid())); $$;

create or replace function public.preview_class_curriculum_reuse(p_source_class_id uuid,p_dates jsonb default null)
returns jsonb language sql security definer set search_path=public,private,extensions as $$ select private.class_curriculum_reuse_preview(p_source_class_id,p_dates); $$;

create or replace function public.create_class_curriculum_reuse(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare uid uuid:=auth.uid(); src public.classes%rowtype; v_preview jsonb; v_result jsonb; v_key uuid; v_hash text; v_class uuid; v_code text; v_start date; v_end date; v_mode text:=coalesce(p_input->>'dateMode','clear'); v_tz text:=p_input->>'timezone'; v_course uuid; v_mat uuid; v_asn uuid; v_day integer; v_field text;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or nullif(btrim(p_input->>'sourceClassId'),'') is null or nullif(btrim(p_input->>'previewFingerprint'),'') is null or char_length(coalesce(p_input->>'title',''))>200 then raise exception 'REUSE_INVALID_INPUT'; end if;
  if jsonb_typeof(p_input->'courseIds')<>'array' or jsonb_typeof(p_input->'materialPlacementIds')<>'array' or jsonb_typeof(p_input->'assignmentIds')<>'array' then raise exception 'REUSE_INVALID_INPUT'; end if;
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('sourceClassId','title','startDate','endDate','dateMode','timezone','courseIds','materialPlacementIds','assignmentIds','previewFingerprint','idempotencyKey')) then raise exception 'REUSE_INVALID_INPUT'; end if;
  foreach v_field in array array['courseIds','materialPlacementIds','assignmentIds'] loop
    if jsonb_typeof(p_input->v_field) is distinct from 'array' then raise exception 'REUSE_INVALID_INPUT'; end if;
    if jsonb_array_length(p_input->v_field)>200 or (select count(*) from jsonb_array_elements_text(p_input->v_field))<>(select count(distinct x) from jsonb_array_elements_text(p_input->v_field) x) then raise exception 'REUSE_INVALID_INPUT'; end if;
    if exists(select 1 from jsonb_array_elements(p_input->v_field) x where jsonb_typeof(x)<>'string' or x#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'REUSE_INVALID_INPUT'; end if;
  end loop;
  begin v_key:=(p_input->>'idempotencyKey')::uuid; exception when others then raise exception 'INVALID_IDEMPOTENCY_KEY'; end;
  if v_key is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  -- Re-authorize before consulting the replay receipt; authorization is never cached by idempotency.
  if not exists (select 1 from public.classes c where c.id=(p_input->>'sourceClassId')::uuid and c.status<>'archived' and c.club_id is not null and private.organization_can_academic_admin(c.club_id,uid) and private.organization_can_manage_class(c.id,uid) and (c.program_type <> 'ielts' or private.organization_is_admin(uid))) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('class_curriculum_reuse:'||uid::text||':'||v_key::text,0));
  v_hash:=encode(digest(p_input::text,'sha256'),'hex'); v_result:=private.organization_idempotency_lookup(uid,'create_class_curriculum_reuse',v_key::text,v_hash); if v_result is not null then return v_result; end if;
  select * into src from public.classes where id=(p_input->>'sourceClassId')::uuid and status<>'archived' and club_id is not null and private.organization_can_academic_admin(club_id,uid) and private.organization_can_manage_class(id,uid) and (program_type <> 'ielts' or private.organization_is_admin(uid)) for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  -- Stabilize selected source content and version rights through the copy transaction.
  perform 1 from public.courses c join public.class_course_assignments ca on ca.course_id=c.id where ca.class_id=src.id order by c.id for share of c,ca;
  perform 1 from public.course_modules m join public.class_course_assignments ca on ca.course_id=m.course_id where ca.class_id=src.id order by m.id for share of m;
  perform 1 from public.club_assignments a where a.class_id=src.id order by a.id for share;
  perform 1 from public.lms_material_placements p join public.lms_materials m on m.id=p.material_id join public.lms_material_versions v on v.id=p.version_id where p.class_id=src.id order by p.id for share of p,m,v;
  perform 1 from public.lms_material_rights_approvals r join public.lms_material_placements p on p.version_id=r.version_id where p.class_id=src.id order by r.id for share of r;
  v_preview:=private.class_curriculum_reuse_preview(src.id,null); if v_preview->>'fingerprint' is distinct from p_input->>'previewFingerprint' then raise exception 'REUSE_SOURCE_CHANGED'; end if;
  if v_mode not in ('clear','shift') or (p_input->>'title') is null or nullif(btrim(p_input->>'title'),'') is null then raise exception 'REUSE_INVALID_DATES'; end if;
  if (p_input ? 'startDate' and nullif(p_input->>'startDate','') is not null and p_input->>'startDate' !~ '^\d{4}-\d{2}-\d{2}$') or (p_input ? 'endDate' and nullif(p_input->>'endDate','') is not null and p_input->>'endDate' !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'REUSE_INVALID_DATES'; end if;
  begin v_start:=nullif(p_input->>'startDate','')::date; v_end:=nullif(p_input->>'endDate','')::date; exception when others then raise exception 'REUSE_INVALID_DATES'; end;
  if v_start is not null and v_end is not null and v_end<v_start then raise exception 'REUSE_INVALID_DATES'; end if;
  if v_mode='shift' then if src.start_date is null or v_start is null then raise exception 'REUSE_INVALID_DATES'; end if; v_day:=v_start-src.start_date; end if;
  if v_tz is null or not exists(select 1 from pg_timezone_names where name=v_tz) then raise exception 'REUSE_INVALID_TIMEZONE'; end if;
  -- Run the same server-side date projection (including end-date checks) before any destination write.
  perform private.class_curriculum_reuse_preview(src.id,p_input);
  v_code:='reuse-'||substr(gen_random_uuid()::text,1,12);
  insert into public.classes(club_id,code,title,description,program_type,grade_level,status,start_date,end_date,meeting_schedule,room,max_students,created_by,metadata) values(src.club_id,v_code,btrim(p_input->>'title'),null,src.program_type,src.grade_level,'draft',v_start,v_end,null,null,null,uid,'{}'::jsonb) returning id into v_class;
  for v_course in select x::uuid from jsonb_array_elements_text(coalesce(p_input->'courseIds','[]'::jsonb)) x loop if not exists(select 1 from jsonb_array_elements(v_preview->'courses') q where (q->>'id')::uuid=v_course and (q->>'eligible')::boolean) then raise exception 'REUSE_INELIGIBLE_SELECTION'; end if; insert into public.class_course_assignments(class_id,course_id,assigned_by) values(v_class,v_course,uid); end loop;
  for v_mat in select x::uuid from jsonb_array_elements_text(coalesce(p_input->'materialPlacementIds','[]'::jsonb)) x loop if not exists(select 1 from jsonb_array_elements(v_preview->'materials') q where (q->>'id')::uuid=v_mat and (q->>'eligible')::boolean) then raise exception 'REUSE_INELIGIBLE_SELECTION'; end if; insert into public.lms_material_placements(material_id,version_id,club_id,target_type,class_id,order_index,required,audience_mode,status,release_at,expires_at,created_by) select p.material_id,p.version_id,src.club_id,'class',v_class,p.order_index,p.required,'all','draft',case when v_mode='shift' then private.class_curriculum_reuse_shift_timestamp(p.release_at,src.start_date,v_start,v_tz) else null end,case when v_mode='shift' then private.class_curriculum_reuse_shift_timestamp(p.expires_at,src.start_date,v_start,v_tz) else null end,uid from public.lms_material_placements p where p.id=v_mat; end loop;
  for v_asn in select x::uuid from jsonb_array_elements_text(coalesce(p_input->'assignmentIds','[]'::jsonb)) x loop if not exists(select 1 from jsonb_array_elements(v_preview->'assignments') q where (q->>'id')::uuid=v_asn and (q->>'eligible')::boolean) then raise exception 'REUSE_INELIGIBLE_SELECTION'; end if; insert into public.club_assignments(club_id,class_id,title,description,assignment_type,assigned_track,topic_title,topic_category,due_at,required_attempts,rubric_key,rubric_version,status,created_by,metadata,submission_text_enabled,submission_files_enabled,submission_max_files,submission_max_file_mb,submission_allowed_ext,submission_instructions) select src.club_id,v_class,a.title,a.description,a.assignment_type,a.assigned_track,a.topic_title,a.topic_category,case when v_mode='shift' then private.class_curriculum_reuse_shift_timestamp(a.due_at,src.start_date,v_start,v_tz) else null end,a.required_attempts,a.rubric_key,a.rubric_version,'draft',uid,'{}'::jsonb,a.submission_text_enabled,a.submission_files_enabled,a.submission_max_files,a.submission_max_file_mb,a.submission_allowed_ext,a.submission_instructions from public.club_assignments a where a.id=v_asn; end loop;
  perform private.organization_audit(src.club_id,uid,'class_curriculum_reused','class',v_class,jsonb_build_object('sourceClassId',src.id),v_key::text);
  v_result:=jsonb_build_object('classId',v_class,'sourceClassId',src.id,'organizationId',src.club_id); insert into public.organization_operation_idempotency(actor_id,operation,idempotency_key,request_hash,response_payload,completed_at) values(uid,'create_class_curriculum_reuse',v_key::text,v_hash,v_result,now()); return v_result;
end; $$;

revoke all on function public.list_class_reuse_sources(),public.preview_class_curriculum_reuse(uuid,jsonb),public.create_class_curriculum_reuse(jsonb) from public,anon;
grant execute on function public.list_class_reuse_sources(),public.preview_class_curriculum_reuse(uuid,jsonb),public.create_class_curriculum_reuse(jsonb) to authenticated;
revoke all on function private.class_curriculum_reuse_shift_timestamp(timestamptz,date,date,text),private.class_curriculum_reuse_preview(uuid,jsonb) from public,anon,authenticated;
commit;
