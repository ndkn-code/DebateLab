-- ============================================================
-- Credit Economy refresh + 1v1 Debate Duels
-- ============================================================

-- ------------------------------------------------------------------
-- Credit economy alignment
-- ------------------------------------------------------------------

alter table public.profiles
  alter column orb_balance set default 1250;

update public.profiles
set orb_balance = greatest(coalesce(orb_balance, 0), 1250)
where coalesce(orb_balance, 0) < 1250;

alter table public.orb_transactions
  drop constraint if exists orb_transactions_type_check;

alter table public.orb_transactions
  add constraint orb_transactions_type_check
  check (
    type in (
      'signup_bonus',
      'referral_reward',
      'referral_bonus',
      'practice_quick',
      'practice_full',
      'practice_speaking',
      'practice_debate',
      'duel_entry',
      'admin_grant'
    )
  );

create or replace function public.adjust_orb_balance(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reference_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_balance integer;
begin
  update public.profiles
  set orb_balance = orb_balance + p_amount
  where id = p_user_id
    and orb_balance + p_amount >= 0
  returning orb_balance into v_new_balance;

  if not found then
    raise exception 'Unable to adjust balance for user %', p_user_id;
  end if;

  insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  values (p_user_id, p_amount, p_type, p_reference_id, v_new_balance);

  return v_new_balance;
end;
$$;

create or replace function public.credit_referral(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref public.referrals%rowtype;
  referrer_count integer;
begin
  select * into ref
  from public.referrals
  where id = p_referral_id and status = 'qualified'
  for update;

  if not found then
    return;
  end if;

  select count(*) into referrer_count
  from public.referrals
  where referrer_id = ref.referrer_id
    and status = 'credited';

  if referrer_count >= 20 then
    update public.referrals
    set status = 'rejected'
    where id = p_referral_id;
    return;
  end if;

  perform public.adjust_orb_balance(ref.referrer_id, 300, 'referral_reward', p_referral_id);
  perform public.adjust_orb_balance(ref.referee_id, 300, 'referral_bonus', p_referral_id);

  update public.referrals
  set status = 'credited',
      referrer_orbs_awarded = 300,
      referee_orbs_awarded = 300,
      credited_at = now()
  where id = p_referral_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral_code text;
begin
  v_referral_code := public.generate_referral_code();

  insert into public.profiles (id, email, display_name, referral_code, orb_balance)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    v_referral_code,
    1250
  );

  insert into public.orb_transactions (user_id, amount, type, balance_after)
  values (new.id, 1250, 'signup_bonus', 1250);

  return new;
end;
$$;

-- ------------------------------------------------------------------
-- Duel helpers
-- ------------------------------------------------------------------

create table if not exists public.debate_duels (
  id uuid primary key default gen_random_uuid(),
  share_code text not null unique,
  creator_id uuid not null references auth.users(id) on delete cascade,
  topic_title text not null,
  topic_category text not null default '',
  topic_description text,
  prep_time_seconds integer not null default 120,
  opening_time_seconds integer not null default 180,
  rebuttal_time_seconds integer not null default 120,
  entry_cost integer not null default 200,
  side_assignment_mode text not null default 'random'
    check (side_assignment_mode in ('random', 'choose')),
  creator_side_preference text
    check (creator_side_preference in ('proposition', 'opposition')),
  status text not null default 'lobby'
    check (status in ('lobby', 'in_progress', 'judging', 'completed', 'expired', 'cancelled')),
  current_phase text not null default 'lobby'
    check (
      current_phase in (
        'lobby',
        'prep',
        'proposition-opening',
        'opposition-opening',
        'rebuttal-prep',
        'proposition-rebuttal',
        'opposition-rebuttal',
        'judging',
        'completed'
      )
    ),
  phase_started_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_duel_share_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (
      select 1
      from public.debate_duels
      where share_code = code
    );
  end loop;
  return code;
end;
$$;

create table if not exists public.debate_duel_participants (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.debate_duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text check (role in ('proposition', 'opposition')),
  joined_at timestamptz not null default now(),
  ready_at timestamptz,
  credits_charged_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (duel_id, user_id),
  unique (duel_id, role)
);

create table if not exists public.debate_duel_speeches (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.debate_duels(id) on delete cascade,
  participant_id uuid not null references public.debate_duel_participants(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 4),
  speech_type text not null check (speech_type in ('opening', 'rebuttal')),
  side text not null check (side in ('proposition', 'opposition')),
  transcript text not null default '',
  audio_storage_path text,
  duration_seconds integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (duel_id, round_number)
);

create table if not exists public.debate_duel_judgments (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null unique references public.debate_duels(id) on delete cascade,
  winner_participant_id uuid references public.debate_duel_participants(id) on delete set null,
  winner_side text check (winner_side in ('proposition', 'opposition')),
  judge_model text not null default '',
  confidence numeric(4,3),
  verdict jsonb not null default '{}'::jsonb,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_debate_duels_share_code on public.debate_duels(share_code);
create index if not exists idx_debate_duels_creator on public.debate_duels(creator_id, created_at desc);
create index if not exists idx_debate_duel_participants_duel on public.debate_duel_participants(duel_id);
create index if not exists idx_debate_duel_participants_user on public.debate_duel_participants(user_id, joined_at desc);
create index if not exists idx_debate_duel_speeches_duel on public.debate_duel_speeches(duel_id, round_number);

alter table public.debate_duels enable row level security;
alter table public.debate_duel_participants enable row level security;
alter table public.debate_duel_speeches enable row level security;
alter table public.debate_duel_judgments enable row level security;

create or replace function public.can_access_duel(p_duel_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.debate_duels d
    where d.id = p_duel_id
      and d.creator_id = p_user_id
  )
  or exists (
    select 1
    from public.debate_duel_participants p
    where p.duel_id = p_duel_id
      and p.user_id = p_user_id
  );
$$;

drop policy if exists "Participants can view debate duels" on public.debate_duels;
create policy "Participants can view debate duels"
  on public.debate_duels for select
  using (
    public.can_access_duel(id, auth.uid())
    or (status = 'lobby' and expires_at > now())
  );

drop policy if exists "Creators can insert debate duels" on public.debate_duels;
create policy "Creators can insert debate duels"
  on public.debate_duels for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Participants can update debate duels" on public.debate_duels;
create policy "Participants can update debate duels"
  on public.debate_duels for update
  using (public.can_access_duel(id, auth.uid()))
  with check (public.can_access_duel(id, auth.uid()));

drop policy if exists "Participants can view duel participants" on public.debate_duel_participants;
create policy "Participants can view duel participants"
  on public.debate_duel_participants for select
  using (
    public.can_access_duel(duel_id, auth.uid())
    or exists (
      select 1
      from public.debate_duels d
      where d.id = duel_id
        and d.status = 'lobby'
        and d.expires_at > now()
    )
  );

drop policy if exists "Users can join duel participants" on public.debate_duel_participants;
create policy "Users can join duel participants"
  on public.debate_duel_participants for insert
  with check (auth.uid() = user_id);

drop policy if exists "Participants can update own duel participant row" on public.debate_duel_participants;
create policy "Participants can update own duel participant row"
  on public.debate_duel_participants for update
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.debate_duels d
      where d.id = duel_id
        and d.creator_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.debate_duels d
      where d.id = duel_id
        and d.creator_id = auth.uid()
    )
  );

drop policy if exists "Participants can view duel speeches" on public.debate_duel_speeches;
create policy "Participants can view duel speeches"
  on public.debate_duel_speeches for select
  using (public.can_access_duel(duel_id, auth.uid()));

drop policy if exists "Participants can insert duel speeches" on public.debate_duel_speeches;
create policy "Participants can insert duel speeches"
  on public.debate_duel_speeches for insert
  with check (
    exists (
      select 1
      from public.debate_duel_participants p
      where p.id = participant_id
        and p.user_id = auth.uid()
        and p.duel_id = duel_id
    )
  );

drop policy if exists "Participants can update own duel speeches" on public.debate_duel_speeches;
create policy "Participants can update own duel speeches"
  on public.debate_duel_speeches for update
  using (
    exists (
      select 1
      from public.debate_duel_participants p
      where p.id = participant_id
        and p.user_id = auth.uid()
        and p.duel_id = duel_id
    )
  )
  with check (
    exists (
      select 1
      from public.debate_duel_participants p
      where p.id = participant_id
        and p.user_id = auth.uid()
        and p.duel_id = duel_id
    )
  );

drop policy if exists "Participants can view duel judgments" on public.debate_duel_judgments;
create policy "Participants can view duel judgments"
  on public.debate_duel_judgments for select
  using (public.can_access_duel(duel_id, auth.uid()));

drop policy if exists "Participants can insert duel judgments" on public.debate_duel_judgments;
create policy "Participants can insert duel judgments"
  on public.debate_duel_judgments for insert
  with check (public.can_access_duel(duel_id, auth.uid()));

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
  select * into v_duel
  from public.debate_duels
  where share_code = upper(trim(p_share_code))
  for update;

  if not found then
    raise exception 'DUEL_NOT_FOUND';
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

  if v_duel.side_assignment_mode = 'choose' and v_duel.creator_side_preference is not null then
    v_creator_role := v_duel.creator_side_preference;
  else
    if (ascii(substr(md5(v_duel.id::text), 1, 1)) % 2) = 0 then
      v_creator_role := 'proposition';
    else
      v_creator_role := 'opposition';
    end if;
  end if;

  v_other_role := case when v_creator_role = 'proposition' then 'opposition' else 'proposition' end;

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

create or replace function public.finalize_debate_duel_stats(
  p_duel_id uuid,
  p_duration_minutes integer,
  p_xp integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
  participant_row record;
  v_last_active date;
  v_new_streak integer;
  v_new_longest integer;
  v_current_xp integer;
begin
  for participant_row in
    select p.user_id
    from public.debate_duel_participants p
    where p.duel_id = p_duel_id
  loop
    insert into public.activity_log (
      user_id,
      activity_type,
      reference_id,
      reference_type,
      xp_earned,
      metadata
    )
    values (
      participant_row.user_id,
      'duel_completed',
      p_duel_id,
      'debate_duel',
      p_xp,
      jsonb_build_object('mode', '1v1')
    );

    insert into public.daily_stats (
      user_id,
      date,
      sessions_completed,
      practice_minutes,
      xp_earned
    )
    values (
      participant_row.user_id,
      v_today,
      1,
      p_duration_minutes,
      p_xp
    )
    on conflict (user_id, date)
    do update set
      sessions_completed = public.daily_stats.sessions_completed + 1,
      practice_minutes = public.daily_stats.practice_minutes + excluded.practice_minutes,
      xp_earned = public.daily_stats.xp_earned + excluded.xp_earned;

    select streak_last_active_date, streak_current, streak_longest, xp
    into v_last_active, v_new_streak, v_new_longest, v_current_xp
    from public.profiles
    where id = participant_row.user_id
    for update;

    if v_last_active = v_today then
      v_new_streak := coalesce(v_new_streak, 0);
    elsif v_last_active = (v_today - interval '1 day')::date then
      v_new_streak := coalesce(v_new_streak, 0) + 1;
    else
      v_new_streak := 1;
    end if;

    v_new_longest := greatest(coalesce(v_new_longest, 0), v_new_streak);

    update public.profiles
    set total_sessions_completed = coalesce(total_sessions_completed, 0) + 1,
        total_practice_minutes = coalesce(total_practice_minutes, 0) + p_duration_minutes,
        streak_current = v_new_streak,
        streak_longest = v_new_longest,
        streak_last_active_date = v_today,
        xp = coalesce(v_current_xp, 0) + p_xp,
        level = floor((coalesce(v_current_xp, 0) + p_xp) / 500) + 1,
        updated_at = now()
    where id = participant_row.user_id;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debate_duels'
  ) then
    alter publication supabase_realtime add table public.debate_duels;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debate_duel_participants'
  ) then
    alter publication supabase_realtime add table public.debate_duel_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debate_duel_speeches'
  ) then
    alter publication supabase_realtime add table public.debate_duel_speeches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debate_duel_judgments'
  ) then
    alter publication supabase_realtime add table public.debate_duel_judgments;
  end if;
end $$;
