-- WS-L4: reusable vocabulary bank shared by courses and IELTS micro-drills.

create table public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  part_of_speech text,
  phonetic text,
  definition_en text,
  definition_vi text,
  example text,
  synonyms text[] not null default '{}',
  collocations text[] not null default '{}',
  topic_tags text[] not null default '{}',
  band_tag text,
  subject text not null default 'ielts'
    constraint vocab_items_subject_check check (subject in ('ielts', 'debate')),
  source text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocab_items_term_not_blank check (btrim(term) <> '')
);

comment on table public.vocab_items is
  'Reusable IELTS and debate vocabulary curriculum content.';
comment on column public.vocab_items.phonetic is 'IPA pronunciation.';

create index vocab_items_subject_idx on public.vocab_items(subject);
create index vocab_items_band_tag_idx on public.vocab_items(band_tag);
create index vocab_items_topic_tags_idx on public.vocab_items using gin(topic_tags);
create index vocab_items_created_by_idx on public.vocab_items(created_by);
create unique index vocab_items_term_subject_unique_idx
  on public.vocab_items(lower(btrim(term)), subject);

alter table public.vocab_items enable row level security;

-- SQL-created tables are not guaranteed to be Data API exposed on new projects.
grant select on table public.vocab_items to authenticated;
grant insert, update, delete on table public.vocab_items to authenticated;
grant all on table public.vocab_items to service_role;

create policy "Authenticated users can read vocabulary"
  on public.vocab_items
  for select
  to authenticated
  using (true);

create policy "Admins can insert vocabulary"
  on public.vocab_items
  for insert
  to authenticated
  with check (private.is_admin((select auth.uid())));

create policy "Admins can update vocabulary"
  on public.vocab_items
  for update
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy "Admins can delete vocabulary"
  on public.vocab_items
  for delete
  to authenticated
  using (private.is_admin((select auth.uid())));
