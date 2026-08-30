-- Achievement catalog and per-user unlock state.
-- These tables are required by the profile showcase migrations that follow.

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  category text not null default 'general',
  icon text not null default 'trophy',
  title_reward text,
  xp_reward integer not null default 0,
  condition_type text not null,
  condition_value integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create index if not exists idx_user_achievements_user
  on public.user_achievements(user_id, unlocked_at desc);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Anyone can view achievements" on public.achievements;
create policy "Anyone can view achievements"
  on public.achievements for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can view own achievements" on public.user_achievements;
create policy "Users can view own achievements"
  on public.user_achievements for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can unlock own achievements" on public.user_achievements;
create policy "Users can unlock own achievements"
  on public.user_achievements for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table public.achievements from public, anon, authenticated;
grant select on table public.achievements to anon, authenticated;

revoke all on table public.user_achievements from public, anon, authenticated;
grant select, insert on table public.user_achievements to authenticated;
grant all on table public.achievements, public.user_achievements to service_role;
