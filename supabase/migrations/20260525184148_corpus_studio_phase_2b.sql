-- Phase 2B Corpus Studio: private source documents, review workflow,
-- motion candidates, catalog publishing support, and review-aware retrieval.

alter table public.debate_corpus_sources
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists admin_notes text,
  add column if not exists quality_flags jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.debate_corpus_sources
  drop constraint if exists debate_corpus_sources_review_status_check;

alter table public.debate_corpus_sources
  add constraint debate_corpus_sources_review_status_check
  check (review_status in ('candidate', 'approved', 'rejected', 'needs_review'));

update public.debate_corpus_sources
set review_status = case
    when recommended_import_status = 'approved' then 'approved'
    when recommended_import_status = 'do_not_import' then 'rejected'
    else 'needs_review'
  end,
  updated_at = now()
where reviewed_at is null
  and review_status = 'needs_review';

alter table public.debate_corpus_matches
  add column if not exists review_status text not null default 'candidate',
  add column if not exists admin_notes text,
  add column if not exists quality_flags jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.debate_corpus_matches
  drop constraint if exists debate_corpus_matches_review_status_check;

alter table public.debate_corpus_matches
  add constraint debate_corpus_matches_review_status_check
  check (review_status in ('candidate', 'approved', 'rejected', 'needs_review'));

update public.debate_corpus_matches
set review_status = case
    when import_decision = 'reject' then 'rejected'
    when import_decision = 'metadata_only' then 'needs_review'
    else 'candidate'
  end,
  updated_at = now()
where reviewed_at is null
  and review_status = 'candidate';

alter table public.debate_corpus_items
  add column if not exists admin_notes text,
  add column if not exists quality_flags jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.debate_corpus_documents (
  id uuid primary key default gen_random_uuid(),
  source_id text references public.debate_corpus_sources(id) on delete set null,
  import_batch_id uuid,
  document_type text not null check (
    document_type in ('import_bundle', 'raw_transcript', 'gemini_extraction', 'cleaned_notes', 'other')
  ),
  title text not null,
  source_url text,
  language text not null default 'vi' check (language in ('en', 'vi')),
  content_text text not null,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debate_corpus_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_key text not null unique,
  file_name text,
  input_format text not null check (input_format in ('json', 'markdown')),
  original_document_id uuid references public.debate_corpus_documents(id) on delete set null,
  source_count integer not null default 0 check (source_count >= 0),
  match_count integer not null default 0 check (match_count >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  motion_count integer not null default 0 check (motion_count >= 0),
  status text not null default 'imported' check (
    status in ('imported', 'failed', 'partial')
  ),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.debate_corpus_documents
  drop constraint if exists debate_corpus_documents_import_batch_id_fkey;

alter table public.debate_corpus_documents
  add constraint debate_corpus_documents_import_batch_id_fkey
  foreign key (import_batch_id)
  references public.debate_corpus_import_batches(id)
  on delete set null;

create table if not exists public.debate_corpus_motion_candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_match_id uuid references public.debate_corpus_matches(id) on delete set null,
  source_id text references public.debate_corpus_sources(id) on delete set null,
  motion_vi text not null,
  motion_en text,
  normalized_title_hash text not null,
  motion_key text not null,
  category_key text not null default 'vietnam' check (
    category_key in ('education', 'technology', 'society', 'environment', 'ethics', 'vietnam')
  ),
  difficulty text not null default 'intermediate' check (
    difficulty in ('beginner', 'intermediate', 'advanced')
  ),
  source_stage text,
  source_season integer,
  source_url text,
  teams jsonb not null default '[]'::jsonb,
  review_status text not null default 'candidate' check (
    review_status in ('candidate', 'approved', 'rejected', 'needs_review', 'published')
  ),
  publish_status text not null default 'draft' check (
    publish_status in ('draft', 'published')
  ),
  published_topic_key text references public.practice_topics(topic_key) on delete set null,
  admin_notes text,
  quality_flags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_match_id, normalized_title_hash)
);

create unique index if not exists debate_corpus_documents_hash_idx
  on public.debate_corpus_documents(content_hash);
create index if not exists debate_corpus_documents_source_idx
  on public.debate_corpus_documents(source_id, document_type);
create index if not exists debate_corpus_import_batches_created_idx
  on public.debate_corpus_import_batches(created_at desc);
create index if not exists debate_corpus_motion_candidates_hash_idx
  on public.debate_corpus_motion_candidates(normalized_title_hash);
create index if not exists debate_corpus_motion_candidates_review_idx
  on public.debate_corpus_motion_candidates(review_status, publish_status, created_at desc);
insert into public.debate_corpus_motion_candidates (
  canonical_match_id,
  source_id,
  motion_vi,
  motion_en,
  normalized_title_hash,
  motion_key,
  category_key,
  difficulty,
  source_stage,
  source_season,
  source_url,
  teams,
  review_status,
  metadata,
  updated_at
)
select
  matches.id,
  nullif(matches.source_match_refs->0->>'source_id', ''),
  matches.motion_vi,
  matches.motion_en,
  md5(lower(regexp_replace(matches.motion_vi, '\s+', ' ', 'g'))),
  matches.motion_key,
  case
    when matches.motion_vi ~* '(trường|học|giáo dục|thi|tốt nghiệp|ngữ văn|học sinh)' then 'education'
    when matches.motion_vi ~* '(truyền thông|mạng xã hội|chatgpt|ai|công nghệ)' then 'technology'
    else 'vietnam'
  end,
  case
    when matches.motion_vi ~* '(nhà nước|bộ giáo dục|kỳ thi|chấm dứt|bắt buộc)' then 'advanced'
    else 'intermediate'
  end,
  sources.stage,
  sources.season,
  sources.youtube_url,
  matches.teams,
  'candidate',
  jsonb_build_object(
    'seededFromPhase2A', true,
    'canonicalMatchKey', matches.canonical_match_key,
    'aggregateConfidence', matches.aggregate_confidence
  ),
  now()
from public.debate_corpus_matches matches
left join public.debate_corpus_sources sources
  on sources.id = nullif(matches.source_match_refs->0->>'source_id', '')
where matches.import_decision <> 'reject'
on conflict do nothing;

alter table public.practice_topics
  drop constraint if exists practice_topics_source_kind_check;

alter table public.practice_topics
  add constraint practice_topics_source_kind_check
  check (source_kind in ('legacy', 'calico', 'truong_teen'));

alter table public.practice_topic_sources
  drop constraint if exists practice_topic_sources_source_page_type_check;

alter table public.practice_topic_sources
  add constraint practice_topic_sources_source_page_type_check
  check (source_page_type in ('statistics', 'motion_list', 'video_transcript'));

drop function if exists public.match_debate_corpus_items(
  extensions.vector(1024),
  integer,
  text,
  text,
  numeric,
  text,
  text,
  integer
);

create or replace function public.match_debate_corpus_items(
  query_embedding extensions.vector(1024),
  match_count integer default 8,
  match_language text default 'vi',
  match_usable_for text default null,
  min_confidence numeric default 0.7,
  match_provider text default 'voyage',
  match_model text default 'voyage-4-lite',
  match_dimensions integer default 1024,
  match_review_statuses text[] default array['candidate', 'approved', 'needs_review']::text[]
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
  left join public.debate_corpus_sources source
    on source.id = item.source_id
  where embedding.provider = match_provider
    and embedding.model = match_model
    and embedding.dimensions = match_dimensions
    and embedding.input_type = 'document'
    and embedding.content_hash = item.content_hash
    and item.language = match_language
    and item.review_status = any(match_review_statuses)
    and match.review_status = any(match_review_statuses)
    and coalesce(source.review_status, 'approved') = any(match_review_statuses)
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

alter table public.debate_corpus_documents enable row level security;
alter table public.debate_corpus_import_batches enable row level security;
alter table public.debate_corpus_motion_candidates enable row level security;

drop policy if exists "Admins can view debate corpus documents" on public.debate_corpus_documents;
create policy "Admins can view debate corpus documents"
  on public.debate_corpus_documents for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus documents" on public.debate_corpus_documents;
create policy "Admins can manage debate corpus documents"
  on public.debate_corpus_documents for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate corpus import batches" on public.debate_corpus_import_batches;
create policy "Admins can view debate corpus import batches"
  on public.debate_corpus_import_batches for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus import batches" on public.debate_corpus_import_batches;
create policy "Admins can manage debate corpus import batches"
  on public.debate_corpus_import_batches for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate corpus motion candidates" on public.debate_corpus_motion_candidates;
create policy "Admins can view debate corpus motion candidates"
  on public.debate_corpus_motion_candidates for select
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage debate corpus motion candidates" on public.debate_corpus_motion_candidates;
create policy "Admins can manage debate corpus motion candidates"
  on public.debate_corpus_motion_candidates for all
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

revoke all on public.debate_corpus_documents from anon, authenticated;
revoke all on public.debate_corpus_import_batches from anon, authenticated;
revoke all on public.debate_corpus_motion_candidates from anon, authenticated;
grant select, insert, update, delete on public.debate_corpus_documents to authenticated;
grant select, insert, update, delete on public.debate_corpus_import_batches to authenticated;
grant select, insert, update, delete on public.debate_corpus_motion_candidates to authenticated;
grant all on public.debate_corpus_documents to service_role;
grant all on public.debate_corpus_import_batches to service_role;
grant all on public.debate_corpus_motion_candidates to service_role;

revoke execute on function public.match_debate_corpus_items(
  extensions.vector(1024),
  integer,
  text,
  text,
  numeric,
  text,
  text,
  integer,
  text[]
) from public, anon, authenticated;

grant execute on function public.match_debate_corpus_items(
  extensions.vector(1024),
  integer,
  text,
  text,
  numeric,
  text,
  text,
  integer,
  text[]
) to service_role;
