-- Shared, versioned AI knowledge platform.
--
-- This migration is deliberately additive: the legacy debate_corpus_* tables
-- remain the compatibility store for existing routes while newly ingested
-- evidence is governed by the same provenance, rights, review and embedding
-- rules across debate and IELTS.

create table if not exists public.ai_knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(trim(slug)) and slug ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  domain text not null check (domain in ('debate', 'ielts', 'coach')),
  language text not null check (language in ('en', 'vi', 'multilingual')),
  embedding_provider text not null,
  embedding_model text not null,
  embedding_dimensions integer not null default 1024 check (embedding_dimensions = 1024),
  active_version integer not null default 1 check (active_version > 0),
  retrieval_thresholds jsonb not null default '{"minSemanticSimilarity": 0.4, "lexicalCandidateCount": 24}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(retrieval_thresholds) = 'object')
);

create table if not exists public.ai_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  publisher text,
  title text,
  authority_tier text not null check (authority_tier in (
    'official', 'qualified_examiner_or_adjudicator', 'expert_educational',
    'community', 'ai_derived'
  )),
  rights_status text not null default 'requires_review' check (rights_status in (
    'approved_for_derived_use', 'approved_for_excerpt', 'public_domain',
    'requires_review', 'restricted', 'unknown'
  )),
  checksum text,
  captured_at timestamptz not null default now(),
  review_status text not null default 'candidate' check (review_status in (
    'candidate', 'needs_review', 'approved', 'rejected', 'superseded'
  )),
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.ai_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.ai_knowledge_collections(id) on delete restrict,
  source_id uuid not null references public.ai_knowledge_sources(id) on delete restrict,
  external_key text,
  collection_version integer not null check (collection_version > 0),
  item_kind text not null,
  language text not null check (language in ('en', 'vi', 'multilingual')),
  criterion text,
  band_min numeric(2, 1) check (band_min is null or (band_min >= 0 and band_min <= 9)),
  band_max numeric(2, 1) check (band_max is null or (band_max >= 0 and band_max <= 9)),
  task_type text,
  format text,
  source_locator text,
  permitted_excerpt text,
  structured_insight jsonb not null default '{}'::jsonb,
  usable_for text[] not null default '{}'::text[] check (
    usable_for <@ array['coaching', 'grading', 'research']::text[]
  ),
  review_status text not null default 'candidate' check (review_status in (
    'candidate', 'needs_review', 'approved', 'rejected', 'superseded'
  )),
  embedding_text text not null,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, external_key),
  check (band_min is null or band_max is null or band_min <= band_max),
  check (jsonb_typeof(structured_insight) = 'object'),
  check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.ai_knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.ai_knowledge_items(id) on delete cascade,
  collection_id uuid not null references public.ai_knowledge_collections(id) on delete cascade,
  provider text not null,
  model text not null,
  dimensions integer not null default 1024 check (dimensions = 1024),
  input_type text not null default 'document' check (input_type in ('document', 'query')),
  content_hash text not null,
  embedding extensions.vector(1024) not null,
  token_count_estimate integer check (token_count_estimate is null or token_count_estimate >= 0),
  embedded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, provider, model, dimensions, input_type)
);

create table if not exists public.ai_knowledge_retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.ai_knowledge_collections(id) on delete restrict,
  workflow_run_id uuid references public.ai_workflow_runs(id) on delete set null,
  ai_quality_run_id uuid references public.ai_quality_runs(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  source_route text,
  query_hash text not null,
  query_preview text,
  provider text not null,
  model text not null,
  dimensions integer not null default 1024 check (dimensions = 1024),
  filters jsonb not null default '{}'::jsonb,
  returned_evidence jsonb not null default '[]'::jsonb,
  relevance_measurements jsonb not null default '{}'::jsonb,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(filters) = 'object'),
  check (jsonb_typeof(returned_evidence) = 'array'),
  check (jsonb_typeof(relevance_measurements) = 'object')
);

-- Benchmark labels are intentionally never available to authenticated users.
-- This prevents a learner-facing client or admin screen from leaking gold
-- scores into retrieval, prompts or the browser.
create table if not exists public.ai_grading_benchmarks (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.ai_knowledge_collections(id) on delete restrict,
  source_id uuid references public.ai_knowledge_sources(id) on delete restrict,
  benchmark_key text not null,
  skill text not null check (skill in ('ielts_speaking', 'ielts_writing', 'debate')),
  task_type text,
  band_or_score_range text,
  accent_group text,
  protected_label jsonb not null,
  split text not null default 'evaluation' check (split in ('evaluation', 'holdout', 'development')),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, benchmark_key),
  check (jsonb_typeof(protected_label) = 'object'),
  check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.ai_grading_evaluations (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid not null references public.ai_grading_benchmarks(id) on delete cascade,
  grader_version text not null,
  corpus_version integer not null check (corpus_version > 0),
  prediction jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  run_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (benchmark_id, grader_version, corpus_version),
  check (jsonb_typeof(prediction) = 'object'),
  check (jsonb_typeof(metrics) = 'object'),
  check (jsonb_typeof(run_metadata) = 'object')
);

create index if not exists ai_knowledge_sources_review_authority_idx
  on public.ai_knowledge_sources(review_status, authority_tier, rights_status);
create index if not exists ai_knowledge_items_retrieval_filter_idx
  on public.ai_knowledge_items(collection_id, collection_version, review_status, language, criterion, task_type, format);
create index if not exists ai_knowledge_items_usable_for_idx
  on public.ai_knowledge_items using gin (usable_for);
create index if not exists ai_knowledge_items_structured_insight_idx
  on public.ai_knowledge_items using gin (structured_insight);
create index if not exists ai_knowledge_items_embedding_text_fts_idx
  on public.ai_knowledge_items using gin (to_tsvector('simple', embedding_text));
create index if not exists ai_knowledge_embeddings_lookup_idx
  on public.ai_knowledge_embeddings(collection_id, provider, model, dimensions, content_hash);
create index if not exists ai_knowledge_embeddings_hnsw_idx
  on public.ai_knowledge_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists ai_knowledge_retrieval_logs_collection_created_idx
  on public.ai_knowledge_retrieval_logs(collection_id, created_at desc);
create index if not exists ai_knowledge_retrieval_logs_workflow_idx
  on public.ai_knowledge_retrieval_logs(workflow_run_id) where workflow_run_id is not null;
create index if not exists ai_grading_benchmarks_lookup_idx
  on public.ai_grading_benchmarks(collection_id, skill, split, is_active);
create index if not exists ai_grading_evaluations_benchmark_idx
  on public.ai_grading_evaluations(benchmark_id, created_at desc);

-- An embedding can only be written using the exact model configured for its
-- collection.  This makes cross-provider/vector-space comparisons impossible
-- even if a future caller forgets a SQL filter.
create or replace function private.validate_ai_knowledge_embedding()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_collection_id uuid;
  v_provider text;
  v_model text;
  v_dimensions integer;
begin
  select item.collection_id into v_collection_id
  from public.ai_knowledge_items item
  where item.id = new.item_id;

  if v_collection_id is null or v_collection_id <> new.collection_id then
    raise exception 'AI knowledge embedding collection must match its item';
  end if;

  select embedding_provider, embedding_model, embedding_dimensions
    into v_provider, v_model, v_dimensions
  from public.ai_knowledge_collections
  where id = new.collection_id;

  if new.provider <> v_provider or new.model <> v_model or new.dimensions <> v_dimensions then
    raise exception 'AI knowledge embedding model must match its collection configuration';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_ai_knowledge_embedding on public.ai_knowledge_embeddings;
create trigger validate_ai_knowledge_embedding
  before insert or update of item_id, collection_id, provider, model, dimensions
  on public.ai_knowledge_embeddings
  for each row execute function private.validate_ai_knowledge_embedding();

-- Keep an already embedded item in its original vector space. A collection's
-- active version may move forward, but changing its embedding configuration
-- requires a new collection (or a deliberate re-embedding migration).
create or replace function private.prevent_ai_knowledge_vector_space_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_table_name = 'ai_knowledge_items'
    and new.collection_id is distinct from old.collection_id
    and exists (select 1 from public.ai_knowledge_embeddings embedding where embedding.item_id = old.id) then
    raise exception 'Cannot move an embedded AI knowledge item to another collection';
  end if;

  if tg_table_name = 'ai_knowledge_collections'
    and (
      new.embedding_provider is distinct from old.embedding_provider
      or new.embedding_model is distinct from old.embedding_model
      or new.embedding_dimensions is distinct from old.embedding_dimensions
    )
    and exists (select 1 from public.ai_knowledge_embeddings embedding where embedding.collection_id = old.id) then
    raise exception 'Cannot change an AI knowledge collection embedding configuration after embeddings exist';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_ai_knowledge_item_collection_change on public.ai_knowledge_items;
create trigger prevent_ai_knowledge_item_collection_change
  before update of collection_id on public.ai_knowledge_items
  for each row execute function private.prevent_ai_knowledge_vector_space_mutation();

drop trigger if exists prevent_ai_knowledge_collection_embedding_change on public.ai_knowledge_collections;
create trigger prevent_ai_knowledge_collection_embedding_change
  before update of embedding_provider, embedding_model, embedding_dimensions on public.ai_knowledge_collections
  for each row execute function private.prevent_ai_knowledge_vector_space_mutation();

-- Hybrid lexical and semantic retrieval. The caller supplies a query vector
-- generated by the collection's model; this function refuses model/provider
-- mismatches and only returns approved, rights-cleared content. `forGrading`
-- applies the narrower authority/usage gate required for score evidence.
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
      collection.active_version,
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
      and item.collection_version <= params.active_version
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
    (
      0.75 * candidates.semantic_similarity
      + 0.25 * least(candidates.lexical_score, 1::double precision)
    )::double precision as relevance_score
    ,array_remove(array[
      case when candidates.lexical_score = 0 then 'no_lexical_match' end,
      case when candidates.semantic_similarity < coalesce(
        (candidates_thresholds.retrieval_thresholds ->> 'minSemanticSimilarity')::double precision,
        0.4
      ) then 'below_collection_semantic_threshold' end
    ], null)::text[] as retrieval_limitations
  from candidates
  join params candidates_thresholds on candidates_thresholds.collection_slug = candidates.collection_slug
  where candidates.semantic_similarity >= coalesce(
    (candidates_thresholds.retrieval_thresholds ->> 'minSemanticSimilarity')::double precision,
    0.4
  )
  order by relevance_score desc, candidates.semantic_similarity desc, candidates.evidence_id
  limit least(greatest(p_match_count, 1), 24);
$$;

comment on function public.search_ai_knowledge_hybrid(extensions.vector, text, text, text, text, integer, jsonb) is
  'Service-role hybrid retrieval. Filters by a collection''s exact provider/model and only exposes approved, rights-cleared evidence; forGrading additionally requires official or qualified scoring authority.';

-- Four collection configurations. Vector spaces are deliberately isolated;
-- every matching query must present the exact provider and model shown here.
insert into public.ai_knowledge_collections (
  slug, domain, language, embedding_provider, embedding_model, embedding_dimensions, active_version, retrieval_thresholds
) values
  ('debate.vi.truong_teen', 'debate', 'vi', 'self_hosted', 'AITeamVN/Vietnamese_Embedding', 1024, 1, '{"minSemanticSimilarity": 0.4, "lexicalCandidateCount": 24}'::jsonb),
  ('debate.en.competitive', 'debate', 'en', 'voyage', 'voyage-4-large', 1024, 1, '{"minSemanticSimilarity": 0.45, "lexicalCandidateCount": 24}'::jsonb),
  ('ielts.speaking', 'ielts', 'en', 'voyage', 'voyage-4-large', 1024, 1, '{"minSemanticSimilarity": 0.45, "lexicalCandidateCount": 24}'::jsonb),
  ('ielts.writing', 'ielts', 'en', 'voyage', 'voyage-4-large', 1024, 1, '{"minSemanticSimilarity": 0.45, "lexicalCandidateCount": 24}'::jsonb)
on conflict (slug) do update set
  domain = excluded.domain,
  language = excluded.language,
  embedding_provider = excluded.embedding_provider,
  embedding_model = excluded.embedding_model,
  embedding_dimensions = excluded.embedding_dimensions,
  retrieval_thresholds = excluded.retrieval_thresholds,
  updated_at = now();

-- Backfill the legacy Vietnamese corpus as review-required coaching material.
-- Existing routes keep using their legacy tables; these records must be
-- explicitly rights-reviewed and approved before generic retrieval can use
-- them, and they are never labelled grading evidence by this migration.
insert into public.ai_knowledge_sources (
  canonical_url, publisher, title, authority_tier, rights_status, checksum,
  captured_at, review_status, metadata
)
select distinct on (legacy_source.youtube_url)
  legacy_source.youtube_url,
  'Legacy DebateLab corpus',
  legacy_source.video_title,
  'expert_educational',
  'requires_review',
  nullif(legacy_source.metadata ->> 'checksum', ''),
  coalesce(legacy_source.created_at, now()),
  'needs_review',
  jsonb_build_object('legacyDebateCorpusSourceId', legacy_source.id)
from public.debate_corpus_sources legacy_source
where nullif(trim(legacy_source.youtube_url), '') is not null
order by legacy_source.youtube_url, legacy_source.created_at asc
on conflict (canonical_url) do nothing;

insert into public.ai_knowledge_sources (
  canonical_url, publisher, title, authority_tier, rights_status, review_status, metadata
) values (
  'urn:debatelab:legacy-corpus:unattributed',
  'Legacy DebateLab corpus',
  'Unattributed legacy corpus item',
  'community',
  'requires_review',
  'needs_review',
  '{"legacy": true}'::jsonb
)
on conflict (canonical_url) do nothing;

insert into public.ai_knowledge_items (
  collection_id, source_id, external_key, collection_version, item_kind,
  language, task_type, format, source_locator, structured_insight, usable_for,
  review_status, embedding_text, content_hash, metadata, created_at, updated_at
)
select
  collection.id,
  coalesce(generic_source.id, unattributed_source.id),
  'legacy-debate-item:' || legacy_item.id::text,
  1,
  legacy_item.item_type,
  legacy_item.language,
  legacy_item.item_type,
  coalesce(legacy_item.content ->> 'format', 'truong_teen'),
  coalesce(legacy_item.content ->> 'timestamp', legacy_item.source_match_key),
  jsonb_build_object('legacyContent', legacy_item.content, 'legacyMetadata', legacy_item.metadata),
  array['coaching']::text[],
  'needs_review',
  legacy_item.embedding_text,
  legacy_item.content_hash,
  jsonb_build_object('legacyDebateCorpusItemId', legacy_item.id),
  legacy_item.created_at,
  legacy_item.updated_at
from public.debate_corpus_items legacy_item
join public.ai_knowledge_collections collection
  on collection.slug = 'debate.vi.truong_teen'
left join public.debate_corpus_sources legacy_source on legacy_source.id = legacy_item.source_id
left join public.ai_knowledge_sources generic_source on generic_source.canonical_url = legacy_source.youtube_url
join public.ai_knowledge_sources unattributed_source
  on unattributed_source.canonical_url = 'urn:debatelab:legacy-corpus:unattributed'
where legacy_item.language = 'vi'
on conflict (collection_id, external_key) do nothing;

insert into public.ai_knowledge_embeddings (
  item_id, collection_id, provider, model, dimensions, input_type, content_hash,
  embedding, token_count_estimate, embedded_at, created_at, updated_at
)
select
  generic_item.id,
  generic_item.collection_id,
  legacy_embedding.provider,
  legacy_embedding.model,
  legacy_embedding.dimensions,
  legacy_embedding.input_type,
  legacy_embedding.content_hash,
  legacy_embedding.embedding,
  legacy_embedding.token_count_estimate,
  legacy_embedding.embedded_at,
  legacy_embedding.created_at,
  legacy_embedding.updated_at
from public.debate_corpus_embeddings legacy_embedding
join public.ai_knowledge_items generic_item
  on generic_item.external_key = 'legacy-debate-item:' || legacy_embedding.item_id::text
join public.ai_knowledge_collections collection on collection.id = generic_item.collection_id
where collection.slug = 'debate.vi.truong_teen'
  and legacy_embedding.provider = collection.embedding_provider
  and legacy_embedding.model = collection.embedding_model
  and legacy_embedding.dimensions = collection.embedding_dimensions
  and legacy_embedding.input_type = 'document'
  and legacy_embedding.content_hash = generic_item.content_hash
on conflict (item_id, provider, model, dimensions, input_type) do nothing;

-- Public response metadata supports reproducible, confidence-aware grading
-- without changing the established IELTS response RLS policies.
alter table public.writing_responses
  add column if not exists grading_metadata jsonb not null default '{}'::jsonb;
alter table public.speaking_responses
  add column if not exists grading_metadata jsonb not null default '{}'::jsonb;
alter table public.writing_responses
  drop constraint if exists writing_responses_grading_metadata_object;
alter table public.writing_responses
  add constraint writing_responses_grading_metadata_object
  check (jsonb_typeof(grading_metadata) = 'object') not valid;
alter table public.speaking_responses
  drop constraint if exists speaking_responses_grading_metadata_object;
alter table public.speaking_responses
  add constraint speaking_responses_grading_metadata_object
  check (jsonb_typeof(grading_metadata) = 'object') not valid;

comment on column public.writing_responses.grading_metadata is
  'Staged grader provenance: gradingVersion, corpusVersion, criterion evidence, confidence/limitations and retry-safe workflow run id.';
comment on column public.speaking_responses.grading_metadata is
  'Staged grader provenance: gradingVersion, corpusVersion, acoustic limitations, criterion evidence, confidence and retry-safe workflow run id.';

alter table public.ai_knowledge_collections enable row level security;
alter table public.ai_knowledge_sources enable row level security;
alter table public.ai_knowledge_items enable row level security;
alter table public.ai_knowledge_embeddings enable row level security;
alter table public.ai_knowledge_retrieval_logs enable row level security;
alter table public.ai_grading_benchmarks enable row level security;
alter table public.ai_grading_evaluations enable row level security;

-- Knowledge curation may be administered by an authenticated admin. Runtime
-- retrieval, logging and benchmark labels are service-role only.
drop policy if exists "Admins manage AI knowledge collections" on public.ai_knowledge_collections;
create policy "Admins manage AI knowledge collections" on public.ai_knowledge_collections
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
drop policy if exists "Admins manage AI knowledge sources" on public.ai_knowledge_sources;
create policy "Admins manage AI knowledge sources" on public.ai_knowledge_sources
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
drop policy if exists "Admins manage AI knowledge items" on public.ai_knowledge_items;
create policy "Admins manage AI knowledge items" on public.ai_knowledge_items
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
drop policy if exists "Admins manage AI knowledge embeddings" on public.ai_knowledge_embeddings;
create policy "Admins manage AI knowledge embeddings" on public.ai_knowledge_embeddings
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
drop policy if exists "Admins view AI knowledge retrieval logs" on public.ai_knowledge_retrieval_logs;
create policy "Admins view AI knowledge retrieval logs" on public.ai_knowledge_retrieval_logs
  for select to authenticated
  using (private.is_admin((select auth.uid())));

revoke all on public.ai_knowledge_collections from anon, authenticated;
revoke all on public.ai_knowledge_sources from anon, authenticated;
revoke all on public.ai_knowledge_items from anon, authenticated;
revoke all on public.ai_knowledge_embeddings from anon, authenticated;
revoke all on public.ai_knowledge_retrieval_logs from anon, authenticated;
revoke all on public.ai_grading_benchmarks from anon, authenticated;
revoke all on public.ai_grading_evaluations from anon, authenticated;
grant select, insert, update, delete on public.ai_knowledge_collections to authenticated;
grant select, insert, update, delete on public.ai_knowledge_sources to authenticated;
grant select, insert, update, delete on public.ai_knowledge_items to authenticated;
grant select, insert, update, delete on public.ai_knowledge_embeddings to authenticated;
grant select on public.ai_knowledge_retrieval_logs to authenticated;
grant all on public.ai_knowledge_collections to service_role;
grant all on public.ai_knowledge_sources to service_role;
grant all on public.ai_knowledge_items to service_role;
grant all on public.ai_knowledge_embeddings to service_role;
grant all on public.ai_knowledge_retrieval_logs to service_role;
grant all on public.ai_grading_benchmarks to service_role;
grant all on public.ai_grading_evaluations to service_role;

revoke all on function public.search_ai_knowledge_hybrid(
  extensions.vector, text, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.search_ai_knowledge_hybrid(
  extensions.vector, text, text, text, text, integer, jsonb
) to service_role;
