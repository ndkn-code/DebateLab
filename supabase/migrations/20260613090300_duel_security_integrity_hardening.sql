-- ============================================================
-- Duel security + integrity hardening
--
-- 1. finalize_debate_duel_stats: add a participant auth gate (authenticated
--    callers may only finalize a duel they're in; service-role callers pass)
--    and idempotency (claim stats_finalized_at atomically; never double-award
--    XP / streak / daily_stats).
-- 2. generate_duel_share_code: pin search_path (was mutable — advisor WARN).
-- 3. can_access_duel: keep the RLS-required grants, but harden the body so it
--    can only answer for the calling user (closes the anon/authenticated probe
--    of "is <other user> in <duel>"). Stays SECURITY DEFINER to avoid RLS
--    recursion.
-- 4. Revoke anon EXECUTE on the pure server-side helper RPCs (the Next.js
--    server calls them as the authenticated user, never as anon).
-- ============================================================

alter table public.debate_duels
  add column if not exists stats_finalized_at timestamptz;

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
  v_claimed timestamptz;
begin
  -- Authenticated callers may only finalize a duel they participate in.
  -- service_role / SECURITY DEFINER callers have auth.uid() = null and pass.
  if auth.uid() is not null
    and not exists (
      select 1 from public.debate_duel_participants
      where duel_id = p_duel_id and user_id = auth.uid()
    )
  then
    raise exception 'FORBIDDEN';
  end if;

  -- Idempotency: atomically claim the duel. If already finalized, no-op so XP
  -- and streaks are never double-counted on retry / double-trigger.
  update public.debate_duels
  set stats_finalized_at = now(), updated_at = now()
  where id = p_duel_id and stats_finalized_at is null
  returning stats_finalized_at into v_claimed;

  if v_claimed is null then
    return;
  end if;

  for participant_row in
    select p.user_id
    from public.debate_duel_participants p
    where p.duel_id = p_duel_id
  loop
    insert into public.activity_log (
      user_id, activity_type, reference_id, reference_type, xp_earned, metadata
    )
    values (
      participant_row.user_id, 'duel_completed', p_duel_id, 'debate_duel', p_xp,
      jsonb_build_object('mode', '1v1')
    );

    insert into public.daily_stats (
      user_id, date, sessions_completed, practice_minutes, xp_earned
    )
    values (participant_row.user_id, v_today, 1, p_duration_minutes, p_xp)
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

-- Pin search_path on the share-code generator (advisor WARN 0011).
create or replace function public.generate_duel_share_code()
returns text
language plpgsql
set search_path = ''
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
      select 1 from public.debate_duels where share_code = code
    );
  end loop;
  return code;
end;
$$;

-- Harden can_access_duel: only ever answers for the calling user.
create or replace function public.can_access_duel(p_duel_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_user_id is not distinct from auth.uid())
    and (
      exists (
        select 1 from public.debate_duels d
        where d.id = p_duel_id and d.creator_id = p_user_id
      )
      or exists (
        select 1 from public.debate_duel_participants p
        where p.duel_id = p_duel_id and p.user_id = p_user_id
      )
    );
$$;

-- Pure server-side helpers: never needed by anon.
revoke execute on function public.store_debate_duel_judgment(uuid, uuid, text, text, numeric, jsonb, text) from anon;
revoke execute on function public.finalize_debate_duel_stats(uuid, integer, integer) from anon;
revoke execute on function public.generate_duel_share_code() from anon;
