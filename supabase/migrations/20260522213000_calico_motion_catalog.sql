-- Calico/Tabbycat motion import metadata and active catalog view.

alter table public.practice_topics
  add column if not exists source_kind text not null default 'legacy',
  add column if not exists source_language text,
  add column if not exists normalized_title_hash text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.practice_topics
  drop constraint if exists practice_topics_source_kind_check;

alter table public.practice_topics
  add constraint practice_topics_source_kind_check
  check (source_kind in ('legacy', 'calico'));

alter table public.practice_topics
  drop constraint if exists practice_topics_source_language_check;

alter table public.practice_topics
  add constraint practice_topics_source_language_check
  check (source_language is null or source_language in ('en', 'vi'));

update public.practice_topics
set source_kind = 'legacy',
    metadata = coalesce(metadata, '{}'::jsonb),
    updated_at = now()
where source_kind is null
   or source_kind = '';

create unique index if not exists practice_topics_calico_language_hash_idx
  on public.practice_topics (source_language, normalized_title_hash)
  where source_kind = 'calico'
    and normalized_title_hash is not null;

create index if not exists practice_topics_active_language_idx
  on public.practice_topics (is_active, source_language, display_order)
  where is_active = true;

create table if not exists public.practice_topic_sources (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null references public.practice_topics(topic_key) on delete cascade,
  source_slug text not null,
  tournament_name text not null,
  source_url text not null,
  source_page_type text not null check (source_page_type in ('statistics', 'motion_list')),
  source_language text not null check (source_language in ('en', 'vi')),
  source_motion_index integer not null,
  round_label text,
  stage_label text,
  source_tag text,
  info_slide text,
  stats jsonb not null default '{}'::jsonb,
  raw_motion_text text not null,
  raw_motion_hash text not null,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_slug, source_motion_index, raw_motion_hash)
);

alter table public.practice_topic_sources enable row level security;

drop policy if exists "Authenticated users can read practice topic sources"
  on public.practice_topic_sources;
create policy "Authenticated users can read practice topic sources"
  on public.practice_topic_sources
  for select
  to authenticated
  using (true);

revoke all on table public.practice_topic_sources from anon, authenticated;
grant select on table public.practice_topic_sources to authenticated;

create index if not exists practice_topic_sources_topic_key_idx
  on public.practice_topic_sources (topic_key);

create index if not exists practice_topic_sources_source_slug_idx
  on public.practice_topic_sources (source_slug);

create index if not exists practice_topic_sources_stats_gin_idx
  on public.practice_topic_sources using gin (stats);

drop view if exists public.active_practice_topic_catalog;

create view public.active_practice_topic_catalog
with (security_invoker = true) as
select
  topics.topic_key,
  topics.category_key,
  topics.difficulty,
  topics.display_order,
  topics.source_kind,
  topics.source_language,
  topics.normalized_title_hash,
  topics.metadata,
  translations.language,
  translations.title,
  translations.context,
  translations.suggested_points,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sources.id,
        'sourceSlug', sources.source_slug,
        'tournamentName', sources.tournament_name,
        'sourceUrl', sources.source_url,
        'sourcePageType', sources.source_page_type,
        'sourceLanguage', sources.source_language,
        'sourceMotionIndex', sources.source_motion_index,
        'roundLabel', sources.round_label,
        'stageLabel', sources.stage_label,
        'sourceTag', sources.source_tag,
        'infoSlide', sources.info_slide,
        'stats', sources.stats,
        'rawMotionHash', sources.raw_motion_hash,
        'scrapedAt', sources.scraped_at
      )
      order by sources.source_slug, sources.source_motion_index
    ) filter (where sources.id is not null),
    '[]'::jsonb
  ) as sources,
  count(sources.id)::integer as source_count,
  coalesce(bool_or(nullif(btrim(sources.info_slide), '') is not null), false) as has_info_slide,
  coalesce(bool_or(sources.stats <> '{}'::jsonb), false) as has_stats
from public.practice_topics as topics
join public.practice_topic_translations as translations
  on translations.topic_key = topics.topic_key
left join public.practice_topic_sources as sources
  on sources.topic_key = topics.topic_key
where topics.is_active = true
  and (
    topics.source_language is null
    or topics.source_language = translations.language
  )
group by
  topics.topic_key,
  topics.category_key,
  topics.difficulty,
  topics.display_order,
  topics.source_kind,
  topics.source_language,
  topics.normalized_title_hash,
  topics.metadata,
  translations.language,
  translations.title,
  translations.context,
  translations.suggested_points;

revoke all on table public.active_practice_topic_catalog from anon, authenticated;
grant select on table public.active_practice_topic_catalog to authenticated;

comment on table public.practice_topic_sources is
  'Source occurrences for imported debate motions. A visible topic may merge several tournament occurrences.';
