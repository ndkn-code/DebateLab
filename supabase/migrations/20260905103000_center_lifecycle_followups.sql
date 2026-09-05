begin;
create unique index center_pending_resource_sync on public.center_events(subject_id) where kind='resource.sync_requested' and status in ('pending','processing');


create function private.center_revoke_disconnected_materials() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if new.state='revoked' and old.state is distinct from new.state and new.kind='drive_file' then
  update public.lms_materials m set status='archived',archived_at=now(),updated_at=now() from public.center_drive_sources s where s.binding_id=new.id and s.club_id=new.club_id and m.id=s.material_id and m.club_id=new.club_id;
  update public.center_drive_sources set status='revoked',last_sync_at=now() where binding_id=new.id and club_id=new.club_id;
 end if;
 return new;
end $$;
create trigger center_revoke_materials after update of state on public.center_resource_bindings for each row execute function private.center_revoke_disconnected_materials();

-- Domain events create recipient-specific outbox work. Sending remains disabled until
-- the center approves a template and the recipient has verified, recorded consent.
create function private.center_trial_notification() returns trigger language plpgsql security definer set search_path=public,private as $$
declare tr public.center_trials;
begin
 if new.kind='trial.booked' then
  select * into tr from public.center_trials where id=new.subject_id and club_id=new.club_id;
  if found then insert into public.center_events(club_id,command_id,kind,subject_id,payload,expires_at) values(new.club_id,new.command_id,'message.requested',tr.student_record_id,jsonb_build_object('input',jsonb_build_object('templateKey','trial_confirmation','trialId',tr.id,'studentRecordId',tr.student_record_id,'classId',tr.class_id,'startsAt',tr.starts_at,'endsAt',tr.ends_at)),tr.starts_at); end if;
 end if;
 return new;
end $$;
create trigger center_trial_notification after insert on public.center_events for each row when(new.kind='trial.booked') execute function private.center_trial_notification();

create function private.center_schedule_notification() returns trigger language plpgsql security definer set search_path=public,private as $$
declare s record; club uuid;
begin
 if (new.start_date,new.start_time,new.end_time,new.status) is not distinct from (old.start_date,old.start_time,old.end_time,old.status) then return new; end if;
 -- Migration of original native schedules is a representation change, not a class cancellation.
 if new.metadata->>'migratedToGoogle'='true' then return new; end if;
 select club_id into club from public.classes where id=new.class_id;
 for s in select student_record_id from public.student_record_enrollments where class_id=new.class_id and status='active' loop
  insert into public.center_events(club_id,kind,subject_id,payload,expires_at) values(club,'message.requested',s.student_record_id,jsonb_build_object('input',jsonb_build_object('templateKey','class_rescheduled','studentRecordId',s.student_record_id,'classId',new.class_id,'startsAt',(new.start_date+new.start_time) at time zone new.timezone,'endsAt',(new.start_date+new.end_time) at time zone new.timezone,'scheduleStatus',new.status)),now()+interval '24 hours');
 end loop;
 return new;
end $$;
create trigger center_schedule_notification after update on public.class_schedules for each row execute function private.center_schedule_notification();

-- Bounded, teacher-scoped retrieval of approved learning materials. Pending Drive
-- imports and revoked sources never enter model context.
create function public.center_teacher_materials(p_club_id uuid,p_query text) returns jsonb language plpgsql security definer set search_path=public,private as $$
begin
 if not coalesce(private.center_can_work(p_club_id,auth.uid()),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id','material:'||m.id,'label',m.title,'text',left(v.native_document::text,6000))) from (
   select mat.* from public.lms_materials mat where mat.club_id=p_club_id and mat.status='published' and mat.rights_approved_at is not null and mat.rights_basis<>'unknown'
   and (private.organization_can_admin(p_club_id,auth.uid()) or private.organization_can_manage_class(mat.scope_class_id,auth.uid()))
   and not exists(select 1 from public.center_drive_sources ds join public.center_resource_bindings b on b.id=ds.binding_id join public.center_connections c on c.id=b.connection_id where ds.material_id=mat.id and (ds.status<>'active' or b.state<>'active' or c.status<>'connected'))
   order by case when mat.title ilike '%'||left(coalesce(p_query,''),100)||'%' then 0 else 1 end,mat.updated_at desc limit 8
 )m join lateral(select native_document,processing_status,content_review_status from public.lms_material_versions where material_id=m.id order by version_number desc limit 1)v on v.processing_status='ready' and v.content_review_status='approved'),'[]'::jsonb);
end $$;
revoke all on function public.center_teacher_materials(uuid,text) from public,anon;
grant execute on function public.center_teacher_materials(uuid,text) to authenticated;

-- Persist family preference identity separately from staff-only notes/CRM data.
alter function public.center_guardian_progress(uuid) rename to center_guardian_base_progress;
revoke all on function public.center_guardian_base_progress(uuid) from public,anon,authenticated;
create function public.center_guardian_progress(p_student_record_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare result jsonb; link public.center_guardian_students;
begin
 result:=public.center_guardian_base_progress(p_student_record_id);
 select gs.* into link from public.center_guardian_students gs join public.center_guardians g on g.id=gs.guardian_id where gs.student_record_id=p_student_record_id and g.user_id=auth.uid() and gs.verified_at is not null and gs.revoked_at is null limit 1;
 return result||jsonb_build_object('guardianId',link.guardian_id,'studentRecordId',p_student_record_id,'preferences',link.preferences);
end $$;
revoke all on function public.center_guardian_progress(uuid) from public,anon;
grant execute on function public.center_guardian_progress(uuid) to authenticated;
create function public.center_finish_sheet_import(p_staging_id uuid,p_batch_id uuid) returns void language plpgsql security definer set search_path=public,private as $$
declare stage public.center_sheet_staging;
begin
 select * into stage from public.center_sheet_staging where id=p_staging_id and private.organization_can_manage_people(club_id,auth.uid()) for update;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.roster_import_batches where id=p_batch_id and club_id=stage.club_id and created_by=auth.uid() and source_filename='google:'||stage.id and report<>'{}'::jsonb) then raise exception 'Completed import required'; end if;
 update public.center_sheet_staging set status='applied' where id=stage.id;
end $$;
revoke all on function public.center_finish_sheet_import(uuid,uuid) from public,anon;
grant execute on function public.center_finish_sheet_import(uuid,uuid) to authenticated;
revoke all on function private.center_google_binding(uuid,uuid),private.center_guard_calendar_authority(),private.center_revoke_disconnected_materials(),private.center_trial_notification(),private.center_schedule_notification() from public,anon,authenticated;
commit;
