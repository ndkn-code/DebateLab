-- Additive hardening for databases that already applied 20260830050000.
begin;
alter table if exists public.lms_material_versions
  add column if not exists content_review_status text not null default 'pending',
  add column if not exists content_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists content_reviewed_at timestamptz,
  add column if not exists content_review_note text;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lms_material_versions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%content_review_status%'
  ) then
    alter table public.lms_material_versions add constraint lms_material_versions_content_review_status_ck check (content_review_status in ('pending','approved','rejected'));
  end if;
end $$;
alter table if exists public.lms_material_placements add column if not exists source_assignment_id uuid;
do $$ declare source_attnum smallint; begin
  select attnum into source_attnum from pg_attribute where attrelid = 'public.lms_material_placements'::regclass and attname = 'source_assignment_id';
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lms_material_placements'::regclass and contype = 'f'
      and source_attnum = any(conkey)
  ) then
    alter table public.lms_material_placements add constraint lms_material_placements_source_assignment_fk foreign key (source_assignment_id) references public.club_assignments(id) on delete set null;
  end if;
end $$;
do $$ begin
  alter table public.lms_material_audit_events drop constraint if exists lms_material_audit_events_action_check;
  alter table public.lms_material_audit_events add constraint lms_material_audit_events_action_check check (action in ('created','updated','published','withdrawn','archived','deleted','rights_approved','rights_rejected','rights_revoked','content_reviewed','processing_failed'));
exception when undefined_table then null; end $$;

create or replace function public.lms_review_material_content(p_material_id uuid, p_version_id uuid, p_status text, p_note text default null)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid();
begin
  if p_status not in ('approved','rejected') or uid is null or not private.can_manage_lms_material(p_material_id, uid)
    or not exists (select 1 from public.lms_material_versions where id=p_version_id and material_id=p_material_id) then raise exception 'FORBIDDEN'; end if;
  update public.lms_material_versions set content_review_status=p_status, content_reviewer_id=uid, content_reviewed_at=now(), content_review_note=nullif(btrim(p_note),''), updated_at=now() where id=p_version_id;
  insert into public.lms_material_audit_events(material_id, entity_type, entity_id, action, actor_id, reason, after_state) values (p_material_id,'version',p_version_id,'content_reviewed',uid,p_note,jsonb_build_object('content_review_status',p_status));
  return true;
end; $$;

drop function if exists public.load_lms_materials_for_user(uuid, date, date);
create function public.load_lms_materials_for_user(p_class_id uuid, p_from date, p_to date)
returns table(placement_id uuid, material_id uuid, version_id uuid, title text, description text, target_type text, course_id uuid, class_id uuid, occurrence_id uuid, assignment_id uuid, placement_status text, release_at timestamptz, expires_at timestamptz, required boolean, order_index integer, processing_status text, preview_rendition_id uuid, preview_kind text, preview_mime_type text, page_count integer, page_number integer, watermark_learner_label text, watermark_class_label text, native_document jsonb, access_state text, lock_reasons text[])
language sql stable security definer set search_path = public, private as $$
  select p.id, m.id, p.version_id, m.title, m.description, p.target_type, p.course_id, p.class_id, p.occurrence_id, p.assignment_id, p.status,
    p.release_at, p.expires_at, p.required, p.order_index, v.processing_status, preview.id, preview.rendition_kind, preview.mime_type,
    nullif((preview.metadata ->> 'pageCount'), '')::integer, preview.page_number,
    coalesce(nullif(btrim(profile.display_name), ''), 'Learner'), c.title,
    case when v.processing_status = 'ready' and v.content_review_status = 'approved' and private.lms_material_version_rights_approved(v.id)
      and (p.release_at is null or p.release_at <= now()) and (p.expires_at is null or p.expires_at > now())
      and private.lms_material_placement_unlocks_satisfied(p.id, auth.uid()) then v.native_document else null end,
    case when v.processing_status <> 'ready' or preview.id is null then 'processing'
      when v.content_review_status <> 'approved' then 'locked'
      when p.release_at is not null and p.release_at > now() then 'locked'
      when p.expires_at is not null and p.expires_at <= now() then 'locked'
      when not private.lms_material_version_rights_approved(v.id) then 'locked'
      when not private.lms_material_placement_unlocks_satisfied(p.id, auth.uid()) then 'locked' else 'available' end,
    array_remove(array[
      case when v.processing_status <> 'ready' or preview.id is null then 'processing' end,
      case when v.content_review_status <> 'approved' then 'content_not_approved' end,
      case when p.release_at is not null and p.release_at > now() then 'not_released' end,
      case when p.expires_at is not null and p.expires_at <= now() then 'expired' end,
      case when not private.lms_material_version_rights_approved(v.id) then 'rights_not_approved' end,
      case when not private.lms_material_placement_unlocks_satisfied(p.id, auth.uid()) then 'unlock_requirements' end
    ]::text[], null)
  from public.lms_material_placements p
  join public.lms_materials m on m.id = p.material_id
  join public.lms_material_versions v on v.id = p.version_id
  join public.classes c on c.id = p_class_id and c.club_id = m.club_id and c.program_type = m.program_type
  left join public.profiles profile on profile.id = auth.uid()
  left join lateral (select r.* from public.lms_material_renditions r where r.version_id = v.id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready' order by r.sort_order, r.page_number nulls first, r.id limit 1) preview on true
  where p.status = 'published' and m.status = 'published'
    and (p.target_type = 'class' and p.class_id = p_class_id
      or p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id)
      or p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id and o.published_at is not null and o.status <> 'cancelled' and (p_from is null or o.occurrence_date >= p_from) and (p_to is null or o.occurrence_date <= p_to))
      or p.target_type = 'assignment' and exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id))
    and (private.can_manage_lms_material(m.id, auth.uid()) or (exists (select 1 from public.class_memberships cm where cm.class_id = p_class_id and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active')
      and (p.audience_mode = 'all' or exists (select 1 from public.lms_material_audiences a where a.placement_id = p.id and a.class_id = p_class_id and a.user_id = auth.uid() and a.status = 'active'))))
  order by p.release_at nulls first, p.occurrence_id nulls first, p.order_index, p.id;
$$;

drop function if exists public.lms_list_materials_manager(uuid, uuid, text, text, integer);
create function public.lms_list_materials_manager(p_class_id uuid default null, p_course_id uuid default null, p_status text default null, p_cursor text default null, p_limit integer default 50)
returns table(id uuid, version_id uuid, title text, description text, processing_status text, version_number integer, content_review_status text, rights_approved boolean, created_at timestamptz, updated_at timestamptz, native_document jsonb, placements jsonb)
language sql stable security definer set search_path = public, private as $$
  select m.id, v.id, m.title, m.description, v.processing_status, v.version_number, v.content_review_status, private.lms_material_version_rights_approved(v.id), m.created_at, m.updated_at, v.native_document,
    coalesce((select jsonb_agg(to_jsonb(p) order by p.release_at nulls last, p.order_index, p.id) from public.lms_material_placements p where p.material_id = m.id and (p_status is null or p.status = p_status)
      and (p_class_id is null or p.class_id = p_class_id or exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id) or exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id) or exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id))), '[]'::jsonb)
  from public.lms_materials m
  join lateral (select x.* from public.lms_material_versions x where x.material_id = m.id order by x.version_number desc, x.id desc limit 1) v on true
  where (p_cursor is null or (p_cursor ~ '^[-0-9TZ:.+]+\|[0-9a-fA-F-]{36}$' and (m.updated_at, m.id) < (split_part(p_cursor, '|', 1)::timestamptz, split_part(p_cursor, '|', 2)::uuid)))
    and private.can_manage_lms_material(m.id, auth.uid())
    and (p_class_id is null or exists (select 1 from public.lms_material_placements p where p.material_id = m.id and (p.class_id = p_class_id or exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id) or exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id) or exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id))))
    and (p_course_id is null or exists (select 1 from public.lms_material_placements p where p.material_id = m.id and p.course_id = p_course_id))
  order by m.updated_at desc, m.id desc limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function private.can_read_lms_material(p_material_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and exists (
    select 1 from public.lms_materials m
    where m.id = p_material_id and (
      private.can_manage_lms_material(m.id, p_user_id)
      or (m.status = 'published' and exists (
        select 1 from public.lms_material_placements p
        where p.material_id = m.id and p.status = 'published'
          and exists (select 1 from public.lms_material_versions v where v.id = p.version_id and v.material_id = m.id and v.processing_status = 'ready' and v.content_review_status = 'approved' and private.lms_material_version_rights_approved(v.id))
          and (p.release_at is null or p.release_at <= now())
          and (p.expires_at is null or p.expires_at > now())
          and private.lms_material_placement_unlocks_satisfied(p.id, p_user_id)
          and (p.audience_mode = 'all' or exists (select 1 from public.lms_material_audiences a where a.placement_id = p.id and a.user_id = p_user_id and a.status = 'active'))
          and ((p.target_type = 'class' and exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = p.class_id and c.club_id = m.club_id and c.program_type = m.program_type and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active'))
            or (p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id join public.class_memberships cm on cm.class_id = c.id and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active' where cca.course_id = p.course_id and c.club_id = m.club_id and c.program_type = m.program_type))
            or (p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o join public.classes c on c.id = o.class_id join public.class_memberships cm on cm.class_id = o.class_id where o.id = p.occurrence_id and o.club_id = m.club_id and c.program_type = m.program_type and o.published_at is not null and o.status <> 'cancelled' and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active'))
            or (p.target_type = 'assignment' and exists (select 1 from public.club_assignments a join public.classes c on c.id = a.class_id join public.class_memberships cm on cm.class_id = a.class_id where a.id = p.assignment_id and a.club_id = m.club_id and c.program_type = m.program_type and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active')))
      ))
    )
  );
$$;

create or replace function public.can_access_lms_material_preview(p_placement_id uuid, p_version_id uuid, p_rendition_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.lms_material_placements p
    join public.lms_materials m on m.id = p.material_id
    join public.lms_material_versions v on v.id = p.version_id and v.id = p_version_id
    join public.lms_material_renditions r on r.id = p_rendition_id and r.version_id = v.id
    where p.id = p_placement_id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready'
      and v.processing_status = 'ready' and v.content_review_status = 'approved' and private.lms_material_version_rights_approved(v.id)
      and p.status = 'published' and m.status = 'published' and (p.release_at is null or p.release_at <= now()) and (p.expires_at is null or p.expires_at > now())
      and private.lms_material_placement_unlocks_satisfied(p.id, auth.uid())
      and (p.audience_mode = 'all' or exists (select 1 from public.lms_material_audiences a where a.placement_id = p.id and a.user_id = auth.uid() and a.status = 'active'))
      and ((p.target_type = 'class' and exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = p.class_id and c.club_id = m.club_id and c.program_type = m.program_type and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active'))
        or (p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id join public.class_memberships cm on cm.class_id = c.id where cca.course_id = p.course_id and c.club_id = m.club_id and c.program_type = m.program_type and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active'))
        or (p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o join public.classes c on c.id = o.class_id join public.class_memberships cm on cm.class_id = o.class_id where o.id = p.occurrence_id and o.club_id = m.club_id and c.program_type = m.program_type and o.published_at is not null and o.status <> 'cancelled' and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active'))
        or (p.target_type = 'assignment' and exists (select 1 from public.club_assignments a join public.classes c on c.id = a.class_id join public.class_memberships cm on cm.class_id = a.class_id where a.id = p.assignment_id and a.club_id = m.club_id and c.program_type = m.program_type and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active')))
  );
$$;

create or replace function private.enforce_lms_material_publish_rights()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'published' then
    if new.published_at is null then new.published_at := now(); end if;
    if not exists (select 1 from public.lms_material_placements p join public.lms_material_versions v on v.id = p.version_id and v.material_id = new.id where p.material_id = new.id and p.status = 'published' and v.processing_status = 'ready' and v.content_review_status = 'approved' and private.lms_material_version_rights_approved(v.id) and exists (select 1 from public.lms_material_renditions r where r.version_id = v.id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready')) then raise exception 'LMS_MATERIAL_PUBLISH_REQUIREMENTS_NOT_MET'; end if;
  end if;
  return new;
end; $$;

create or replace function public.lms_publish_material(p_material_id uuid, p_placement_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from public.lms_materials where id = p_material_id) or not private.can_manage_lms_material_placement(p_placement_id, uid) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.lms_material_placements p join public.lms_material_versions v on v.id = p.version_id where p.id = p_placement_id and p.material_id = p_material_id and v.processing_status = 'ready' and v.content_review_status = 'approved' and private.lms_material_version_rights_approved(v.id) and exists (select 1 from public.lms_material_renditions r where r.version_id = v.id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready')) then raise exception 'LMS_MATERIAL_NOT_READY'; end if;
  update public.lms_material_placements set status = 'published', updated_at = now() where id = p_placement_id and material_id = p_material_id;
  update public.lms_materials set status = 'published', published_at = coalesce(published_at, now()), updated_by = uid, updated_at = now() where id = p_material_id;
  return true;
end; $$;

-- The canonical 50000 definitions are replaced on fresh installs; these guards
-- keep already-migrated databases safe when this additive migration is replayed.
revoke all on function public.lms_review_material_content(uuid,uuid,text,text) from public, anon;
grant execute on function public.lms_review_material_content(uuid,uuid,text,text) to authenticated;
revoke all on function public.load_lms_materials_for_user(uuid,date,date) from public, anon;
grant execute on function public.load_lms_materials_for_user(uuid,date,date) to authenticated;
revoke all on function public.lms_list_materials_manager(uuid,uuid,text,text,integer) from public, anon;
grant execute on function public.lms_list_materials_manager(uuid,uuid,text,text,integer) to authenticated;
revoke all on function public.can_access_lms_material_preview(uuid,uuid,uuid) from public, anon;
grant execute on function public.can_access_lms_material_preview(uuid,uuid,uuid) to authenticated;
revoke all on function public.lms_publish_material(uuid,uuid) from public, anon;
grant execute on function public.lms_publish_material(uuid,uuid) to authenticated;
commit;
