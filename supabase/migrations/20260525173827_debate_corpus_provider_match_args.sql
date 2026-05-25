drop function if exists public.match_debate_corpus_items(
  extensions.vector(1024),
  integer,
  text,
  text,
  numeric
);

create or replace function public.match_debate_corpus_items(
  query_embedding extensions.vector(1024),
  match_count integer default 8,
  match_language text default 'vi',
  match_usable_for text default null,
  min_confidence numeric default 0.7,
  match_provider text default 'voyage',
  match_model text default 'voyage-4-lite',
  match_dimensions integer default 1024
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
  where embedding.provider = match_provider
    and embedding.model = match_model
    and embedding.dimensions = match_dimensions
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

revoke execute on function public.match_debate_corpus_items(
  extensions.vector(1024),
  integer,
  text,
  text,
  numeric,
  text,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.match_debate_corpus_items(
  extensions.vector(1024),
  integer,
  text,
  text,
  numeric,
  text,
  text,
  integer
) to service_role;
