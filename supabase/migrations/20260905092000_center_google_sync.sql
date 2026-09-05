begin;

create table public.center_calendar_items (
  binding_id uuid not null references public.center_resource_bindings(id) on delete cascade,
  event_id text not null, club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  schedule_id uuid references public.class_schedules(id) on delete set null,
  trial_id uuid references public.center_trials(id) on delete set null,
  etag text, title text not null default '', starts_at timestamptz, ends_at timestamptz,
  status text not null default 'confirmed', raw jsonb not null default '{}',
  primary key (binding_id, event_id)
);
create table private.center_calendar_staging (
  binding_id uuid not null references public.center_resource_bindings(id) on delete cascade,
  event_id text not null, raw jsonb not null, primary key(binding_id,event_id)
);
create table public.center_sheet_staging (
  id uuid primary key default gen_random_uuid(), binding_id uuid not null references public.center_resource_bindings(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade, content_hash text not null, rows jsonb not null,
  status text not null default 'pending' check(status in ('pending','applied','dismissed')), created_at timestamptz not null default now(),
  unique(binding_id, content_hash)
);
create table public.center_drive_sources (
  binding_id uuid primary key references public.center_resource_bindings(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade, material_id uuid references public.lms_materials(id) on delete set null,
  version_id uuid references public.lms_material_versions(id) on delete set null, content_hash text, last_sync_at timestamptz, status text not null default 'active'
);
create unique index center_google_one_active_calendar_class on public.center_resource_bindings(club_id,class_id) where kind='calendar' and state='active' and class_id is not null;

alter table public.center_calendar_items enable row level security;
alter table private.center_calendar_staging enable row level security;
alter table public.center_sheet_staging enable row level security;
alter table public.center_drive_sources enable row level security;
revoke all on public.center_calendar_items, public.center_sheet_staging, public.center_drive_sources from anon, authenticated;
revoke all on private.center_calendar_staging from public, anon, authenticated;
grant all on public.center_calendar_items,public.center_sheet_staging,public.center_drive_sources,private.center_calendar_staging to service_role;
grant select on public.center_calendar_items to authenticated;
grant select on public.center_sheet_staging to authenticated;
create policy center_drive_sources_service on public.center_drive_sources for all to service_role using(true) with check(true);
create policy center_calendar_items_read on public.center_calendar_items for select to authenticated using (private.organization_can_admin(club_id, auth.uid()) or (class_id is not null and private.organization_can_manage_class(class_id, auth.uid())));
create policy center_sheet_staging_admin_read on public.center_sheet_staging for select to authenticated using (private.organization_can_admin(club_id, auth.uid()));

create or replace function private.center_google_binding(p_binding_id uuid, p_actor_id uuid)
returns public.center_resource_bindings language plpgsql security definer set search_path=public,private as $$
declare b public.center_resource_bindings;
begin
 select b0.* into b from public.center_resource_bindings b0 join public.center_connections c on c.id=b0.connection_id and c.provider='google' and c.status='connected' where b0.id=p_binding_id and private.organization_can_admin(b0.club_id,p_actor_id) for update;
 if not found then raise exception 'Google binding unavailable' using errcode='42501'; end if;
 return b;
end $$;

create or replace function public.center_google_connection_context(p_club_id uuid,p_actor_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
begin
 if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' or not coalesce(private.organization_can_admin(p_club_id,p_actor_id),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 return jsonb_build_object('connection',(select to_jsonb(c)-'settings' from public.center_connections c where c.club_id=p_club_id and c.provider='google'),'bindings',coalesce((select jsonb_agg(to_jsonb(b)) from public.center_resource_bindings b where b.club_id=p_club_id),'[]'::jsonb));
end $$;
revoke all on function public.center_google_connection_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.center_google_connection_context(uuid,uuid) to service_role;

create or replace function public.center_bind_google_resource(p_club_id uuid,p_actor_id uuid,p_kind text,p_external_id text,p_label text,p_class_id uuid default null,p_metadata jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare connection_id uuid; result public.center_resource_bindings;
begin
 if not private.organization_can_admin(p_club_id,p_actor_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select id into connection_id from public.center_connections where club_id=p_club_id and provider='google' and status='connected';
 if connection_id is null or p_kind not in ('calendar','sheet','drive_file') or length(btrim(coalesce(p_external_id,'')))=0 or length(btrim(coalesce(p_label,'')))=0 then raise exception 'Google connection or resource is invalid'; end if;
 if p_class_id is not null and not exists(select 1 from public.classes where id=p_class_id and club_id=p_club_id) then raise exception 'Class is outside organization'; end if;
 if p_kind='sheet' and (p_metadata->>'range' is null or length(p_metadata->>'range') > 200 or p_metadata->>'range' ~ '[\r\n]') then raise exception 'Sheet range is invalid'; end if;
 if p_kind='calendar' and p_class_id is not null and exists(select 1 from public.center_resource_bindings where club_id=p_club_id and kind='calendar' and class_id=p_class_id and state='active') then raise exception 'Class already has a calendar'; end if;
 insert into public.center_resource_bindings(club_id,connection_id,kind,external_id,label,class_id,metadata) values(p_club_id,connection_id,p_kind,p_external_id,p_label,p_class_id,coalesce(p_metadata,'{}')) returning * into result;
 if not exists(select 1 from public.center_events where club_id=p_club_id and kind='resource.sync_requested' and subject_id=result.id and status in ('pending','processing')) then insert into public.center_events(club_id,kind,subject_id,payload) values(p_club_id,'resource.sync_requested',result.id,jsonb_build_object('bindingId',result.id)); end if;
 return to_jsonb(result);
end $$;
revoke all on function public.center_bind_google_resource(uuid,uuid,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.center_bind_google_resource(uuid,uuid,text,text,text,uuid,jsonb) to service_role;

create or replace function public.center_google_projection(p_binding_id uuid,p_actor_id uuid,p_items jsonb,p_mode text,p_cursor text default null) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare b public.center_resource_bindings; item jsonb;
begin
 if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 b:=private.center_google_binding(p_binding_id,p_actor_id);
 if p_mode='reset' then update public.center_resource_bindings set cursor=null where id=b.id;
 elsif p_mode='begin_full' then delete from private.center_calendar_staging where binding_id=b.id;
 elsif p_mode='stage' then for item in select * from jsonb_array_elements(coalesce(p_items,'[]')) loop insert into private.center_calendar_staging values(b.id,item->>'id',item) on conflict do update set raw=excluded.raw; end loop;
 elsif p_mode='complete_full' then delete from public.center_calendar_items where binding_id=b.id; insert into public.center_calendar_items(binding_id,event_id,club_id,class_id,etag,title,starts_at,ends_at,status,raw) select b.id,event_id,b.club_id,b.class_id,raw->>'etag',coalesce(raw->>'summary',''),(raw#>>'{start,dateTime}')::timestamptz,(raw#>>'{end,dateTime}')::timestamptz,coalesce(raw->>'status','confirmed'),raw from private.center_calendar_staging where binding_id=b.id; delete from private.center_calendar_staging where binding_id=b.id; update public.center_resource_bindings set cursor=p_cursor,last_sync_at=now() where id=b.id;
 elsif p_mode='abort_full' then delete from private.center_calendar_staging where binding_id=b.id;
 elsif p_mode='incremental' then for item in select * from jsonb_array_elements(coalesce(p_items,'[]')) loop insert into public.center_calendar_items(binding_id,event_id,club_id,class_id,etag,title,starts_at,ends_at,status,raw) values(b.id,item->>'id',b.club_id,b.class_id,item->>'etag',coalesce(item->>'summary',''),(item#>>'{start,dateTime}')::timestamptz,(item#>>'{end,dateTime}')::timestamptz,coalesce(item->>'status','confirmed'),item) on conflict(binding_id,event_id) do update set raw=excluded.raw,etag=excluded.etag,title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status; end loop;
 elsif p_mode='cursor' then update public.center_resource_bindings set cursor=p_cursor,last_sync_at=now() where id=b.id;
 else raise exception 'Unsupported projection mode'; end if;
 return jsonb_build_object('bindingId',b.id,'mode',p_mode,'cursor',p_cursor);
end $$;
revoke all on function public.center_google_projection(uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.center_google_projection(uuid,uuid,jsonb,text,text) to service_role;

create or replace function public.center_queue_google_material(p_binding_id uuid,p_actor_id uuid,p_file_id text,p_version text,p_metadata jsonb,p_storage_path text,p_size_bytes bigint) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare b public.center_resource_bindings; m uuid; v uuid; version_number_value integer; source public.center_drive_sources; key_value text; existing public.center_drive_sources;
begin
 if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' then raise exception 'Forbidden'; end if;
 b:=private.center_google_binding(p_binding_id,p_actor_id);
 if b.kind <> 'drive_file' or b.class_id is null then raise exception 'Drive material requires a class binding'; end if;
 select * into existing from public.center_drive_sources where binding_id=b.id and content_hash=p_version and status='active';
 if found then return jsonb_build_object('materialId',existing.material_id,'versionId',existing.version_id,'replayed',true); end if;
 m:=(split_part(p_storage_path,'/',2))::uuid; v:=(split_part(p_storage_path,'/',3))::uuid;
 select * into source from public.center_drive_sources where binding_id=b.id for update;
 if source.material_id is not null and source.material_id<>m then raise exception 'Drive material identity must remain stable'; end if;
 select coalesce(max(version_number),0)+1 into version_number_value from public.lms_material_versions where material_id=m;
 key_value:='google:'||b.id||':'||p_version||':'||coalesce(p_metadata->>'version','');
 insert into public.lms_materials(id,club_id,scope_class_id,program_type,title,material_kind,status,rights_basis,created_by) values(m,b.club_id,b.class_id,'debate',coalesce(p_metadata->>'name','Google material'),'file','draft','unknown',p_actor_id) on conflict(id) do nothing;
 insert into public.lms_material_versions(id,material_id,version_number,idempotency_key,processing_status,ingest_bucket,ingest_path,source_file_name,source_mime_type,size_bytes,sha256,created_by) values(v,m,version_number_value,key_value,'queued','lms-material-ingest',p_storage_path,p_metadata->>'name',p_metadata->>'mimeType',p_size_bytes,p_version,p_actor_id) on conflict(idempotency_key) do update set updated_at=now();
 update public.lms_materials set status='draft',updated_at=now() where id=m;
 insert into public.center_drive_sources(binding_id,club_id,material_id,version_id,content_hash,last_sync_at,status) values(b.id,b.club_id,m,v,p_version,now(),'active') on conflict(binding_id) do update set material_id=excluded.material_id,version_id=excluded.version_id,content_hash=excluded.content_hash,last_sync_at=now(),status='active';
 insert into public.center_events(club_id,kind,subject_id,payload) values(b.club_id,'material.processing_requested',v,jsonb_build_object('materialId',m,'versionId',v,'idempotencyKey',key_value));
 return jsonb_build_object('materialId',m,'versionId',v);
end $$;
create or replace function public.center_revoke_google_material(p_binding_id uuid,p_actor_id uuid) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' then raise exception 'Forbidden'; end if;
 update public.lms_materials m set status='archived',archived_at=now(),updated_at=now() from public.center_drive_sources s where s.binding_id=p_binding_id and s.material_id=m.id;
 update public.center_drive_sources set status='revoked',last_sync_at=now() where binding_id=p_binding_id;
end $$;
revoke all on function public.center_queue_google_material(uuid,uuid,text,text,jsonb,text,bigint),public.center_revoke_google_material(uuid,uuid) from public,anon,authenticated;
grant execute on function public.center_queue_google_material(uuid,uuid,text,text,jsonb,text,bigint),public.center_revoke_google_material(uuid,uuid) to service_role;

-- Sheet commits use the existing B3 preview/commit pipeline and center_finish_sheet_import.

commit;
