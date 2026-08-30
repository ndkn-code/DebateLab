-- Operational controls for the shared AI knowledge platform.
--
-- A collection version is first populated as a draft, independently reviewed,
-- and then published atomically. Runtime retrieval uses only one exact version,
-- rather than a mixture of historical records.

create table if not exists public.ai_knowledge_collection_versions (
  collection_id uuid not null references public.ai_knowledge_collections(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded', 'rejected')),
  import_key text,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_id, version),
  -- Baseline versions predate this audit table and have no attributable
  -- publisher; every new publication is enforced by the RPC below.
  check ((status = 'published' and published_at is not null) or status <> 'published'),
  check (reviewed_by is null or submitted_by is null or reviewed_by <> submitted_by)
);

insert into public.ai_knowledge_collection_versions (
  collection_id, version, status, submitted_at, reviewed_at, published_at,
  review_notes
)
select id, active_version, 'published', created_at, created_at, created_at,
  'Baseline collection version created by operational controls migration.'
from public.ai_knowledge_collections
on conflict (collection_id, version) do nothing;

alter table public.ai_knowledge_sources
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.ai_knowledge_items
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- A canonical page may change over time. Preserve each captured revision as a
-- separate immutable source instead of rewriting provenance shared by a
-- published version.
update public.ai_knowledge_sources
set checksum = encode(extensions.digest(canonical_url, 'sha256'), 'hex')
where checksum is null;
alter table public.ai_knowledge_sources
  alter column checksum set not null;
alter table public.ai_knowledge_sources
  drop constraint if exists ai_knowledge_sources_canonical_url_key;
alter table public.ai_knowledge_sources
  add constraint ai_knowledge_sources_canonical_checksum_key
  unique (canonical_url, checksum);

create or replace function private.prevent_ai_knowledge_self_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reviewed_by is not null
    and new.submitted_by is not null
    and new.reviewed_by = new.submitted_by then
    raise exception 'AI knowledge importer and reviewer must be different people';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_ai_knowledge_source_self_review on public.ai_knowledge_sources;
create trigger prevent_ai_knowledge_source_self_review
  before insert or update of submitted_by, reviewed_by on public.ai_knowledge_sources
  for each row execute function private.prevent_ai_knowledge_self_review();
drop trigger if exists prevent_ai_knowledge_item_self_review on public.ai_knowledge_items;
create trigger prevent_ai_knowledge_item_self_review
  before insert or update of submitted_by, reviewed_by on public.ai_knowledge_items
  for each row execute function private.prevent_ai_knowledge_self_review();

-- Source provenance is shared by collection versions. Once a source is used by
-- a published version, a later draft must not rewrite its authority, rights,
-- checksum, review decision, or canonical identity in place.
create or replace function private.prevent_published_ai_knowledge_source_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.ai_knowledge_items item
    join public.ai_knowledge_collection_versions version
      on version.collection_id = item.collection_id
      and version.version = item.collection_version
    where item.source_id = old.id
      and version.status in ('published', 'superseded')
  ) then
    raise exception 'Published AI knowledge source provenance is immutable; create a new source revision';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists prevent_published_ai_knowledge_source_mutation on public.ai_knowledge_sources;
create trigger prevent_published_ai_knowledge_source_mutation
  before update or delete on public.ai_knowledge_sources
  for each row execute function private.prevent_published_ai_knowledge_source_mutation();

create or replace function private.prevent_published_ai_knowledge_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.ai_knowledge_collection_versions version
    where version.collection_id = case when tg_op = 'INSERT' then new.collection_id else old.collection_id end
      and version.version = case when tg_op = 'INSERT' then new.collection_version else old.collection_version end
      and version.status in ('published', 'superseded')
  ) then
    raise exception 'Published AI knowledge items are immutable; create a new collection version';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists prevent_published_ai_knowledge_item_mutation on public.ai_knowledge_items;
create trigger prevent_published_ai_knowledge_item_mutation
  before insert or update or delete on public.ai_knowledge_items
  for each row execute function private.prevent_published_ai_knowledge_item_mutation();

alter table public.ai_knowledge_items
  drop constraint if exists ai_knowledge_items_collection_version_fkey;
alter table public.ai_knowledge_items
  add constraint ai_knowledge_items_collection_version_fkey
  foreign key (collection_id, collection_version)
  references public.ai_knowledge_collection_versions(collection_id, version)
  deferrable initially immediate;

create index if not exists ai_knowledge_collection_versions_status_idx
  on public.ai_knowledge_collection_versions(collection_id, status, version desc);

-- Creates or resumes one explicit draft. It deliberately refuses mutation of
-- the active/published version, so an importer cannot alter learner-visible
-- knowledge before a separate reviewer publishes it.
create or replace function public.prepare_ai_knowledge_collection_draft(
  p_collection_slug text,
  p_version integer,
  p_import_key text,
  p_submitted_by uuid default null
)
returns table (collection_id uuid, version integer, language text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection public.ai_knowledge_collections%rowtype;
  v_existing public.ai_knowledge_collection_versions%rowtype;
begin
  if p_version is null or p_version < 1 then
    raise exception 'Knowledge draft version must be a positive integer';
  end if;

  select * into v_collection
  from public.ai_knowledge_collections
  where slug = p_collection_slug
  for update;
  if not found then
    raise exception 'Unknown AI knowledge collection: %', p_collection_slug;
  end if;
  if p_version <= v_collection.active_version then
    raise exception 'Draft version % must be greater than active version %', p_version, v_collection.active_version;
  end if;

  select * into v_existing
  from public.ai_knowledge_collection_versions
  where ai_knowledge_collection_versions.collection_id = v_collection.id
    and ai_knowledge_collection_versions.version = p_version;
  if found and v_existing.status <> 'draft' then
    raise exception 'Collection version % is not a mutable draft', p_version;
  end if;
  if found and v_existing.submitted_by is not null
    and p_submitted_by is distinct from v_existing.submitted_by then
    raise exception 'Only the original importer can resume this AI knowledge draft';
  end if;

  insert into public.ai_knowledge_collection_versions (
    collection_id, version, status, import_key, submitted_by
  ) values (
    v_collection.id, p_version, 'draft', p_import_key, p_submitted_by
  ) on conflict (collection_id, version) do update set
    import_key = excluded.import_key,
    updated_at = now();

  return query select v_collection.id, p_version, v_collection.language;
end;
$$;

-- Publishes only a reviewed, rights-cleared draft. This locks the collection,
-- retires the prior published row, and switches active_version in one database
-- transaction. Grading evidence has the stricter official/qualified authority
-- requirement at publish time as well as at retrieval time.
create or replace function public.publish_ai_knowledge_collection_version(
  p_collection_slug text,
  p_version integer,
  p_reviewer_id uuid,
  p_review_notes text default null
)
returns table (collection_id uuid, version integer, published_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection public.ai_knowledge_collections%rowtype;
  v_version public.ai_knowledge_collection_versions%rowtype;
  v_now timestamptz := now();
begin
  if p_reviewer_id is null then
    raise exception 'A reviewer is required to publish AI knowledge';
  end if;
  select * into v_collection
  from public.ai_knowledge_collections
  where slug = p_collection_slug
  for update;
  if not found then
    raise exception 'Unknown AI knowledge collection: %', p_collection_slug;
  end if;
  select * into v_version
  from public.ai_knowledge_collection_versions
  where ai_knowledge_collection_versions.collection_id = v_collection.id
    and ai_knowledge_collection_versions.version = p_version
  for update;
  if not found or v_version.status <> 'draft' then
    raise exception 'Only a draft AI knowledge collection version can be published';
  end if;
  if v_version.submitted_by is not null and v_version.submitted_by = p_reviewer_id then
    raise exception 'Importer and reviewer must be different people';
  end if;
  if not exists (
    select 1 from public.ai_knowledge_items item
    join public.ai_knowledge_sources source on source.id = item.source_id
    where item.collection_id = v_collection.id
      and item.collection_version = p_version
  ) then
    raise exception 'Cannot publish an empty AI knowledge collection version';
  end if;
  if exists (
    select 1 from public.ai_knowledge_items item
    join public.ai_knowledge_sources source on source.id = item.source_id
    where item.collection_id = v_collection.id
      and item.collection_version = p_version
      and (
        item.review_status <> 'approved'
        or source.review_status <> 'approved'
        or item.reviewed_by is null
        or source.reviewed_by is null
        or source.rights_status not in ('approved_for_derived_use', 'approved_for_excerpt', 'public_domain')
        or (item.reviewed_by is not null and item.reviewed_by = item.submitted_by)
        or (source.reviewed_by is not null and source.reviewed_by = source.submitted_by)
        or (
          'grading' = any(item.usable_for)
          and source.authority_tier not in ('official', 'qualified_examiner_or_adjudicator')
        )
      )
  ) then
    raise exception 'Draft contains unapproved, unlicensed, self-reviewed, or non-authoritative grading evidence';
  end if;
  if exists (
    select 1 from public.ai_knowledge_items item
    where item.collection_id = v_collection.id
      and item.collection_version = p_version
      and not exists (
        select 1 from public.ai_knowledge_embeddings embedding
        where embedding.item_id = item.id
          and embedding.collection_id = item.collection_id
          and embedding.provider = v_collection.embedding_provider
          and embedding.model = v_collection.embedding_model
          and embedding.dimensions = v_collection.embedding_dimensions
          and embedding.input_type = 'document'
          and embedding.content_hash = item.content_hash
      )
  ) then
    raise exception 'Draft contains items without a current collection embedding';
  end if;

  update public.ai_knowledge_collection_versions
  set status = 'superseded', updated_at = v_now
  where collection_id = v_collection.id and status = 'published';
  update public.ai_knowledge_collection_versions
  set status = 'published', reviewed_by = p_reviewer_id, reviewed_at = v_now,
      published_by = p_reviewer_id, published_at = v_now,
      review_notes = coalesce(p_review_notes, review_notes), updated_at = v_now
  where collection_id = v_collection.id and version = p_version;
  update public.ai_knowledge_collections
  set active_version = p_version, updated_at = v_now
  where id = v_collection.id;

  return query select v_collection.id, p_version, v_now;
end;
$$;

-- A source may be used for either retrieval corpus or a locked benchmark, but
-- never both while both records are active. This prevents retrieval leakage
-- from a holdout benchmark even if a future importer ignores process docs.
create or replace function private.prevent_ai_benchmark_source_leakage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active and new.source_id is not null and exists (
    select 1
    from public.ai_knowledge_items item
    join public.ai_knowledge_collection_versions version
      on version.collection_id = item.collection_id
      and version.version = item.collection_version
    where item.source_id = new.source_id
      and item.review_status = 'approved'
      and version.status in ('published', 'superseded')
  ) then
    raise exception 'A benchmark source cannot also be active published retrieval evidence';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_ai_benchmark_source_leakage on public.ai_grading_benchmarks;
create trigger prevent_ai_benchmark_source_leakage
  before insert or update of source_id, is_active on public.ai_grading_benchmarks
  for each row execute function private.prevent_ai_benchmark_source_leakage();

create or replace function private.prevent_ai_knowledge_source_benchmark_leakage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.review_status = 'approved' and exists (
    select 1 from public.ai_grading_benchmarks benchmark
    where benchmark.source_id = new.source_id and benchmark.is_active
  ) then
    raise exception 'A source reserved for an active benchmark cannot be approved for retrieval';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_ai_knowledge_source_benchmark_leakage on public.ai_knowledge_items;
create trigger prevent_ai_knowledge_source_benchmark_leakage
  before insert or update of source_id, review_status on public.ai_knowledge_items
  for each row execute function private.prevent_ai_knowledge_source_benchmark_leakage();

alter table public.ai_knowledge_collection_versions enable row level security;
drop policy if exists "Service role manages AI knowledge collection versions"
  on public.ai_knowledge_collection_versions;
create policy "Service role manages AI knowledge collection versions"
  on public.ai_knowledge_collection_versions
  for all to service_role
  using (true)
  with check (true);
revoke all on public.ai_knowledge_collection_versions from anon, authenticated;
grant all on public.ai_knowledge_collection_versions to service_role;
revoke all on function public.prepare_ai_knowledge_collection_draft(text, integer, text, uuid)
  from public, anon, authenticated;
revoke all on function public.publish_ai_knowledge_collection_version(text, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function public.prepare_ai_knowledge_collection_draft(text, integer, text, uuid) to service_role;
grant execute on function public.publish_ai_knowledge_collection_version(text, integer, uuid, text) to service_role;

-- Replace the broad "<= active version" lookup with an exact version lookup.
-- A caller can explicitly pin p_filters.collectionVersion for a benchmark
-- replay; ordinary learner traffic gets the currently published active version.
create or replace function public.search_ai_knowledge_hybrid(
  p_query_embedding extensions.vector(1024),
  p_query_text text,
  p_collection_slug text,
  p_provider text,
  p_model text,
  p_match_count integer default 8,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  evidence_id uuid,
  source_id uuid,
  collection_slug text,
  collection_version integer,
  item_kind text,
  criterion text,
  band_min numeric,
  band_max numeric,
  task_type text,
  format text,
  source_locator text,
  canonical_url text,
  authority_tier text,
  permitted_excerpt text,
  structured_insight jsonb,
  semantic_similarity double precision,
  lexical_score double precision,
  relevance_score double precision,
  retrieval_limitations text[]
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with params as (
    select
      collection.id as collection_id,
      collection.slug as collection_slug,
      coalesce(nullif(p_filters ->> 'collectionVersion', '')::integer, collection.active_version) as required_collection_version,
      collection.retrieval_thresholds,
      websearch_to_tsquery('simple', trim(coalesce(p_query_text, ''))) as ts_query,
      coalesce((p_filters ->> 'forGrading')::boolean, false) as for_grading,
      coalesce(p_filters ->> 'language', collection.language) as required_language,
      nullif(p_filters ->> 'criterion', '') as required_criterion,
      nullif(p_filters ->> 'taskType', '') as required_task_type,
      nullif(p_filters ->> 'format', '') as required_format,
      case when jsonb_typeof(coalesce(p_filters -> 'itemKinds', '[]'::jsonb)) = 'array'
        then coalesce(p_filters -> 'itemKinds', '[]'::jsonb)
        else '[]'::jsonb
      end as required_item_kinds,
      coalesce(p_filters ->> 'usage', case when coalesce((p_filters ->> 'forGrading')::boolean, false) then 'grading' else 'coaching' end) as required_usage,
      nullif(p_filters ->> 'minBand', '')::numeric as min_band,
      nullif(p_filters ->> 'maxBand', '')::numeric as max_band
    from public.ai_knowledge_collections collection
    join public.ai_knowledge_collection_versions version
      on version.collection_id = collection.id
      and version.version = coalesce(nullif(p_filters ->> 'collectionVersion', '')::integer, collection.active_version)
      and version.status in ('published', 'superseded')
    where collection.slug = p_collection_slug
      and collection.is_active
      and collection.embedding_provider = p_provider
      and collection.embedding_model = p_model
      and collection.embedding_dimensions = 1024
  ), candidates as (
    select
      item.id as evidence_id,
      source.id as source_id,
      params.collection_slug,
      item.collection_version,
      item.item_kind,
      item.criterion,
      item.band_min,
      item.band_max,
      item.task_type,
      item.format,
      item.source_locator,
      source.canonical_url,
      source.authority_tier,
      item.permitted_excerpt,
      item.structured_insight,
      (1 - (embedding.embedding <=> p_query_embedding))::double precision as semantic_similarity,
      case when coalesce(trim(p_query_text), '') = '' then 0::double precision else
        ts_rank_cd(to_tsvector('simple', item.embedding_text), params.ts_query, 32)::double precision
      end as lexical_score
    from params
    join public.ai_knowledge_items item
      on item.collection_id = params.collection_id
      and item.collection_version = params.required_collection_version
    join public.ai_knowledge_sources source on source.id = item.source_id
    join public.ai_knowledge_embeddings embedding
      on embedding.item_id = item.id
      and embedding.collection_id = params.collection_id
      and embedding.provider = p_provider
      and embedding.model = p_model
      and embedding.dimensions = 1024
      and embedding.input_type = 'document'
      and embedding.content_hash = item.content_hash
    where item.review_status = 'approved'
      and source.review_status = 'approved'
      and source.rights_status in ('approved_for_derived_use', 'approved_for_excerpt', 'public_domain')
      and item.language in (params.required_language, 'multilingual')
      and (params.required_criterion is null or item.criterion = params.required_criterion)
      and (params.required_task_type is null or item.task_type = params.required_task_type)
      and (params.required_format is null or item.format = params.required_format)
      and (jsonb_array_length(params.required_item_kinds) = 0 or params.required_item_kinds ? item.item_kind)
      and params.required_usage = any(item.usable_for)
      and (params.min_band is null or item.band_max is null or item.band_max >= params.min_band)
      and (params.max_band is null or item.band_min is null or item.band_min <= params.max_band)
      and (
        not params.for_grading
        or (
          'grading' = any(item.usable_for)
          and source.authority_tier in ('official', 'qualified_examiner_or_adjudicator')
        )
      )
  )
  select
    candidates.evidence_id,
    candidates.source_id,
    candidates.collection_slug,
    candidates.collection_version,
    candidates.item_kind,
    candidates.criterion,
    candidates.band_min,
    candidates.band_max,
    candidates.task_type,
    candidates.format,
    candidates.source_locator,
    candidates.canonical_url,
    candidates.authority_tier,
    candidates.permitted_excerpt,
    candidates.structured_insight,
    candidates.semantic_similarity,
    candidates.lexical_score,
    (0.75 * candidates.semantic_similarity + 0.25 * least(candidates.lexical_score, 1::double precision))::double precision as relevance_score,
    array_remove(array[
      case when candidates.lexical_score = 0 then 'no_lexical_match' end
    ], null)::text[] as retrieval_limitations
  from candidates
  join params thresholds on thresholds.collection_slug = candidates.collection_slug
  where candidates.semantic_similarity >= coalesce(
    (thresholds.retrieval_thresholds ->> 'minSemanticSimilarity')::double precision,
    0.4
  )
  order by relevance_score desc, candidates.semantic_similarity desc, candidates.evidence_id
  limit least(greatest(p_match_count, 1), 24);
$$;
