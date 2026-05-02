-- ============================================================
-- Casual duel hub: matchmaking, hidden MMR, and integrity logs
-- ============================================================

alter table public.debate_duels
  add column if not exists duel_kind text not null default 'custom',
  add column if not exists rated boolean not null default false,
  add column if not exists integrity_status text not null default 'clean',
  add column if not exists rating_processed_at timestamptz,
  add column if not exists rating_excluded_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'debate_duels_duel_kind_check'
  ) then
    alter table public.debate_duels
      add constraint debate_duels_duel_kind_check
      check (duel_kind in ('custom', 'matchmaking'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'debate_duels_integrity_status_check'
  ) then
    alter table public.debate_duels
      add constraint debate_duels_integrity_status_check
      check (integrity_status in ('clean', 'warned', 'suspicious', 'no_contest'));
  end if;
end $$;

create index if not exists idx_debate_duels_kind_status
  on public.debate_duels(duel_kind, status, created_at desc);

create table if not exists public.duel_mmr_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating numeric(8,2) not null default 1000,
  matches_count integer not null default 0 check (matches_count >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  provisional boolean not null default true,
  seed_source text not null default 'default'
    check (seed_source in ('default', 'skill_snapshot')),
  seed_snapshot jsonb not null default '{}'::jsonb,
  last_match_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rating >= 0 and rating <= 3000)
);

create table if not exists public.duel_rating_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.debate_duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  opponent_user_id uuid not null references auth.users(id) on delete cascade,
  result text not null check (result in ('win', 'loss')),
  rating_before numeric(8,2) not null,
  rating_after numeric(8,2) not null,
  rating_delta numeric(8,2) not null,
  expected_score numeric(6,5) not null,
  k_factor integer not null,
  integrity_status text not null,
  judge_confidence numeric(4,3),
  created_at timestamptz not null default now(),
  unique (duel_id, user_id)
);

create index if not exists idx_duel_rating_events_user_created
  on public.duel_rating_events(user_id, created_at desc);

create table if not exists public.debate_duel_matchmaking_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'matched', 'cancelled', 'expired')),
  topic_category text not null,
  topic_difficulty text not null
    check (topic_difficulty in ('beginner', 'intermediate', 'advanced')),
  prep_time_seconds integer not null default 120,
  opening_time_seconds integer not null default 180,
  rebuttal_time_seconds integer not null default 120,
  matched_duel_id uuid references public.debate_duels(id) on delete set null,
  matched_ticket_id uuid references public.debate_duel_matchmaking_tickets(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  matched_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_duel_matchmaking_one_queued_per_user
  on public.debate_duel_matchmaking_tickets(user_id)
  where status = 'queued';

create index if not exists idx_duel_matchmaking_queue
  on public.debate_duel_matchmaking_tickets(
    status,
    topic_difficulty,
    topic_category,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds,
    created_at
  )
  where status = 'queued';

create table if not exists public.debate_duel_integrity_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.debate_duels(id) on delete cascade,
  participant_id uuid references public.debate_duel_participants(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  action_data jsonb not null default '{}'::jsonb,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  is_suspicious boolean not null default false,
  suspicious_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_duel_integrity_events_duel_created
  on public.debate_duel_integrity_events(duel_id, created_at desc);

create index if not exists idx_duel_integrity_events_suspicious
  on public.debate_duel_integrity_events(duel_id, is_suspicious, created_at desc);

alter table public.duel_mmr_profiles enable row level security;
alter table public.duel_rating_events enable row level security;
alter table public.debate_duel_matchmaking_tickets enable row level security;
alter table public.debate_duel_integrity_events enable row level security;

drop policy if exists "Admins can view duel mmr profiles" on public.duel_mmr_profiles;
create policy "Admins can view duel mmr profiles"
  on public.duel_mmr_profiles for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admins can view duel rating events" on public.duel_rating_events;
create policy "Admins can view duel rating events"
  on public.duel_rating_events for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Users can view own matchmaking tickets" on public.debate_duel_matchmaking_tickets;
create policy "Users can view own matchmaking tickets"
  on public.debate_duel_matchmaking_tickets for select
  using (
    user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Participants can view duel integrity events" on public.debate_duel_integrity_events;
create policy "Participants can view duel integrity events"
  on public.debate_duel_integrity_events for select
  using (
    public.can_access_duel(duel_id, auth.uid())
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Participants can insert own duel integrity events" on public.debate_duel_integrity_events;
create policy "Participants can insert own duel integrity events"
  on public.debate_duel_integrity_events for insert
  with check (
    user_id = auth.uid()
    and public.can_access_duel(duel_id, auth.uid())
  );

create or replace function public.ensure_duel_mmr_profile(
  p_user_id uuid,
  p_seed_rating numeric,
  p_seed_source text,
  p_seed_snapshot jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_safe_rating numeric(8,2);
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  if p_user_id <> auth.uid()
    and not exists (
      select 1
      from public.debate_duel_participants actor_participant
      join public.debate_duel_participants target_participant
        on target_participant.duel_id = actor_participant.duel_id
      where actor_participant.user_id = auth.uid()
        and target_participant.user_id = p_user_id
    )
    and coalesce((select role from public.profiles where id = auth.uid()), '') <> 'admin'
  then
    raise exception 'FORBIDDEN';
  end if;

  v_safe_rating := least(1200, greatest(800, coalesce(p_seed_rating, 1000)));

  insert into public.duel_mmr_profiles (
    user_id,
    rating,
    provisional,
    seed_source,
    seed_snapshot
  )
  values (
    p_user_id,
    v_safe_rating,
    true,
    case when p_seed_source = 'skill_snapshot' then 'skill_snapshot' else 'default' end,
    coalesce(p_seed_snapshot, '{}'::jsonb)
  )
  on conflict (user_id) do nothing;
end;
$$;

revoke execute on function public.ensure_duel_mmr_profile(uuid, numeric, text, jsonb) from public;
revoke execute on function public.ensure_duel_mmr_profile(uuid, numeric, text, jsonb) from anon;
grant execute on function public.ensure_duel_mmr_profile(uuid, numeric, text, jsonb) to authenticated, service_role;

create or replace function public.enter_debate_duel_matchmaking(
  p_actor_user_id uuid,
  p_topic_category text,
  p_topic_difficulty text,
  p_topic_title text,
  p_topic_description text,
  p_prep_time_seconds integer,
  p_opening_time_seconds integer,
  p_rebuttal_time_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.debate_duel_matchmaking_tickets%rowtype;
  v_opponent public.debate_duel_matchmaking_tickets%rowtype;
  v_share_code text;
  v_duel_id uuid;
  v_actor_profile public.profiles%rowtype;
  v_opponent_profile public.profiles%rowtype;
  v_actor_role text;
  v_opponent_role text;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_user_id::text));

  if p_topic_difficulty not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'INVALID_DIFFICULTY';
  end if;

  update public.debate_duel_matchmaking_tickets
  set status = 'expired',
      updated_at = now()
  where status = 'queued'
    and expires_at <= now();

  select * into v_ticket
  from public.debate_duel_matchmaking_tickets
  where user_id = p_actor_user_id
    and status = 'queued'
    and expires_at > now()
  for update;

  if found then
    update public.debate_duel_matchmaking_tickets
    set topic_category = p_topic_category,
        topic_difficulty = p_topic_difficulty,
        prep_time_seconds = p_prep_time_seconds,
        opening_time_seconds = p_opening_time_seconds,
        rebuttal_time_seconds = p_rebuttal_time_seconds,
        expires_at = now() + interval '10 minutes',
        updated_at = now()
    where id = v_ticket.id
    returning * into v_ticket;
  else
    insert into public.debate_duel_matchmaking_tickets (
      user_id,
      topic_category,
      topic_difficulty,
      prep_time_seconds,
      opening_time_seconds,
      rebuttal_time_seconds
    )
    values (
      p_actor_user_id,
      p_topic_category,
      p_topic_difficulty,
      p_prep_time_seconds,
      p_opening_time_seconds,
      p_rebuttal_time_seconds
    )
    returning * into v_ticket;
  end if;

  select * into v_opponent
  from public.debate_duel_matchmaking_tickets
  where status = 'queued'
    and id <> v_ticket.id
    and user_id <> p_actor_user_id
    and expires_at > now()
    and topic_category = v_ticket.topic_category
    and topic_difficulty = v_ticket.topic_difficulty
    and prep_time_seconds = v_ticket.prep_time_seconds
    and opening_time_seconds = v_ticket.opening_time_seconds
    and rebuttal_time_seconds = v_ticket.rebuttal_time_seconds
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return v_ticket.id;
  end if;

  v_share_code := public.generate_duel_share_code();

  insert into public.debate_duels (
    share_code,
    creator_id,
    topic_title,
    topic_category,
    topic_difficulty,
    topic_description,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds,
    entry_cost,
    side_assignment_mode,
    duel_kind,
    rated
  )
  values (
    v_share_code,
    p_actor_user_id,
    p_topic_title,
    p_topic_category,
    p_topic_difficulty,
    p_topic_description,
    v_ticket.prep_time_seconds,
    v_ticket.opening_time_seconds,
    v_ticket.rebuttal_time_seconds,
    200,
    'random',
    'matchmaking',
    true
  )
  returning id into v_duel_id;

  if (ascii(substr(md5(v_ticket.id::text || v_opponent.id::text), 1, 1)) % 2) = 0 then
    v_actor_role := 'proposition';
  else
    v_actor_role := 'opposition';
  end if;
  v_opponent_role := case when v_actor_role = 'proposition' then 'opposition' else 'proposition' end;

  select * into v_actor_profile from public.profiles where id = p_actor_user_id;
  select * into v_opponent_profile from public.profiles where id = v_opponent.user_id;

  insert into public.debate_duel_participants (
    duel_id,
    user_id,
    role,
    display_name_snapshot,
    avatar_url_snapshot
  )
  values
    (
      v_duel_id,
      p_actor_user_id,
      v_actor_role,
      coalesce(v_actor_profile.display_name, 'Debater'),
      v_actor_profile.avatar_url
    ),
    (
      v_duel_id,
      v_opponent.user_id,
      v_opponent_role,
      coalesce(v_opponent_profile.display_name, 'Debater'),
      v_opponent_profile.avatar_url
    );

  update public.debate_duel_matchmaking_tickets
  set status = 'matched',
      matched_duel_id = v_duel_id,
      matched_ticket_id = v_opponent.id,
      matched_at = now(),
      updated_at = now()
  where id = v_ticket.id;

  update public.debate_duel_matchmaking_tickets
  set status = 'matched',
      matched_duel_id = v_duel_id,
      matched_ticket_id = v_ticket.id,
      matched_at = now(),
      updated_at = now()
  where id = v_opponent.id;

  return v_ticket.id;
end;
$$;

revoke execute on function public.enter_debate_duel_matchmaking(uuid, text, text, text, text, integer, integer, integer) from public;
revoke execute on function public.enter_debate_duel_matchmaking(uuid, text, text, text, text, integer, integer, integer) from anon;
grant execute on function public.enter_debate_duel_matchmaking(uuid, text, text, text, text, integer, integer, integer) to authenticated, service_role;

create or replace function public.cancel_debate_duel_matchmaking(
  p_ticket_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.debate_duel_matchmaking_tickets%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_ticket
  from public.debate_duel_matchmaking_tickets
  where id = p_ticket_id
    and user_id = p_actor_user_id
  for update;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if v_ticket.status <> 'queued' then
    return v_ticket.id;
  end if;

  update public.debate_duel_matchmaking_tickets
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = v_ticket.id;

  return v_ticket.id;
end;
$$;

revoke execute on function public.cancel_debate_duel_matchmaking(uuid, uuid) from public;
revoke execute on function public.cancel_debate_duel_matchmaking(uuid, uuid) from anon;
grant execute on function public.cancel_debate_duel_matchmaking(uuid, uuid) to authenticated, service_role;

create or replace function public.start_debate_duel(
  p_share_code text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_participant_count integer;
  v_ready_count integer;
  v_creator_participant public.debate_duel_participants%rowtype;
  v_other_participant public.debate_duel_participants%rowtype;
  v_creator_role text;
  v_other_role text;
  v_creator_balance integer;
  v_other_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel
  from public.debate_duels
  where share_code = upper(trim(p_share_code))
  for update;

  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if v_duel.creator_id <> p_actor_user_id then
    if coalesce(v_duel.duel_kind, 'custom') <> 'matchmaking'
      or not exists (
        select 1
        from public.debate_duel_participants
        where duel_id = v_duel.id
          and user_id = p_actor_user_id
      )
    then
      raise exception 'DUEL_CREATOR_REQUIRED';
    end if;
  end if;

  if v_duel.status <> 'lobby' then
    raise exception 'DUEL_ALREADY_STARTED';
  end if;

  if v_duel.expires_at <= now() then
    update public.debate_duels
    set status = 'expired',
        current_phase = 'completed',
        updated_at = now()
    where id = v_duel.id;
    raise exception 'DUEL_EXPIRED';
  end if;

  select count(*), count(ready_at)
  into v_participant_count, v_ready_count
  from public.debate_duel_participants
  where duel_id = v_duel.id;

  if v_participant_count <> 2 then
    raise exception 'DUEL_REQUIRES_TWO_PARTICIPANTS';
  end if;

  if v_ready_count <> 2 then
    raise exception 'DUEL_NOT_READY';
  end if;

  select *
  into v_creator_participant
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and user_id = v_duel.creator_id
  limit 1;

  select *
  into v_other_participant
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and user_id <> v_duel.creator_id
  limit 1;

  if v_creator_participant.role is not null and v_other_participant.role is not null then
    v_creator_role := v_creator_participant.role;
    v_other_role := v_other_participant.role;
  elsif v_duel.side_assignment_mode = 'choose' and v_duel.creator_side_preference is not null then
    v_creator_role := v_duel.creator_side_preference;
    v_other_role := case when v_creator_role = 'proposition' then 'opposition' else 'proposition' end;
  else
    if (ascii(substr(md5(v_duel.id::text), 1, 1)) % 2) = 0 then
      v_creator_role := 'proposition';
    else
      v_creator_role := 'opposition';
    end if;
    v_other_role := case when v_creator_role = 'proposition' then 'opposition' else 'proposition' end;
  end if;

  select orb_balance into v_creator_balance
  from public.profiles
  where id = v_creator_participant.user_id
  for update;

  select orb_balance into v_other_balance
  from public.profiles
  where id = v_other_participant.user_id
  for update;

  if coalesce(v_creator_balance, 0) < v_duel.entry_cost or coalesce(v_other_balance, 0) < v_duel.entry_cost then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.profiles
  set orb_balance = orb_balance - v_duel.entry_cost
  where id in (v_creator_participant.user_id, v_other_participant.user_id);

  insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  values
    (
      v_creator_participant.user_id,
      -v_duel.entry_cost,
      'duel_entry',
      v_duel.id,
      v_creator_balance - v_duel.entry_cost
    ),
    (
      v_other_participant.user_id,
      -v_duel.entry_cost,
      'duel_entry',
      v_duel.id,
      v_other_balance - v_duel.entry_cost
    );

  update public.debate_duel_participants
  set role = case
        when id = v_creator_participant.id then v_creator_role
        else v_other_role
      end,
      credits_charged_at = now(),
      updated_at = now()
  where duel_id = v_duel.id;

  update public.debate_duels
  set status = 'in_progress',
      current_phase = 'prep',
      phase_started_at = now(),
      started_at = now(),
      updated_at = now()
  where id = v_duel.id;

  return v_duel.id;
end;
$$;

revoke execute on function public.start_debate_duel(text, uuid) from public;
revoke execute on function public.start_debate_duel(text, uuid) from anon;
grant execute on function public.start_debate_duel(text, uuid) to authenticated, service_role;

create or replace function public.process_debate_duel_rating(p_duel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_judgment public.debate_duel_judgments%rowtype;
  v_winner public.debate_duel_participants%rowtype;
  v_loser public.debate_duel_participants%rowtype;
  v_winner_mmr public.duel_mmr_profiles%rowtype;
  v_loser_mmr public.duel_mmr_profiles%rowtype;
  v_winner_expected numeric;
  v_loser_expected numeric;
  v_winner_k integer;
  v_loser_k integer;
  v_winner_delta numeric(8,2);
  v_loser_delta numeric(8,2);
begin
  if auth.uid() is null
    or not exists (
      select 1
      from public.debate_duel_participants
      where duel_id = p_duel_id
        and user_id = auth.uid()
    )
  then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel
  from public.debate_duels
  where id = p_duel_id
  for update;

  if not found then
    return false;
  end if;

  if v_duel.rating_processed_at is not null then
    return false;
  end if;

  if coalesce(v_duel.duel_kind, 'custom') <> 'matchmaking' or not v_duel.rated then
    update public.debate_duels
    set rating_processed_at = now(),
        rating_excluded_reason = 'unrated_duel',
        updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  if v_duel.status <> 'completed' then
    return false;
  end if;

  if v_duel.integrity_status in ('suspicious', 'no_contest') then
    update public.debate_duels
    set rating_processed_at = now(),
        rating_excluded_reason = 'integrity_' || v_duel.integrity_status,
        updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  select * into v_judgment
  from public.debate_duel_judgments
  where duel_id = v_duel.id
  for update;

  if not found or v_judgment.winner_participant_id is null then
    return false;
  end if;

  if coalesce(v_judgment.confidence, 0) < 0.55 then
    update public.debate_duels
    set rating_processed_at = now(),
        rating_excluded_reason = 'low_judge_confidence',
        updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  select * into v_winner
  from public.debate_duel_participants
  where id = v_judgment.winner_participant_id
    and duel_id = v_duel.id;

  select * into v_loser
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and id <> v_judgment.winner_participant_id
  limit 1;

  if not found or v_winner.user_id is null or v_loser.user_id is null then
    return false;
  end if;

  insert into public.duel_mmr_profiles (user_id)
  values (v_winner.user_id)
  on conflict (user_id) do nothing;

  insert into public.duel_mmr_profiles (user_id)
  values (v_loser.user_id)
  on conflict (user_id) do nothing;

  select * into v_winner_mmr
  from public.duel_mmr_profiles
  where user_id = v_winner.user_id
  for update;

  select * into v_loser_mmr
  from public.duel_mmr_profiles
  where user_id = v_loser.user_id
  for update;

  v_winner_expected := 1 / (1 + power(10::numeric, ((v_loser_mmr.rating - v_winner_mmr.rating) / 400)));
  v_loser_expected := 1 / (1 + power(10::numeric, ((v_winner_mmr.rating - v_loser_mmr.rating) / 400)));

  v_winner_k := case
    when v_winner_mmr.provisional or v_winner_mmr.matches_count < 5 then 40
    when v_winner_mmr.matches_count < 20 then 32
    else 24
  end;
  v_loser_k := case
    when v_loser_mmr.provisional or v_loser_mmr.matches_count < 5 then 40
    when v_loser_mmr.matches_count < 20 then 32
    else 24
  end;

  v_winner_delta := round((v_winner_k * (1 - v_winner_expected))::numeric, 2);
  v_loser_delta := round((v_loser_k * (0 - v_loser_expected))::numeric, 2);

  update public.duel_mmr_profiles
  set rating = rating + v_winner_delta,
      matches_count = matches_count + 1,
      wins = wins + 1,
      provisional = (matches_count + 1) < 10,
      last_match_at = now(),
      updated_at = now()
  where user_id = v_winner.user_id;

  update public.duel_mmr_profiles
  set rating = greatest(0, rating + v_loser_delta),
      matches_count = matches_count + 1,
      losses = losses + 1,
      provisional = (matches_count + 1) < 10,
      last_match_at = now(),
      updated_at = now()
  where user_id = v_loser.user_id;

  insert into public.duel_rating_events (
    duel_id,
    user_id,
    opponent_user_id,
    result,
    rating_before,
    rating_after,
    rating_delta,
    expected_score,
    k_factor,
    integrity_status,
    judge_confidence
  )
  values
    (
      v_duel.id,
      v_winner.user_id,
      v_loser.user_id,
      'win',
      v_winner_mmr.rating,
      v_winner_mmr.rating + v_winner_delta,
      v_winner_delta,
      v_winner_expected,
      v_winner_k,
      v_duel.integrity_status,
      v_judgment.confidence
    ),
    (
      v_duel.id,
      v_loser.user_id,
      v_winner.user_id,
      'loss',
      v_loser_mmr.rating,
      greatest(0, v_loser_mmr.rating + v_loser_delta),
      v_loser_delta,
      v_loser_expected,
      v_loser_k,
      v_duel.integrity_status,
      v_judgment.confidence
    );

  update public.debate_duels
  set rating_processed_at = now(),
      rating_excluded_reason = null,
      updated_at = now()
  where id = v_duel.id;

  return true;
end;
$$;

revoke execute on function public.process_debate_duel_rating(uuid) from public;
revoke execute on function public.process_debate_duel_rating(uuid) from anon;
grant execute on function public.process_debate_duel_rating(uuid) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debate_duel_matchmaking_tickets'
  ) then
    alter publication supabase_realtime add table public.debate_duel_matchmaking_tickets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debate_duel_integrity_events'
  ) then
    alter publication supabase_realtime add table public.debate_duel_integrity_events;
  end if;
end $$;
