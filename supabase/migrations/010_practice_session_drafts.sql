-- Practice session draft autosave
create table if not exists public.practice_session_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text,
  topic_title text not null,
  topic_category text not null,
  topic_difficulty text not null default 'beginner',
  side text not null check (side in ('proposition', 'opposition')),
  practice_track text not null check (practice_track in ('speaking', 'debate')),
  mode text not null check (mode in ('quick', 'full')),
  prep_time integer not null default 0,
  speech_time integer not null default 0,
  ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard')),
  current_phase text not null default 'mic-check',
  current_round integer not null default 1,
  prep_notes text not null default '',
  transcript text not null default '',
  rounds jsonb,
  session_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.practice_session_drafts enable row level security;

drop policy if exists "Users can view own practice drafts" on public.practice_session_drafts;
drop policy if exists "Users can insert own practice drafts" on public.practice_session_drafts;
drop policy if exists "Users can update own practice drafts" on public.practice_session_drafts;
drop policy if exists "Users can delete own practice drafts" on public.practice_session_drafts;

create policy "Users can view own practice drafts"
  on public.practice_session_drafts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own practice drafts"
  on public.practice_session_drafts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own practice drafts"
  on public.practice_session_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own practice drafts"
  on public.practice_session_drafts
  for delete
  using (auth.uid() = user_id);

create index if not exists idx_practice_session_drafts_user_updated
  on public.practice_session_drafts(user_id, updated_at desc);
