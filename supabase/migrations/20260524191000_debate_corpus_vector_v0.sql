-- Private curated debate corpus storage and pgvector retrieval for Phase 2A.

create extension if not exists vector with schema extensions;

create table if not exists public.debate_corpus_sources (
  id text primary key,
  youtube_url text not null,
  youtube_video_id text,
  video_title text not null,
  source_type text not null check (
    source_type in ('single_match_episode', 'multi_match_compilation', 'highlight_reel', 'unclear')
  ),
  season integer,
  episode text,
  stage text,
  language text not null default 'vi' check (language in ('en', 'vi')),
  transcript_quality text not null check (
    transcript_quality in ('excellent', 'good', 'medium', 'poor')
  ),
  overall_confidence numeric(5, 4) not null default 0 check (
    overall_confidence >= 0 and overall_confidence <= 1
  ),
  recommended_import_status text not null default 'needs_review' check (
    recommended_import_status in ('approved', 'needs_review', 'do_not_import')
  ),
  recommended_use text[] not null default '{}'::text[],
  reason text,
  raw_line integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    recommended_use <@ array['rebuttal', 'judging', 'phrase_bank', 'prep_helper', 'eval']::text[]
  )
);

create table if not exists public.debate_corpus_matches (
  id uuid primary key default gen_random_uuid(),
  canonical_match_key text not null unique,
  motion_vi text not null,
  motion_en text,
  motion_key text not null,
  motion_confidence numeric(5, 4) not null default 0 check (
    motion_confidence >= 0 and motion_confidence <= 1
  ),
  teams jsonb not null default '[]'::jsonb,
  source_match_refs jsonb not null default '[]'::jsonb,
  import_decision text not null check (
    import_decision in ('candidate', 'phrase_only', 'metadata_only', 'reject')
  ),
  aggregate_confidence numeric(5, 4) not null default 0 check (
    aggregate_confidence >= 0 and aggregate_confidence <= 1
  ),
  rejected_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debate_corpus_items (
  id uuid primary key default gen_random_uuid(),
  canonical_match_id uuid not null references public.debate_corpus_matches(id) on delete cascade,
  source_id text references public.debate_corpus_sources(id) on delete set null,
  source_match_key text,
  item_type text not null check (
    item_type in ('debate_moment', 'phrase_bank', 'judging_lesson')
  ),
  canonical_fingerprint text not null,
  language text not null default 'vi' check (language in ('en', 'vi')),
  side text not null default 'unknown' check (
    side in ('proposition', 'opposition', 'neutral', 'unknown')
  ),
  usable_for text[] not null default '{}'::text[],
  evidence_status text not null default 'not_applicable' check (
    evidence_status in ('verified_from_video', 'mentioned_but_unverified', 'uncertain_stt', 'not_applicable')
  ),
  confidence numeric(5, 4) not null default 0 check (
    confidence >= 0 and confidence <= 1
  ),
  review_status text not null default 'candidate' check (
    review_status in ('candidate', 'approved', 'rejected', 'needs_review')
  ),
  embedding_text text not null,
  content_hash text not null,
  content jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_match_id, item_type, canonical_fingerprint),
  check (
    usable_for <@ array['rebuttal', 'judging', 'phrase_bank', 'prep_helper', 'eval']::text[]
  )
);

create table if not exists public.debate_corpus_embeddings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.debate_corpus_items(id) on delete cascade,
  provider text not null,
  model text not null,
  dimensions integer not null check (dimensions = 1024),
  input_type text not null default 'document' check (input_type in ('document', 'query')),
  content_hash text not null,
  embedding extensions.vector(1024) not null,
  token_count_estimate integer check (token_count_estimate is null or token_count_estimate >= 0),
  embedded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, provider, model, dimensions, input_type)
);

create table if not exists public.debate_corpus_retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  ai_quality_run_id uuid references public.ai_quality_runs(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  source_route text,
  query_hash text not null,
  query_text_preview text,
  provider text not null,
  model text not null,
  dimensions integer not null check (dimensions = 1024),
  filters jsonb not null default '{}'::jsonb,
  retrieved_items jsonb not null default '[]'::jsonb,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists debate_corpus_sources_youtube_idx
  on public.debate_corpus_sources(youtube_video_id);
create index if not exists debate_corpus_sources_status_idx
  on public.debate_corpus_sources(recommended_import_status);
create index if not exists debate_corpus_matches_motion_key_idx
  on public.debate_corpus_matches(motion_key);
create index if not exists debate_corpus_matches_decision_idx
  on public.debate_corpus_matches(import_decision);
create index if not exists debate_corpus_items_match_type_idx
  on public.debate_corpus_items(canonical_match_id, item_type);
create index if not exists debate_corpus_items_language_review_idx
  on public.debate_corpus_items(language, review_status, confidence desc);
create index if not exists debate_corpus_items_usable_for_idx
  on public.debate_corpus_items using gin(usable_for);
create index if not exists debate_corpus_items_content_idx
  on public.debate_corpus_items using gin(content);
create index if not exists debate_corpus_embeddings_lookup_idx
  on public.debate_corpus_embeddings(item_id, provider, model, dimensions, content_hash);
create index if not exists debate_corpus_embeddings_hnsw_idx
  on public.debate_corpus_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists debate_corpus_retrieval_logs_user_created_idx
  on public.debate_corpus_retrieval_logs(user_id, created_at desc);
create index if not exists debate_corpus_retrieval_logs_ai_run_idx
  on public.debate_corpus_retrieval_logs(ai_quality_run_id);

create or replace function public.match_debate_corpus_items(
  query_embedding extensions.vector(1024),
  match_count integer default 8,
  match_language text default 'vi',
  match_usable_for text default null,
  min_confidence numeric default 0.7
)
returns table (
  item_id uuid,
  canonical_match_id uuid,
  canonical_match_key text,
  motion_vi text,
  item_type text,
  language text,
  side text,
  usable_for text[],
  evidence_status text,
  confidence numeric,
  review_status text,
  embedding_text text,
  content jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    item.id as item_id,
    match.id as canonical_match_id,
    match.canonical_match_key,
    match.motion_vi,
    item.item_type,
    item.language,
    item.side,
    item.usable_for,
    item.evidence_status,
    item.confidence,
    item.review_status,
    item.embedding_text,
    item.content,
    1 - (embedding.embedding <=> query_embedding) as similarity
  from public.debate_corpus_embeddings embedding
  join public.debate_corpus_items item
    on item.id = embedding.item_id
  join public.debate_corpus_matches match
    on match.id = item.canonical_match_id
  where embedding.provider = 'voyage'
    and embedding.model = 'voyage-4-lite'
    and embedding.dimensions = 1024
    and embedding.input_type = 'document'
    and embedding.content_hash = item.content_hash
    and item.language = match_language
    and item.review_status in ('candidate', 'approved', 'needs_review')
    and item.confidence >= min_confidence
    and item.evidence_status in ('verified_from_video', 'mentioned_but_unverified', 'not_applicable')
    and match.import_decision in ('candidate', 'phrase_only')
    and (
      match_usable_for is null
      or match_usable_for = any(item.usable_for)
    )
  order by embedding.embedding <=> query_embedding asc
  limit least(greatest(match_count, 1), 12);
$$;

alter table public.debate_corpus_sources enable row level security;
alter table public.debate_corpus_matches enable row level security;
alter table public.debate_corpus_items enable row level security;
alter table public.debate_corpus_embeddings enable row level security;
alter table public.debate_corpus_retrieval_logs enable row level security;

drop policy if exists "Admins can view debate corpus sources" on public.debate_corpus_sources;
create policy "Admins can view debate corpus sources"
  on public.debate_corpus_sources for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus sources" on public.debate_corpus_sources;
create policy "Admins can manage debate corpus sources"
  on public.debate_corpus_sources for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate corpus matches" on public.debate_corpus_matches;
create policy "Admins can view debate corpus matches"
  on public.debate_corpus_matches for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus matches" on public.debate_corpus_matches;
create policy "Admins can manage debate corpus matches"
  on public.debate_corpus_matches for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate corpus items" on public.debate_corpus_items;
create policy "Admins can view debate corpus items"
  on public.debate_corpus_items for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus items" on public.debate_corpus_items;
create policy "Admins can manage debate corpus items"
  on public.debate_corpus_items for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate corpus embeddings" on public.debate_corpus_embeddings;
create policy "Admins can view debate corpus embeddings"
  on public.debate_corpus_embeddings for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus embeddings" on public.debate_corpus_embeddings;
create policy "Admins can manage debate corpus embeddings"
  on public.debate_corpus_embeddings for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate corpus retrieval logs" on public.debate_corpus_retrieval_logs;
create policy "Admins can view debate corpus retrieval logs"
  on public.debate_corpus_retrieval_logs for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus retrieval logs" on public.debate_corpus_retrieval_logs;
create policy "Admins can manage debate corpus retrieval logs"
  on public.debate_corpus_retrieval_logs for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

revoke all on public.debate_corpus_sources from anon;
revoke all on public.debate_corpus_matches from anon;
revoke all on public.debate_corpus_items from anon;
revoke all on public.debate_corpus_embeddings from anon;
revoke all on public.debate_corpus_retrieval_logs from anon;
revoke all on public.debate_corpus_sources from authenticated;
revoke all on public.debate_corpus_matches from authenticated;
revoke all on public.debate_corpus_items from authenticated;
revoke all on public.debate_corpus_embeddings from authenticated;
revoke all on public.debate_corpus_retrieval_logs from authenticated;

grant select, insert, update, delete on public.debate_corpus_sources to authenticated;
grant select, insert, update, delete on public.debate_corpus_matches to authenticated;
grant select, insert, update, delete on public.debate_corpus_items to authenticated;
grant select, insert, update, delete on public.debate_corpus_embeddings to authenticated;
grant select, insert, update, delete on public.debate_corpus_retrieval_logs to authenticated;
grant all on public.debate_corpus_sources to service_role;
grant all on public.debate_corpus_matches to service_role;
grant all on public.debate_corpus_items to service_role;
grant all on public.debate_corpus_embeddings to service_role;
grant all on public.debate_corpus_retrieval_logs to service_role;

revoke execute on function public.match_debate_corpus_items(
  extensions.vector,
  integer,
  text,
  text,
  numeric
) from public, anon, authenticated;
grant execute on function public.match_debate_corpus_items(
  extensions.vector,
  integer,
  text,
  text,
  numeric
) to service_role;
