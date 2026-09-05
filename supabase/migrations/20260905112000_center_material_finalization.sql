-- Google downloads enter the existing LMS worker only after immutable original storage.
begin;

create or replace function public.center_queue_google_material(p_binding_id uuid,p_actor_id uuid,p_file_id text,p_version text,p_metadata jsonb,p_storage_path text,p_size_bytes bigint) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare b public.center_resource_bindings; m uuid; v uuid; version_number_value integer; source public.center_drive_sources; key_value text; existing public.center_drive_sources;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Forbidden'; end if;
 b:=private.center_google_binding(p_binding_id,p_actor_id);
 if p_metadata->>'storageBucket' is distinct from 'lms-material-originals'
    or p_metadata->>'mimeType' is null
    or split_part(p_storage_path,'/',1) is distinct from b.club_id::text
    or p_size_bytes <= 0 or p_size_bytes > 20971520 then
  raise exception 'Google material must be validated and finalized before queueing';
 end if;
 if b.kind <> 'drive_file' or b.class_id is null then raise exception 'Drive material requires a class binding'; end if;
 select * into existing from public.center_drive_sources where binding_id=b.id and content_hash=p_version and status='active';
 if found then return jsonb_build_object('materialId',existing.material_id,'versionId',existing.version_id,'replayed',true); end if;
 m:=(split_part(p_storage_path,'/',2))::uuid; v:=(split_part(p_storage_path,'/',3))::uuid;
 select * into source from public.center_drive_sources where binding_id=b.id for update;
 if source.material_id is not null and source.material_id<>m then raise exception 'Drive material identity must remain stable'; end if;
 select coalesce(max(version_number),0)+1 into version_number_value from public.lms_material_versions where material_id=m;
 key_value:='google:'||b.id||':'||p_version||':'||coalesce(p_metadata->>'version','');
 insert into public.lms_materials(id,club_id,scope_class_id,program_type,title,material_kind,status,rights_basis,created_by) values(m,b.club_id,b.class_id,'debate',coalesce(p_metadata->>'name','Google material'),'file','draft','unknown',p_actor_id) on conflict(id) do nothing;
 insert into public.lms_material_versions(id,material_id,version_number,idempotency_key,processing_status,original_bucket,original_path,source_file_name,source_mime_type,detected_mime_type,size_bytes,sha256,created_by) values(v,m,version_number_value,key_value,'queued','lms-material-originals',p_storage_path,p_metadata->>'name',p_metadata->>'mimeType',p_metadata->>'mimeType',p_size_bytes,p_version,p_actor_id) on conflict(idempotency_key) do update set updated_at=now();
 update public.lms_materials set status='draft',updated_at=now() where id=m;
 insert into public.center_drive_sources(binding_id,club_id,material_id,version_id,content_hash,last_sync_at,status) values(b.id,b.club_id,m,v,p_version,now(),'active') on conflict(binding_id) do update set material_id=excluded.material_id,version_id=excluded.version_id,content_hash=excluded.content_hash,last_sync_at=now(),status='active';
 insert into public.center_events(club_id,kind,subject_id,payload) values(b.club_id,'material.processing_requested',v,jsonb_build_object('materialId',m,'versionId',v,'idempotencyKey',key_value));
 return jsonb_build_object('materialId',m,'versionId',v);
end $$;

commit;
