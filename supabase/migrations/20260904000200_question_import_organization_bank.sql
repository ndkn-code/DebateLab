-- Organization-isolated PDF question imports and reusable IELTS question banks.
begin;

create type public.question_import_status as enum
  ('draft','queued','processing','review','submitted','changes_requested','publishing','completed','failed','quarantined','deleted');
create type public.question_import_document_status as enum
  ('pending','validating','queued','parsing','extracting','ready','failed','quarantined','deleted');
create type public.question_import_item_status as enum
  ('draft','accepted','rejected','needs_confirmation','submitted','changes_requested','published');
create type public.question_bank_collection_status as enum ('draft','published','archived','quarantined');
create type public.question_import_usage_kind as enum ('reservation','consumed','released','adjustment');

create table public.organization_question_import_entitlements (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  max_files_per_batch integer not null default 5 check (max_files_per_batch > 0),
  max_file_size_bytes bigint not null default 26214400 check (max_file_size_bytes > 0),
  max_pages_per_file integer not null default 100 check (max_pages_per_file > 0),
  monthly_page_limit integer not null default 500 check (monthly_page_limit >= 0),
  monthly_question_limit integer not null default 1000 check (monthly_question_limit >= 0),
  concurrent_job_limit integer not null default 2 check (concurrent_job_limit > 0),
  updated_at timestamptz not null default now()
);

create table public.question_import_batches (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 240),
  module public.ielts_module not null default 'academic',
  status public.question_import_status not null default 'draft',
  source_prior_status public.question_import_status,
  copyright_attested boolean not null default false,
  copyright_attestation_version text, copyright_attestation_locale text not null default 'en' check (copyright_attestation_locale in ('en','vi')),
  copyright_attested_at timestamptz,
  copyright_attested_by uuid references public.profiles(id) on delete set null,
  parser_provider text not null default 'llamaparse', parser_version text, prompt_version text,
  total_files integer not null default 0 check (total_files >= 0), total_pages integer not null default 0 check (total_pages >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  quota_reservation_key text, submitted_at timestamptz, completed_at timestamptz,
  failure_code text, failure_message text, quarantine_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((copyright_attested and copyright_attestation_version is not null and copyright_attested_at is not null and copyright_attested_by is not null) or not copyright_attested)
);

create table public.question_import_batch_documents (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.question_import_batches(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  material_id uuid references public.lms_materials(id) on delete restrict,
  version_id uuid references public.lms_material_versions(id) on delete restrict,
  media_material_id uuid references public.lms_materials(id) on delete restrict,
  media_version_id uuid references public.lms_material_versions(id) on delete restrict,
  source_file_name text not null check (length(btrim(source_file_name)) between 1 and 255),
  source_mime_type text not null default 'application/pdf', size_bytes bigint check (size_bytes is null or size_bytes >= 0), page_count integer check (page_count is null or page_count > 0), sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  provider_job_id text, provider_status text, provider_result jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_result)='object'), provider_usage jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_usage)='object'), scanned boolean not null default false, source_prior_status public.question_import_document_status, status public.question_import_document_status not null default 'pending', error_code text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(batch_id, source_file_name), unique(batch_id, sha256)
);

alter table public.lms_material_versions add column if not exists purpose text not null default 'material';
alter table public.lms_material_versions drop constraint if exists lms_material_versions_purpose_check;
alter table public.lms_material_versions add constraint lms_material_versions_purpose_check check (purpose in ('material','question_import'));
create or replace view public.question_import_documents as
  select d.id,d.batch_id,d.club_id,d.material_id,d.version_id as material_version_id,d.media_material_id,d.media_version_id,
    coalesce(v.original_path,v.ingest_path) as storage_path,v.source_file_name as file_name,d.source_file_name,
    d.source_mime_type,d.size_bytes,d.page_count,d.sha256,d.provider_job_id,d.provider_status,d.provider_result,d.provider_usage,d.scanned,d.status,d.error_code,d.error_message,d.created_at,d.updated_at
  from public.question_import_batch_documents d
  left join public.lms_material_versions v on v.id=d.version_id;
create or replace function private.question_import_documents_update() returns trigger language plpgsql security definer set search_path=public,private,extensions as $$ begin
  update public.question_import_batch_documents set sha256=new.sha256,provider_job_id=new.provider_job_id,provider_status=new.provider_status,provider_result=new.provider_result,provider_usage=new.provider_usage,scanned=new.scanned,page_count=new.page_count,status=coalesce(new.status,status),error_code=new.error_code,error_message=new.error_message,updated_at=coalesce(new.updated_at,now()) where id=old.id and batch_id=old.batch_id;
  if new.status='failed' then
    update public.question_import_batches set status='review'
    where id=old.batch_id and status in ('queued','processing','failed') and not exists(
      select 1 from public.question_import_batch_documents where batch_id=old.batch_id and status not in ('ready','failed','deleted'));
  end if;
  return new;
end $$;
create trigger question_import_documents_update instead of update on public.question_import_documents for each row execute function private.question_import_documents_update();

create table public.question_import_draft_items (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.question_import_batches(id) on delete cascade,
  document_id uuid not null references public.question_import_batch_documents(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  question_type public.ielts_question_type not null, skill public.ielts_skill not null,
  ordinal integer not null check (ordinal > 0), payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  source_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(source_evidence) = 'object'),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1), answer_source text not null default 'source' check (answer_source in ('source','ai_suggested','teacher_confirmed','not_applicable')),
  status public.question_import_item_status not null default 'draft', review_note text, reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz,
  source_lifecycle text not null default 'active' check (source_lifecycle in ('active','quarantined','deleted')),
  source_prior_lifecycle text check (source_prior_lifecycle in ('active','quarantined','deleted')),
  source_action_reason text, source_action_at timestamptz, source_action_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(batch_id, ordinal)
);

create table public.question_import_draft_keys (
  draft_item_id uuid primary key references public.question_import_draft_items(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  answer_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_payload) = 'object'),
  answer_confirmed boolean not null default false, confirmed_by uuid references public.profiles(id) on delete set null, confirmed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (not answer_confirmed or (confirmed_by is not null and confirmed_at is not null))
);

create table public.question_bank_collections (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict, title text not null check (length(btrim(title)) between 1 and 240),
  kind text not null default 'loose_items' check (kind in ('full_test','skill_set','loose_items')), module public.ielts_module not null default 'academic',
  status public.question_bank_collection_status not null default 'draft', published_at timestamptz, quarantine_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.question_bank_stimuli (
  id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.question_bank_collections(id) on delete cascade, club_id uuid not null references public.clubs(id) on delete cascade,
  stimulus_kind text not null check (stimulus_kind in ('passage','audio','image','chart','map','diagram','prompt')), payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'), ordinal integer not null default 1 check (ordinal > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.question_bank_items (
  id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.question_bank_collections(id) on delete cascade, stimulus_id uuid references public.question_bank_stimuli(id) on delete set null, source_draft_item_id uuid references public.question_import_draft_items(id) on delete set null, club_id uuid not null references public.clubs(id) on delete cascade,
  question_type public.ielts_question_type not null, skill public.ielts_skill not null, ordinal integer not null check (ordinal > 0), payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'), source_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(source_evidence) = 'object'),
  source_lifecycle text not null default 'active' check (source_lifecycle in ('active','quarantined','deleted')),
  source_prior_lifecycle text check (source_prior_lifecycle in ('active','quarantined','deleted')),
  source_action_reason text, source_action_at timestamptz, source_action_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(collection_id, ordinal)
);
create table public.question_bank_keys (
  bank_item_id uuid primary key references public.question_bank_items(id) on delete cascade, club_id uuid not null references public.clubs(id) on delete cascade, answer_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_payload) = 'object'), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.organization_question_import_usage (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade, bucket_month date not null, kind public.question_import_usage_kind not null, reservation_key text not null, pages integer not null default 0 check (pages >= 0), questions integer not null default 0 check (questions >= 0), jobs integer not null default 0 check (jobs >= 0), created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), unique(club_id, reservation_key)
);
create table public.question_import_compliance_events (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade, batch_id uuid references public.question_import_batches(id) on delete set null, actor_id uuid references public.profiles(id) on delete set null, event_type text not null check (event_type in ('copyright_attested','notice_received','quarantined','restored','deleted','takedown_objection')), reason text, metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'), created_at timestamptz not null default now()
);
create table public.question_import_publication_receipts (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
  batch_id uuid not null references public.question_import_batches(id) on delete cascade,
  collection_id uuid references public.question_bank_collections(id), item_ids uuid[],
  idempotency_key text not null, published_count integer not null default 0 check (published_count >= 0),
  created_at timestamptz not null default now(), unique(club_id,batch_id,idempotency_key)
);

create index question_import_batches_club_status_idx on public.question_import_batches(club_id,status,updated_at desc);
create index question_import_batch_documents_batch_idx on public.question_import_batch_documents(batch_id,status);
create index question_import_draft_items_batch_status_idx on public.question_import_draft_items(batch_id,status,ordinal);
create index question_bank_collections_club_status_idx on public.question_bank_collections(club_id,status,updated_at desc);
create index question_bank_items_collection_idx on public.question_bank_items(collection_id,ordinal);
create index question_import_usage_bucket_idx on public.organization_question_import_usage(club_id,bucket_month);
create index question_import_publication_receipts_batch_idx on public.question_import_publication_receipts(batch_id);
create index lms_material_versions_purpose_idx on public.lms_material_versions(purpose,processing_status);

create or replace function private.question_import_is_member(p_club_id uuid, p_uid uuid) returns boolean language sql stable security definer set search_path=public,private,extensions as $$ select private.can_view_club(p_club_id,p_uid); $$;
create or replace function private.question_import_is_lead(p_club_id uuid, p_uid uuid) returns boolean language sql stable security definer set search_path=public,private,extensions as $$ select private.organization_can_academic_admin(p_club_id,p_uid); $$;
create or replace function private.question_import_is_teacher(p_club_id uuid, p_uid uuid) returns boolean language sql stable security definer set search_path=public,private,extensions as $$ select p_uid is not null and exists(select 1 from public.club_memberships where club_id=p_club_id and user_id=p_uid and status='active' and role in ('teacher','head_teacher','owner','admin')); $$;
create or replace function private.question_import_require_rate_limit(p_scope text,p_limit integer,p_window_seconds integer) returns void language plpgsql security definer set search_path=public,private,extensions as $$ declare result jsonb; begin select public.consume_rate_limit(p_scope,p_limit,p_window_seconds) into result; if coalesce((result->>'allowed')::boolean,false) is not true then raise exception 'QUESTION_IMPORT_RATE_LIMITED' using errcode='P0001',detail=coalesce(result->>'retryAfterSeconds',p_window_seconds::text); end if; end $$;

create or replace function private.question_import_touch() returns trigger language plpgsql set search_path=public,private,extensions as $$ begin new.updated_at=now(); return new; end $$;
create or replace function private.question_import_validate_scope() returns trigger language plpgsql set search_path=public,private,extensions as $$ begin
  if not exists(select 1 from public.question_import_batches b where b.id=new.batch_id and b.club_id=new.club_id) then raise exception 'IMPORT_SCOPE_MISMATCH'; end if;
  if new.material_id is not null and not exists(select 1 from public.lms_materials m where m.id=new.material_id and m.club_id=new.club_id) then raise exception 'MATERIAL_SCOPE_MISMATCH'; end if;
  if new.version_id is not null and not exists(select 1 from public.lms_material_versions v join public.lms_materials m on m.id=v.material_id where v.id=new.version_id and v.material_id=new.material_id and m.club_id=new.club_id) then raise exception 'MATERIAL_VERSION_SCOPE_MISMATCH'; end if;
  if new.media_material_id is not null and not exists(select 1 from public.lms_materials m where m.id=new.media_material_id and m.club_id=new.club_id) then raise exception 'MEDIA_MATERIAL_SCOPE_MISMATCH'; end if;
  if new.media_version_id is not null and not exists(select 1 from public.lms_material_versions v join public.lms_materials m on m.id=v.material_id where v.id=new.media_version_id and v.material_id=new.media_material_id and m.club_id=new.club_id) then raise exception 'MEDIA_VERSION_SCOPE_MISMATCH'; end if;
  return new;
end $$;
create trigger question_import_document_scope before insert or update on public.question_import_batch_documents for each row execute function private.question_import_validate_scope();
create or replace function private.question_import_validate_child_scope() returns trigger language plpgsql set search_path=public,private,extensions as $$
begin
  if tg_table_name='question_import_draft_items' then
    if not exists(select 1 from public.question_import_batch_documents d where d.id=new.document_id and d.batch_id=new.batch_id and d.club_id=new.club_id) then raise exception 'IMPORT_CHILD_SCOPE_MISMATCH'; end if;
  elsif tg_table_name='question_import_draft_keys' then
    if not exists(select 1 from public.question_import_draft_items d where d.id=new.draft_item_id and d.club_id=new.club_id) then raise exception 'DRAFT_KEY_SCOPE_MISMATCH'; end if;
  elsif tg_table_name='question_bank_stimuli' then
    if not exists(select 1 from public.question_bank_collections c where c.id=new.collection_id and c.club_id=new.club_id) then raise exception 'COLLECTION_SCOPE_MISMATCH'; end if;
  elsif tg_table_name='question_bank_items' then
    if not exists(select 1 from public.question_bank_collections c where c.id=new.collection_id and c.club_id=new.club_id) then raise exception 'BANK_ITEM_SCOPE_MISMATCH'; end if;
    if new.stimulus_id is not null and not exists(select 1 from public.question_bank_stimuli s where s.id=new.stimulus_id and s.club_id=new.club_id and s.collection_id=new.collection_id) then raise exception 'BANK_STIMULUS_SCOPE_MISMATCH'; end if;
    if new.source_draft_item_id is not null and not exists(select 1 from public.question_import_draft_items d where d.id=new.source_draft_item_id and d.club_id=new.club_id) then raise exception 'BANK_SOURCE_SCOPE_MISMATCH'; end if;
  elsif tg_table_name='question_bank_keys' then
    if not exists(select 1 from public.question_bank_items i where i.id=new.bank_item_id and i.club_id=new.club_id) then raise exception 'BANK_KEY_SCOPE_MISMATCH'; end if;
  end if;
  return new;
end $$;
create trigger question_import_draft_scope before insert or update on public.question_import_draft_items for each row execute function private.question_import_validate_child_scope();
create trigger question_import_draft_key_scope before insert or update on public.question_import_draft_keys for each row execute function private.question_import_validate_child_scope();
create trigger question_bank_stimulus_scope before insert or update on public.question_bank_stimuli for each row execute function private.question_import_validate_child_scope();
create trigger question_bank_item_scope before insert or update on public.question_bank_items for each row execute function private.question_import_validate_child_scope();
create trigger question_bank_key_scope before insert or update on public.question_bank_keys for each row execute function private.question_import_validate_child_scope();
do $$ declare t text; begin foreach t in array array['question_import_batches','question_import_batch_documents','question_import_draft_items','question_import_draft_keys','question_bank_collections','question_bank_stimuli','question_bank_items','question_bank_keys','organization_question_import_entitlements'] loop execute format('create trigger %I before update on public.%I for each row execute function private.question_import_touch()', t||'_updated_at',t); end loop; end $$;

alter table public.question_import_batches enable row level security; alter table public.question_import_batch_documents enable row level security; alter table public.question_import_draft_items enable row level security; alter table public.question_import_draft_keys enable row level security; alter table public.question_bank_collections enable row level security; alter table public.question_bank_stimuli enable row level security; alter table public.question_bank_items enable row level security; alter table public.question_bank_keys enable row level security; alter table public.organization_question_import_entitlements enable row level security; alter table public.organization_question_import_usage enable row level security; alter table public.question_import_compliance_events enable row level security; alter table public.question_import_publication_receipts enable row level security;

create policy question_import_batch_read on public.question_import_batches for select to authenticated using (private.question_import_is_member(club_id,(select auth.uid())) and (created_by=(select auth.uid()) or private.question_import_is_lead(club_id,(select auth.uid()))));
create policy question_import_batch_insert on public.question_import_batches for insert to authenticated with check (created_by=(select auth.uid()) and private.question_import_is_teacher(club_id,(select auth.uid())));
create policy question_import_batch_update on public.question_import_batches for update to authenticated using (created_by=(select auth.uid()) and status in ('draft','review','changes_requested')) with check (created_by=(select auth.uid()) and status in ('draft','review','changes_requested'));
create policy question_import_documents_read on public.question_import_batch_documents for select to authenticated using (private.question_import_is_teacher(club_id,(select auth.uid())) and exists(select 1 from public.question_import_batches b where b.id=batch_id and b.status not in ('quarantined','deleted') and ((b.created_by=(select auth.uid()) and b.status in ('draft','queued','processing','review','changes_requested','failed')) or private.question_import_is_lead(b.club_id,(select auth.uid())))));
create policy question_import_drafts_read on public.question_import_draft_items for select to authenticated using (source_lifecycle='active' and private.question_import_is_teacher(club_id,(select auth.uid())) and (exists(select 1 from public.question_import_batches b where b.id=batch_id and b.club_id=public.question_import_draft_items.club_id and b.status not in ('quarantined','deleted') and b.created_by=(select auth.uid())) or private.question_import_is_lead(club_id,(select auth.uid()))));
create policy question_import_drafts_update on public.question_import_draft_items for update to authenticated using (exists(select 1 from public.question_import_batches b where b.id=question_import_draft_items.batch_id and b.club_id=question_import_draft_items.club_id and b.created_by=(select auth.uid()) and private.question_import_is_teacher(b.club_id,(select auth.uid())) and b.status in ('draft','review','changes_requested'))) with check (exists(select 1 from public.question_import_batches b where b.id=question_import_draft_items.batch_id and b.club_id=question_import_draft_items.club_id and b.created_by=(select auth.uid()) and private.question_import_is_teacher(b.club_id,(select auth.uid())) and b.status in ('draft','review','changes_requested')));
create policy question_import_keys_read on public.question_import_draft_keys for select to authenticated using (private.question_import_is_teacher(club_id,(select auth.uid())) and exists(select 1 from public.question_import_draft_items d join public.question_import_batches b on b.id=d.batch_id where d.id=draft_item_id and d.source_lifecycle='active' and (private.question_import_is_lead(b.club_id,(select auth.uid())) or (b.created_by=(select auth.uid()) and b.status in ('draft','review','changes_requested')))));
create policy bank_collection_read on public.question_bank_collections for select to authenticated using (private.question_import_is_teacher(club_id,(select auth.uid())) and (status='published' or private.question_import_is_lead(club_id,(select auth.uid()))));
create policy bank_stimulus_read on public.question_bank_stimuli for select to authenticated using (private.question_import_is_teacher(club_id,(select auth.uid())) and exists(select 1 from public.question_bank_items i where i.stimulus_id=public.question_bank_stimuli.id and i.club_id=public.question_bank_stimuli.club_id and i.source_lifecycle='active'));
create policy bank_item_read on public.question_bank_items for select to authenticated using (source_lifecycle='active' and private.question_import_is_teacher(club_id,(select auth.uid())) and exists(select 1 from public.question_bank_collections c where c.id=collection_id and c.club_id=public.question_bank_items.club_id and c.status<>'quarantined' and (c.status='published' or private.question_import_is_lead(c.club_id,(select auth.uid())))));
create policy bank_key_read on public.question_bank_keys for select to authenticated using (private.question_import_is_lead(club_id,(select auth.uid())) and exists(select 1 from public.question_bank_items i where i.id=bank_item_id and i.source_lifecycle='active'));
create policy entitlement_read on public.organization_question_import_entitlements for select to authenticated using (private.question_import_is_lead(club_id,(select auth.uid())));
create policy compliance_read on public.question_import_compliance_events for select to authenticated using (private.question_import_is_lead(club_id,(select auth.uid())));
create policy publication_receipts_read on public.question_import_publication_receipts for select to authenticated using (private.question_import_is_lead(club_id,(select auth.uid())));

grant select on public.question_import_batches,public.question_import_batch_documents,public.question_import_draft_items,public.question_import_draft_keys,public.question_bank_collections,public.question_bank_stimuli,public.question_bank_items,public.question_bank_keys,public.organization_question_import_entitlements,public.question_import_compliance_events,public.question_import_publication_receipts to authenticated;
revoke insert,update,delete on public.question_import_batches,public.question_import_batch_documents,public.question_import_draft_items,public.question_import_draft_keys,public.question_bank_collections,public.question_bank_stimuli,public.question_bank_items,public.question_bank_keys,public.organization_question_import_entitlements,public.organization_question_import_usage,public.question_import_compliance_events,public.question_import_publication_receipts from authenticated;

create or replace function public.reserve_question_import_quota(p_club_id uuid,p_reservation_key text,p_pages integer,p_questions integer,p_jobs integer) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$ declare e public.organization_question_import_entitlements%rowtype; used_pages integer; used_questions integer; used_jobs integer; existing jsonb; month_key date:=date_trunc('month',current_date)::date; begin if not private.question_import_is_teacher(p_club_id,auth.uid()) or p_pages<0 or p_questions<0 or p_jobs<0 or nullif(btrim(p_reservation_key),'') is null then raise exception 'FORBIDDEN'; end if; select * into e from public.organization_question_import_entitlements where club_id=p_club_id for update; if not found then insert into public.organization_question_import_entitlements(club_id) values(p_club_id) returning * into e; end if; select coalesce(sum(pages),0),coalesce(sum(questions),0),coalesce(sum(jobs),0) into used_pages,used_questions,used_jobs from public.organization_question_import_usage where club_id=p_club_id and bucket_month=month_key and kind in ('reservation','consumed'); select jsonb_build_object('pages',pages,'questions',questions,'jobs',jobs) into existing from public.organization_question_import_usage where club_id=p_club_id and bucket_month=month_key and kind='reservation' and reservation_key=p_reservation_key; if existing is not null then return existing||jsonb_build_object('idempotent',true); end if; if used_pages+p_pages>e.monthly_page_limit or used_questions+p_questions>e.monthly_question_limit or used_jobs+p_jobs>e.concurrent_job_limit then raise exception 'IMPORT_QUOTA_EXCEEDED'; end if; insert into public.organization_question_import_usage(club_id,bucket_month,kind,reservation_key,pages,questions,jobs,created_by) values(p_club_id,month_key,'reservation',p_reservation_key,p_pages,p_questions,p_jobs,auth.uid()); return jsonb_build_object('pages',p_pages,'questions',p_questions,'jobs',p_jobs,'idempotent',false); end $$;

create or replace function public.create_question_bank_collection(p_club_id uuid,p_title text,p_kind text,p_module public.ielts_module) returns uuid language plpgsql security definer set search_path=public,private,extensions as $$ declare v_id uuid; begin if not private.question_import_is_lead(p_club_id,auth.uid()) or nullif(btrim(p_title),'') is null then raise exception 'FORBIDDEN'; end if; insert into public.question_bank_collections(club_id,created_by,title,kind,module) values(p_club_id,auth.uid(),btrim(p_title),coalesce(p_kind,'loose_items'),coalesce(p_module,'academic')) returning id into v_id; return v_id; end $$;
create or replace function public.create_question_import_batch(p_club_id uuid,p_title text,p_module public.ielts_module,p_copyright_attestation_version text,p_copyright_attestation_locale text,p_actor_id uuid) returns uuid language plpgsql security definer set search_path=public,private,extensions as $$ declare v_id uuid; begin if p_actor_id is distinct from auth.uid() or not private.question_import_is_teacher(p_club_id,auth.uid()) or p_copyright_attestation_locale not in ('en','vi') then raise exception 'FORBIDDEN' using errcode='42501'; end if; perform private.question_import_require_rate_limit('lms-question-import:create',10,600); if nullif(btrim(p_title),'') is null or p_copyright_attestation_version is distinct from '2026-09-04.v1' then raise exception 'INVALID_IMPORT_INPUT'; end if; insert into public.question_import_batches(club_id,created_by,title,module,copyright_attested,copyright_attestation_version,copyright_attestation_locale,copyright_attested_at,copyright_attested_by) values(p_club_id,auth.uid(),btrim(p_title),coalesce(p_module,'academic'),true,p_copyright_attestation_version,p_copyright_attestation_locale,now(),auth.uid()) returning id into v_id; insert into public.question_import_compliance_events(club_id,batch_id,actor_id,event_type,metadata) values(p_club_id,v_id,auth.uid(),'copyright_attested',jsonb_build_object('version',p_copyright_attestation_version,'locale',p_copyright_attestation_locale)); return v_id; end $$;
create or replace function public.get_question_import_quota(p_club_id uuid) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare e public.organization_question_import_entitlements%rowtype; month_key date:=date_trunc('month',current_date)::date; p integer; q integer; j integer;
begin
  if not private.question_import_is_teacher(p_club_id,auth.uid()) then raise exception 'FORBIDDEN'; end if;
  insert into public.organization_question_import_entitlements(club_id) values(p_club_id) on conflict(club_id) do nothing;
  select * into e from public.organization_question_import_entitlements where club_id=p_club_id;
  select coalesce(sum(pages),0),coalesce(sum(questions),0) into p,q from public.organization_question_import_usage where club_id=p_club_id and bucket_month=month_key and kind in ('reservation','consumed');
  select coalesce(sum(jobs),0) into j from public.organization_question_import_usage where club_id=p_club_id and kind='reservation';
  return jsonb_build_object('pagesUsed',p,'pagesRemaining',greatest(e.monthly_page_limit-p,0),'questionsUsed',q,'questionsRemaining',greatest(e.monthly_question_limit-q,0),'jobsInFlight',j,'jobLimit',e.concurrent_job_limit,'month',month_key);
end $$;

create or replace function public.reconcile_question_import_quota(p_club_id uuid,p_reservation_key text,p_pages integer,p_questions integer,p_jobs integer) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$ declare r public.organization_question_import_usage%rowtype; e public.organization_question_import_entitlements%rowtype; month_key date:=date_trunc('month',current_date)::date; used_pages integer; used_questions integer; begin if not private.question_import_is_teacher(p_club_id,auth.uid()) or p_pages<0 or p_questions<0 or p_jobs<0 then raise exception 'FORBIDDEN'; end if; select * into e from public.organization_question_import_entitlements where club_id=p_club_id for update; select * into r from public.organization_question_import_usage where club_id=p_club_id and bucket_month=month_key and kind='reservation' and reservation_key=p_reservation_key for update; if not found then if exists(select 1 from public.organization_question_import_usage where club_id=p_club_id and bucket_month=month_key and kind='consumed' and reservation_key=p_reservation_key) then return jsonb_build_object('idempotent',true); end if; raise exception 'RESERVATION_NOT_FOUND'; end if; select coalesce(sum(pages),0),coalesce(sum(questions),0) into used_pages,used_questions from public.organization_question_import_usage where club_id=p_club_id and bucket_month=month_key and kind in ('reservation','consumed'); if used_pages-r.pages+p_pages>e.monthly_page_limit or used_questions-r.questions+p_questions>e.monthly_question_limit then raise exception 'IMPORT_QUOTA_EXCEEDED'; end if; insert into public.organization_question_import_usage(club_id,bucket_month,kind,reservation_key,pages,questions,jobs,created_by) values(p_club_id,month_key,'consumed',p_reservation_key,p_pages,p_questions,0,auth.uid()); update public.organization_question_import_usage set kind='released',pages=greatest(r.pages-p_pages,0),questions=greatest(r.questions-p_questions,0),jobs=r.jobs where id=r.id; return jsonb_build_object('idempotent',false,'pages',p_pages,'questions',p_questions); end $$;

create or replace function public.request_question_import_changes(p_batch_id uuid,p_note text) returns void language plpgsql security definer set search_path=public,private,extensions as $$ declare c uuid; begin select club_id into c from public.question_import_batches where id=p_batch_id; if c is null or not private.question_import_is_lead(c,auth.uid()) then raise exception 'FORBIDDEN'; end if; update public.question_import_batches set status='changes_requested',failure_message=nullif(btrim(p_note),'') where id=p_batch_id and status='submitted'; if not found then raise exception 'IMPORT_STATE_INVALID'; end if; update public.question_import_draft_items set status='changes_requested',review_note=nullif(btrim(p_note),'') where batch_id=p_batch_id and status='submitted'; end $$;

create or replace function public.mark_question_import_source_action(p_batch_id uuid,p_action text,p_reason text) returns void language plpgsql security definer set search_path=public,private,extensions as $$
declare b public.question_import_batches%rowtype;
begin
  select * into b from public.question_import_batches where id=p_batch_id for update;
  if b.id is null or not private.question_import_is_lead(b.club_id,auth.uid()) or p_action is null or p_action not in ('quarantined','restored','deleted') or nullif(btrim(p_reason),'') is null then raise exception 'FORBIDDEN'; end if;
  if b.status='deleted' then if p_action='deleted' then return; end if; raise exception 'IMPORT_DELETION_FINAL'; end if;
  if p_action='restored' then
    if b.status<>'quarantined' then raise exception 'IMPORT_STATE_INVALID'; end if;
    update public.question_import_batches set status=coalesce(source_prior_status,'review'),source_prior_status=null,quarantine_reason=null where id=b.id;
    update public.question_import_batch_documents set status=coalesce(source_prior_status,'pending'),source_prior_status=null where batch_id=b.id and status='quarantined';
    update public.question_import_draft_items set source_lifecycle='active',source_prior_lifecycle=null,source_action_reason=null where batch_id=b.id and source_lifecycle='quarantined';
    update public.question_bank_items set source_lifecycle='active',source_prior_lifecycle=null,source_action_reason=null where source_draft_item_id in(select id from public.question_import_draft_items where batch_id=b.id) and source_lifecycle='quarantined';
  else
    if p_action='quarantined' and b.status='quarantined' then return; end if;
    update public.question_import_batches set source_prior_status=case when p_action='quarantined' then status else source_prior_status end,status=p_action::public.question_import_status,quarantine_reason=p_reason where id=b.id;
    update public.question_import_batch_documents set source_prior_status=case when p_action='quarantined' then status else source_prior_status end,status=p_action::public.question_import_document_status where batch_id=b.id;
    update public.question_import_draft_items set source_prior_lifecycle=source_lifecycle,source_lifecycle=p_action,source_action_reason=p_reason,source_action_by=auth.uid(),source_action_at=now() where batch_id=b.id;
    update public.question_bank_items set source_prior_lifecycle=source_lifecycle,source_lifecycle=p_action,source_action_reason=p_reason,source_action_by=auth.uid(),source_action_at=now() where source_draft_item_id in(select id from public.question_import_draft_items where batch_id=b.id);
    if p_action='deleted' then
      perform 1 from public.organization_question_import_entitlements where club_id=b.club_id for update;
      update public.organization_question_import_usage u set kind='released',pages=0,questions=0,jobs=0 where u.club_id=b.club_id and u.kind='reservation' and exists(select 1 from public.question_import_batch_documents d where d.batch_id=b.id and u.reservation_key=format('question-import:%s:%s',b.id,d.id));
    end if;
  end if;
  insert into public.question_import_compliance_events(club_id,batch_id,actor_id,event_type,reason,metadata) values(b.club_id,b.id,auth.uid(),p_action,p_reason,jsonb_build_object('prior_status',b.status,'storage_cleanup_required',p_action='deleted'));
end $$;

create or replace function public.register_question_import_material(p_batch_id uuid,p_material_id uuid,p_version_id uuid,p_media_material_id uuid default null,p_media_version_id uuid default null) returns uuid language plpgsql security definer set search_path=public,private,extensions as $$
declare b public.question_import_batches%rowtype; v public.lms_material_versions%rowtype; out_id uuid; count_docs integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into b from public.question_import_batches where id=p_batch_id for update;
  select * into v from public.lms_material_versions where id=p_version_id and material_id=p_material_id and purpose='question_import';
  if b.id is null or b.status not in ('draft','queued','processing') or not b.copyright_attested or b.copyright_attestation_version<>'2026-09-04.v1' or v.id is null or v.created_by<>b.created_by or not exists(select 1 from public.lms_materials where id=p_material_id and club_id=b.club_id and created_by=b.created_by) then raise exception 'IMPORT_MATERIAL_INVALID'; end if;
  if p_media_material_id is not null or p_media_version_id is not null then raise exception 'IMPORT_MEDIA_USE_SEPARATE_UPLOAD'; end if;
  select id into out_id from public.question_import_batch_documents where batch_id=b.id and (version_id=v.id or media_version_id=v.id);
  if found then return out_id; end if;
  if exists(select 1 from public.question_import_batch_documents where version_id=v.id or media_version_id=v.id) then raise exception 'IMPORT_SOURCE_ALREADY_BOUND'; end if;
  select count(*) into count_docs from public.question_import_batch_documents where batch_id=b.id;
  if v.source_mime_type in ('audio/mpeg','audio/mp4','audio/wav','audio/x-wav') then
    if v.size_bytes not between 1 and 104857600 or count_docs<>1 or exists(select 1 from public.question_import_batch_documents where batch_id=b.id and media_version_id is not null) then raise exception 'IMPORT_AUDIO_INVALID'; end if;
    update public.question_import_batch_documents set media_material_id=p_material_id,media_version_id=p_version_id where batch_id=b.id returning id into out_id;
  else
    if v.source_mime_type<>'application/pdf' or v.size_bytes not between 1 and least(26214400,coalesce((select max_file_size_bytes from public.organization_question_import_entitlements where club_id=b.club_id),26214400)) then raise exception 'IMPORT_PDF_INVALID'; end if;
    if count_docs>=least(5,coalesce((select max_files_per_batch from public.organization_question_import_entitlements where club_id=b.club_id),5)) or exists(select 1 from public.question_import_batch_documents where batch_id=b.id and media_version_id is not null) then raise exception 'IMPORT_FILE_LIMIT_EXCEEDED'; end if;
    insert into public.question_import_batch_documents(batch_id,club_id,material_id,version_id,source_file_name,source_mime_type,size_bytes) values(b.id,b.club_id,p_material_id,p_version_id,v.source_file_name,v.source_mime_type,v.size_bytes) returning id into out_id;
  end if;
  update public.question_import_batches set total_files=(select count(*) from public.question_import_batch_documents where batch_id=b.id),status='queued' where id=b.id;
  return out_id;
end $$;
create or replace function public.claim_question_import_provider_job(p_batch_id uuid,p_document_id uuid,p_pages integer,p_question_estimate integer,p_reservation_key text) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare b public.question_import_batches%rowtype; d public.question_import_batch_documents%rowtype; e public.organization_question_import_entitlements%rowtype; r public.organization_question_import_usage%rowtype; month_key date:=date_trunc('month',current_date)::date; used_p integer; used_q integer; used_j integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into b from public.question_import_batches where id=p_batch_id for update;
  select * into d from public.question_import_batch_documents where id=p_document_id and batch_id=p_batch_id for update;
  if b.id is null or d.id is null or d.club_id<>b.club_id or b.status not in ('queued','processing','failed','review') or d.status in ('quarantined','deleted') or p_pages is null or p_pages not between 1 and 100 or p_question_estimate is null or p_question_estimate<0 or p_reservation_key is distinct from format('question-import:%s:%s',p_batch_id,p_document_id) then raise exception 'IMPORT_INPUT_INVALID'; end if;
  insert into public.organization_question_import_entitlements(club_id) values(b.club_id) on conflict do nothing;
  select * into e from public.organization_question_import_entitlements where club_id=b.club_id for update;
  if p_pages>e.max_pages_per_file then raise exception 'IMPORT_PAGE_LIMIT_EXCEEDED'; end if;
  select * into r from public.organization_question_import_usage where club_id=b.club_id and reservation_key=p_reservation_key order by bucket_month desc limit 1 for update;
  if r.id is not null and r.kind in ('reservation','consumed') then return jsonb_build_object('idempotent',true,'pages',r.pages,'questions',r.questions,'jobs',r.jobs); end if;
  select coalesce(sum(pages),0),coalesce(sum(questions),0) into used_p,used_q from public.organization_question_import_usage where club_id=b.club_id and bucket_month=month_key and kind in ('reservation','consumed');
  select coalesce(sum(jobs),0) into used_j from public.organization_question_import_usage where club_id=b.club_id and kind='reservation';
  if used_p+p_pages>e.monthly_page_limit or used_q+p_question_estimate>e.monthly_question_limit or used_j+1>e.concurrent_job_limit then raise exception 'IMPORT_QUOTA_EXCEEDED'; end if;
  if r.id is null then
    insert into public.organization_question_import_usage(club_id,bucket_month,kind,reservation_key,pages,questions,jobs) values(b.club_id,month_key,'reservation',p_reservation_key,p_pages,p_question_estimate,1);
  else
    update public.organization_question_import_usage set bucket_month=month_key,kind='reservation',pages=p_pages,questions=p_question_estimate,jobs=1 where id=r.id;
  end if;
  update public.question_import_batch_documents set status='parsing',page_count=p_pages where id=d.id;
  update public.question_import_batches set status='processing' where id=b.id;
  return jsonb_build_object('idempotent',false,'pages',p_pages,'questions',p_question_estimate,'jobs',1);
end $$;

create or replace function public.release_question_import_worker_quota(p_club_id uuid,p_reservation_key text) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare d public.question_import_batch_documents%rowtype; changed boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into d from public.question_import_batch_documents where club_id=p_club_id and p_reservation_key=format('question-import:%s:%s',batch_id,id);
  if d.id is null then raise exception 'IMPORT_INPUT_INVALID'; end if;
  perform 1 from public.question_import_batches where id=d.batch_id for update;
  perform 1 from public.organization_question_import_entitlements where club_id=p_club_id for update;
  update public.organization_question_import_usage set kind='released',pages=0,questions=0,jobs=0 where club_id=p_club_id and reservation_key=p_reservation_key and kind='reservation'; changed:=found;
  return jsonb_build_object('released',changed,'idempotent',not changed);
end $$;
create or replace function public.release_question_import_quota(p_club_id uuid,p_reservation_key text) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$ declare found_row boolean; begin if not private.question_import_is_teacher(p_club_id,auth.uid()) then raise exception 'FORBIDDEN'; end if; update public.organization_question_import_usage set kind='released' where club_id=p_club_id and reservation_key=p_reservation_key and kind='reservation'; found_row:=found or exists(select 1 from public.organization_question_import_usage where club_id=p_club_id and reservation_key=p_reservation_key and kind='released'); return jsonb_build_object('released',found_row,'idempotent',found); end $$;

-- Parser output is untrusted; answer storage is separate from reusable item content.
create or replace function private.question_import_strip_answers(p_value jsonb) returns jsonb
language plpgsql immutable set search_path=public,private,extensions as $$
declare k text; v jsonb; out_value jsonb:='{}'::jsonb;
begin
  if p_value is null then return null; end if;
  if jsonb_typeof(p_value)='array' then
    select coalesce(jsonb_agg(private.question_import_strip_answers(value)),'[]'::jsonb) into out_value from jsonb_array_elements(p_value);
    return out_value;
  end if;
  if jsonb_typeof(p_value)<>'object' then return p_value; end if;
  for k,v in select key,value from jsonb_each(p_value) loop
    if lower(regexp_replace(k,'[^a-zA-Z]','','g')) not in ('answer','answers','answerkey','answerkeys','key','keys','correctanswer','correctanswers','suggestedanswer','suggestedanswers','answerpayload','solution','solutions','iscorrect','correct','explanation','rationale') then
      out_value:=out_value || jsonb_build_object(k,private.question_import_strip_answers(v));
    end if;
  end loop;
  return out_value;
end $$;

create or replace function public.save_question_import_draft(p_draft_item_id uuid,p_payload jsonb,p_status public.question_import_item_status,p_review_note text) returns void language plpgsql security definer set search_path=public,private,extensions as $$
declare d public.question_import_draft_items%rowtype; b public.question_import_batches%rowtype; clean jsonb; typ public.ielts_question_type; skl public.ielts_skill;
begin
  select bb.* into b from public.question_import_batches bb join public.question_import_draft_items di on di.batch_id=bb.id where di.id=p_draft_item_id for update of bb;
  select * into d from public.question_import_draft_items where id=p_draft_item_id for update;
  if d.id is null or b.created_by is distinct from auth.uid() or not private.question_import_is_teacher(b.club_id,auth.uid()) or b.status not in ('review','changes_requested') or d.source_lifecycle<>'active' or d.status='published' or p_status is null or p_status not in ('draft','accepted','rejected','needs_confirmation') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'IMPORT_VALIDATION_FAILED'; end if;
  clean:=private.question_import_strip_answers(p_payload);
  typ:=coalesce(clean->>'question_type',d.question_type::text)::public.ielts_question_type; skl:=coalesce(clean->>'skill',d.skill::text)::public.ielts_skill;
  if p_status='accepted' then
    perform private.question_import_validate_payload(clean,typ,skl,b.module);
    if skl in ('listening','reading') and not exists(select 1 from public.question_import_draft_keys k where k.draft_item_id=d.id and k.answer_confirmed and private.question_import_valid_answer(k.answer_payload->'answer')) then raise exception 'IMPORT_KEYS_UNCONFIRMED'; end if;
  end if;
  if clean is distinct from d.payload or typ<>d.question_type or skl<>d.skill then
    if p_status='accepted' and skl in ('listening','reading') then raise exception 'IMPORT_SAVE_BEFORE_CONFIRM'; end if;
    update public.question_import_draft_keys set answer_confirmed=false,confirmed_by=null,confirmed_at=null where draft_item_id=d.id;
  end if;
  update public.question_import_draft_items set payload=clean,question_type=typ,skill=skl,status=p_status,review_note=nullif(btrim(p_review_note),''),reviewed_by=auth.uid(),reviewed_at=now(),answer_source=case when skl in ('writing','speaking') then 'not_applicable' else answer_source end where id=d.id;
  if skl in ('writing','speaking') then delete from public.question_import_draft_keys where draft_item_id=d.id; end if;
end $$;


create or replace function public.persist_question_import_result(p_batch_id uuid,p_document_id uuid,p_provider_status text,p_provider_result jsonb,p_provider_usage jsonb,p_pages integer) returns integer language plpgsql security definer set search_path=public,private,extensions as $$
declare b public.question_import_batches%rowtype; d public.question_import_batch_documents%rowtype; e public.organization_question_import_entitlements%rowtype; r public.organization_question_import_usage%rowtype; item jsonb; clean jsonb; typ public.ielts_question_type; skl public.ielts_skill; n integer:=0; ord integer; key text:=format('question-import:%s:%s',p_batch_id,p_document_id); used_p integer; used_q integer; answer jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into b from public.question_import_batches where id=p_batch_id for update;
  select * into d from public.question_import_batch_documents where id=p_document_id and batch_id=p_batch_id for update;
  if b.id is null or d.id is null or d.club_id<>b.club_id or b.status in ('quarantined','deleted') or d.status in ('quarantined','deleted') or lower(coalesce(p_provider_status,'')) not in ('completed','succeeded','success') or p_pages is null or p_pages not between 1 and 100 then raise exception 'IMPORT_INPUT_INVALID'; end if;
  if d.status='ready' then return (select count(*) from public.question_import_draft_items where document_id=d.id); end if;
  if b.status not in ('processing','queued','review','failed') then raise exception 'IMPORT_STATE_INVALID'; end if;
  if jsonb_typeof(p_provider_result->'items') is distinct from 'array' then raise exception 'IMPORT_ITEMS_REQUIRED'; end if;
  n:=jsonb_array_length(p_provider_result->'items'); if n=0 or n>1000 then raise exception 'IMPORT_ITEMS_REQUIRED'; end if;
  select * into e from public.organization_question_import_entitlements where club_id=b.club_id for update;
  select * into r from public.organization_question_import_usage where club_id=b.club_id and reservation_key=key and kind='reservation' for update;
  if r.id is null or e.club_id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  select coalesce(sum(pages),0),coalesce(sum(questions),0) into used_p,used_q from public.organization_question_import_usage where club_id=b.club_id and bucket_month=r.bucket_month and kind in ('reservation','consumed');
  if p_pages>e.max_pages_per_file or used_p-r.pages+p_pages>e.monthly_page_limit or used_q-r.questions+n>e.monthly_question_limit then raise exception 'IMPORT_QUOTA_EXCEEDED'; end if;
  select coalesce(max(ordinal),0) into ord from public.question_import_draft_items where batch_id=b.id;
  for item in select value from jsonb_array_elements(p_provider_result->'items') loop
    clean:=private.question_import_strip_answers(item);
    begin typ:=(item->>'question_type')::public.ielts_question_type; exception when invalid_text_representation then typ:='short_answer'; clean:=clean||jsonb_build_object('validation_issues',jsonb_build_array('unsupported_question_type')); end;
    typ:=coalesce(typ,'short_answer');
    begin skl:=coalesce(item->>'skill',case when typ::text like 'writing_%' then 'writing' when typ::text like 'speaking_%' then 'speaking' else 'reading' end)::public.ielts_skill; exception when invalid_text_representation then skl:='reading'; end;
    answer:=case when private.question_import_valid_answer(item->'answer') then item->'answer' else item->'suggested_answer' end;
    ord:=ord+1;
    insert into public.question_import_draft_items(batch_id,document_id,club_id,question_type,skill,ordinal,payload,source_evidence,answer_source,status)
      values(b.id,d.id,b.club_id,typ,skl,ord,clean,jsonb_build_object('sha256',d.sha256,'page',case when (item->>'page') ~ '^[0-9]{1,3}$' then greatest(1,least(p_pages,(item->>'page')::integer)) else 1 end,'regions',coalesce(item->'regions','[]'::jsonb)),case when skl in ('writing','speaking') then 'not_applicable' when private.question_import_valid_answer(item->'answer') then 'source' else 'ai_suggested' end,'draft');
    if skl in ('listening','reading') and private.question_import_valid_answer(answer) then
      insert into public.question_import_draft_keys(draft_item_id,club_id,answer_payload) select id,b.club_id,jsonb_build_object('answer',answer) from public.question_import_draft_items where batch_id=b.id and ordinal=ord;
    end if;
  end loop;
  -- One durable usage row transitions in place; released retries cannot collide with history.
  update public.organization_question_import_usage set kind='consumed',pages=p_pages,questions=n,jobs=0 where id=r.id;
  update public.question_import_batch_documents set provider_status=p_provider_status,provider_result=coalesce(p_provider_result,'{}'),provider_usage=coalesce(p_provider_usage,'{}'),page_count=p_pages,status='ready' where id=d.id;
  update public.question_import_batches set total_pages=(select coalesce(sum(page_count),0) from public.question_import_batch_documents where batch_id=b.id),total_questions=(select count(*) from public.question_import_draft_items where batch_id=b.id),status=case when exists(select 1 from public.question_import_batch_documents where batch_id=b.id and status not in ('ready','failed','deleted')) then 'processing'::public.question_import_status else 'review'::public.question_import_status end where id=b.id;
  return n;
end $$;

create or replace function public.publish_question_import_items(p_batch_id uuid,p_collection_id uuid,p_item_ids uuid[],p_idempotency_key text) returns integer language plpgsql security definer set search_path=public,private,extensions as $$
declare b public.question_import_batches%rowtype; prior public.question_import_publication_receipts%rowtype; col public.question_bank_collections%rowtype; n integer:=0; d public.question_import_draft_items%rowtype; bi uuid; s uuid; base integer; media uuid;
begin
  select * into b from public.question_import_batches where id=p_batch_id for update;
  if b.id is null or not private.question_import_is_lead(b.club_id,auth.uid()) or length(coalesce(p_idempotency_key,'')) not between 1 and 200 then raise exception 'FORBIDDEN'; end if;
  select * into prior from public.question_import_publication_receipts where club_id=b.club_id and batch_id=p_batch_id and idempotency_key=p_idempotency_key;
  if found then
    if prior.collection_id is distinct from p_collection_id or prior.item_ids is distinct from (select array_agg(x order by x) from unnest(p_item_ids) x) then raise exception 'IMPORT_IDEMPOTENCY_MISMATCH'; end if;
    return prior.published_count;
  end if;
  if b.status<>'submitted' then raise exception 'IMPORT_STATE_INVALID'; end if;
  perform private.question_import_require_rate_limit('lms-question-import:publish',10,3600);
  select * into col from public.question_bank_collections where id=p_collection_id for update;
  if col.id is null or col.club_id<>b.club_id or col.status not in ('draft','published') or col.module<>b.module then raise exception 'COLLECTION_NOT_FOUND'; end if;
  if coalesce(cardinality(p_item_ids),0)=0 or cardinality(p_item_ids)<>(select count(*) from public.question_import_draft_items where id=any(p_item_ids) and batch_id=p_batch_id) then raise exception 'IMPORT_ITEM_SCOPE_MISMATCH' using errcode='42501'; end if;
  select coalesce(max(ordinal),0) into base from public.question_bank_items where collection_id=p_collection_id;
  for d in select * from public.question_import_draft_items where id=any(p_item_ids) and batch_id=p_batch_id order by ordinal for update loop
    if d.status<>'submitted' or d.source_lifecycle<>'active' then raise exception 'IMPORT_ITEM_NOT_SUBMITTED'; end if;
    perform private.question_import_validate_payload(d.payload,d.question_type,d.skill,b.module);
    if d.skill in ('listening','reading') and not exists(select 1 from public.question_import_draft_keys k where k.draft_item_id=d.id and k.answer_confirmed and private.question_import_valid_answer(k.answer_payload->'answer')) then raise exception 'IMPORT_KEYS_UNCONFIRMED'; end if;
    media:=null;
    if d.skill='listening' then
      select bd.media_version_id into media from public.question_import_batch_documents bd join public.lms_material_versions v on v.id=bd.media_version_id and v.material_id=bd.media_material_id where bd.id=d.document_id and bd.status='ready' and v.processing_status='ready';
      if media is null then raise exception 'IMPORT_MEDIA_NOT_READY'; end if;
    end if;
    s:=null;
    if jsonb_typeof(d.payload->'stimulus')='object' then
      insert into public.question_bank_stimuli(collection_id,club_id,stimulus_kind,payload,ordinal) values(p_collection_id,b.club_id,coalesce(d.payload->'stimulus'->>'kind','passage'),private.question_import_strip_answers(d.payload->'stimulus'),base+n+1) returning id into s;
    end if;
    insert into public.question_bank_items(collection_id,stimulus_id,source_draft_item_id,club_id,question_type,skill,ordinal,payload,source_evidence)
      values(p_collection_id,s,d.id,b.club_id,d.question_type,d.skill,base+n+1,private.question_import_strip_answers(d.payload)||case when media is not null then jsonb_build_object('audio_version_id',media) else '{}'::jsonb end,d.source_evidence) returning id into bi;
    if d.skill in ('listening','reading') then insert into public.question_bank_keys(bank_item_id,club_id,answer_payload) select bi,b.club_id,answer_payload from public.question_import_draft_keys where draft_item_id=d.id; end if;
    update public.question_import_draft_items set status='published' where id=d.id; n:=n+1;
  end loop;
  if n<>cardinality(p_item_ids) then raise exception 'IMPORT_PUBLISH_INCOMPLETE'; end if;
  if not exists(select 1 from public.question_import_draft_items where batch_id=p_batch_id and status='submitted') then update public.question_import_batches set status='completed',completed_at=now() where id=p_batch_id; end if;
  update public.question_bank_collections set status='published',published_at=coalesce(published_at,now()) where id=p_collection_id;
  insert into public.question_import_publication_receipts(club_id,batch_id,idempotency_key,published_count,collection_id,item_ids) values(b.club_id,p_batch_id,p_idempotency_key,n,p_collection_id,(select array_agg(x order by x) from unnest(p_item_ids) x));
  return n;
end $$;
create or replace function public.submit_question_import(p_batch_id uuid) returns void language plpgsql security definer set search_path=public,private,extensions as $$
declare b public.question_import_batches%rowtype; d public.question_import_draft_items%rowtype;
begin
  perform private.question_import_require_rate_limit('lms-question-import:submit',5,3600);
  select * into b from public.question_import_batches where id=p_batch_id for update;
  if b.id is null or b.created_by is distinct from auth.uid() or not private.question_import_is_teacher(b.club_id,auth.uid()) or b.status not in ('review','changes_requested') then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.question_import_batch_documents where batch_id=p_batch_id and status not in ('ready','failed')) then raise exception 'IMPORT_PROCESSING_INCOMPLETE'; end if;
  if not exists(select 1 from public.question_import_draft_items where batch_id=p_batch_id and status='accepted') or exists(select 1 from public.question_import_draft_items where batch_id=p_batch_id and status not in ('accepted','rejected','published')) then raise exception 'IMPORT_REVIEW_INCOMPLETE'; end if;
  for d in select * from public.question_import_draft_items where batch_id=p_batch_id and status='accepted' loop
    perform private.question_import_validate_payload(d.payload,d.question_type,d.skill,b.module);
    if d.source_lifecycle<>'active' or (d.skill in ('listening','reading') and not exists(select 1 from public.question_import_draft_keys k where k.draft_item_id=d.id and k.answer_confirmed and private.question_import_valid_answer(k.answer_payload->'answer'))) then raise exception 'IMPORT_KEYS_UNCONFIRMED'; end if;
  end loop;
  update public.question_import_draft_items set status='submitted' where batch_id=p_batch_id and status='accepted';
  update public.question_import_batches set status='submitted',submitted_at=now() where id=p_batch_id;
end $$;

create or replace function public.confirm_question_import_answer(p_draft_item_id uuid,p_answer_payload jsonb) returns void language plpgsql security definer set search_path=public,private,extensions as $$
declare d public.question_import_draft_items%rowtype; b public.question_import_batches%rowtype;
begin
  select bb.* into b from public.question_import_batches bb join public.question_import_draft_items di on di.batch_id=bb.id where di.id=p_draft_item_id for update of bb;
  select * into d from public.question_import_draft_items where id=p_draft_item_id for update;
  if d.id is null or b.created_by is distinct from auth.uid() or not private.question_import_is_teacher(b.club_id,auth.uid()) or d.skill not in ('listening','reading') or d.source_lifecycle<>'active' or d.status='published' or b.status not in ('review','changes_requested') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_answer_payload) is distinct from 'object' or not private.question_import_valid_answer(p_answer_payload->'answer') then raise exception 'IMPORT_ANSWER_REQUIRED'; end if;
  perform private.question_import_validate_payload(d.payload,d.question_type,d.skill,b.module);
  insert into public.question_import_draft_keys(draft_item_id,club_id,answer_payload,answer_confirmed,confirmed_by,confirmed_at) values(d.id,d.club_id,jsonb_build_object('answer',p_answer_payload->'answer'),true,auth.uid(),now()) on conflict(draft_item_id) do update set answer_payload=excluded.answer_payload,answer_confirmed=true,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at;
  update public.question_import_draft_items set answer_source='teacher_confirmed',reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
end $$;

revoke all on public.question_import_documents from public,anon,authenticated;
grant select,update on public.question_import_documents to service_role;
revoke all on function public.create_question_import_batch(uuid,text,public.ielts_module,text,text,uuid),public.reserve_question_import_quota(uuid,text,integer,integer,integer),public.reconcile_question_import_quota(uuid,text,integer,integer,integer),public.release_question_import_quota(uuid,text),public.submit_question_import(uuid),public.save_question_import_draft(uuid,jsonb,public.question_import_item_status,text),public.request_question_import_changes(uuid,text),public.publish_question_import_items(uuid,uuid,uuid[],text),public.mark_question_import_source_action(uuid,text,text),public.create_question_bank_collection(uuid,text,text,public.ielts_module),public.get_question_import_quota(uuid),public.confirm_question_import_answer(uuid,jsonb),public.register_question_import_material(uuid,uuid,uuid,uuid,uuid),public.claim_question_import_provider_job(uuid,uuid,integer,integer,text),public.persist_question_import_result(uuid,uuid,text,jsonb,jsonb,integer),public.release_question_import_worker_quota(uuid,text) from public,anon;
grant execute on function public.create_question_import_batch(uuid,text,public.ielts_module,text,text,uuid),public.reserve_question_import_quota(uuid,text,integer,integer,integer),public.reconcile_question_import_quota(uuid,text,integer,integer,integer),public.release_question_import_quota(uuid,text),public.submit_question_import(uuid),public.save_question_import_draft(uuid,jsonb,public.question_import_item_status,text),public.request_question_import_changes(uuid,text),public.publish_question_import_items(uuid,uuid,uuid[],text),public.mark_question_import_source_action(uuid,text,text),public.create_question_bank_collection(uuid,text,text,public.ielts_module),public.get_question_import_quota(uuid),public.confirm_question_import_answer(uuid,jsonb) to authenticated;
grant execute on function public.register_question_import_material(uuid,uuid,uuid,uuid,uuid),public.claim_question_import_provider_job(uuid,uuid,integer,integer,text),public.persist_question_import_result(uuid,uuid,text,jsonb,jsonb,integer),public.release_question_import_worker_quota(uuid,text) to service_role;
revoke all on function private.question_import_require_rate_limit(text,integer,integer) from public,anon,authenticated;

create or replace function private.question_import_valid_answer(a jsonb) returns boolean language plpgsql immutable set search_path=public,private,extensions as $$
begin
  if a is null or a='null'::jsonb then return false; end if;
  if jsonb_typeof(a)='string' then return length(btrim(a#>>'{}'))>0; end if;
  if jsonb_typeof(a)='array' then return jsonb_array_length(a)>0 and not exists(select 1 from jsonb_array_elements(a) x where not private.question_import_valid_answer(x)); end if;
  if jsonb_typeof(a)='object' then return a<>'{}'::jsonb and not exists(select 1 from jsonb_each(a) x where not private.question_import_valid_answer(x.value)); end if;
  return jsonb_typeof(a) in ('number','boolean');
end $$;

create or replace function private.question_import_validate_payload(p jsonb,t public.ielts_question_type,s public.ielts_skill,m public.ielts_module) returns void language plpgsql set search_path=public,private,extensions as $$
begin
  if jsonb_typeof(p) is distinct from 'object' or nullif(btrim(p->>'prompt'),'') is null then raise exception 'IMPORT_PROMPT_REQUIRED'; end if;
  if (t::text like 'writing_%') <> (s='writing') or (t::text like 'speaking_%') <> (s='speaking') then raise exception 'IMPORT_TYPE_SKILL_MISMATCH'; end if;
  if (t='writing_task1_academic' and m<>'academic') or (t='writing_task1_general' and m<>'general_training') then raise exception 'IMPORT_MODULE_MISMATCH'; end if;
  if p ? 'validation_issues' and p->'validation_issues' not in ('[]'::jsonb,'null'::jsonb) then raise exception 'IMPORT_VALIDATION_FAILED'; end if;
  if t::text in ('mcq_single','mcq_multi','matching_headings','matching_information','matching_features','matching_sentence_endings') then
    if jsonb_typeof(p->'options') is distinct from 'array' then raise exception 'IMPORT_OPTIONS_REQUIRED'; end if;
    if jsonb_array_length(p->'options')<2 then raise exception 'IMPORT_OPTIONS_REQUIRED'; end if;
  end if;
  if t::text in ('diagram_label','map_plan_label','writing_task1_academic') then
    if jsonb_typeof(p->'stimulus') is distinct from 'object' or p->'stimulus'='{}'::jsonb or coalesce((p->>'has_required_media')::boolean,false) is not true then raise exception 'IMPORT_VISUAL_REQUIRED'; end if;
  end if;
end $$;

revoke execute on function public.reserve_question_import_quota(uuid,text,integer,integer,integer),public.reconcile_question_import_quota(uuid,text,integer,integer,integer),public.release_question_import_quota(uuid,text) from authenticated;

commit;
