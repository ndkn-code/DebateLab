-- ============================================================
-- Duel rating internalization + forfeit asymmetry + refunds
--
-- 1. Adds outcome/forfeit/ai_opponent columns.
-- 2. Restores the orb_transactions 'duel_entry' type (a later migration
--    dropped it) and adds 'duel_refund' for abandonment refunds.
-- 3. Splits the (already-complete) Elo math into a service-role-callable
--    *_internal function so the watchdog / shadow tests / forfeit path can
--    run it without an auth.uid() participant context. The public
--    process_debate_duel_rating keeps its auth gate and delegates.
-- 4. Adds forfeit Elo: the forfeiter takes a hidden MMR loss; the opponent
--    gains nothing (asymmetric).
-- 5. Adds forfeit_debate_duel(): full refund to the non-forfeiter, none to
--    the forfeiter (both if abandoned before any human speech), resolves the
--    duel, and applies the forfeit Elo for rated matchmaking duels.
-- ============================================================

-- 1) Outcome + AI-opponent columns -------------------------------------------
alter table public.debate_duels
  add column if not exists outcome_reason text,
  add column if not exists forfeited_by uuid references auth.users(id) on delete set null,
  add column if not exists ai_opponent boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'debate_duels_outcome_reason_check') then
    alter table public.debate_duels
      add constraint debate_duels_outcome_reason_check
      check (outcome_reason is null or outcome_reason in ('judged', 'forfeit', 'abandoned', 'expired'));
  end if;
end $$;

-- 2) Refund transaction type (preserve full current set + duel_entry) --------
alter table public.orb_transactions drop constraint if exists orb_transactions_type_check;
alter table public.orb_transactions
  add constraint orb_transactions_type_check
  check (type in (
    'signup_bonus',
    'referral_reward',
    'referral_bonus',
    'practice_quick',
    'practice_full',
    'practice_speaking',
    'practice_debate',
    'admin_grant',
    'feedback_reward',
    'duel_entry',
    'duel_refund'
  ));

-- 3) Internalized judged-rating Elo (no auth gate; service-role callable) -----
create or replace function public.process_debate_duel_rating_internal(p_duel_id uuid)
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
  select * into v_duel from public.debate_duels where id = p_duel_id for update;
  if not found then return false; end if;
  if v_duel.rating_processed_at is not null then return false; end if;

  if coalesce(v_duel.duel_kind, 'custom') <> 'matchmaking'
     or not v_duel.rated
     or coalesce(v_duel.ai_opponent, false) then
    update public.debate_duels
    set rating_processed_at = now(), rating_excluded_reason = 'unrated_duel', updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  if v_duel.status <> 'completed' then return false; end if;

  if v_duel.integrity_status in ('suspicious', 'no_contest') then
    update public.debate_duels
    set rating_processed_at = now(), rating_excluded_reason = 'integrity_' || v_duel.integrity_status, updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  select * into v_judgment from public.debate_duel_judgments where duel_id = v_duel.id for update;
  if not found or v_judgment.winner_participant_id is null then return false; end if;

  if coalesce(v_judgment.confidence, 0) < 0.55 then
    update public.debate_duels
    set rating_processed_at = now(), rating_excluded_reason = 'low_judge_confidence', updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  select * into v_winner from public.debate_duel_participants
  where id = v_judgment.winner_participant_id and duel_id = v_duel.id;

  select * into v_loser from public.debate_duel_participants
  where duel_id = v_duel.id and id <> v_judgment.winner_participant_id
  limit 1;

  if not found or v_winner.user_id is null or v_loser.user_id is null then return false; end if;

  insert into public.duel_mmr_profiles (user_id) values (v_winner.user_id) on conflict (user_id) do nothing;
  insert into public.duel_mmr_profiles (user_id) values (v_loser.user_id) on conflict (user_id) do nothing;

  select * into v_winner_mmr from public.duel_mmr_profiles where user_id = v_winner.user_id for update;
  select * into v_loser_mmr from public.duel_mmr_profiles where user_id = v_loser.user_id for update;

  v_winner_expected := 1 / (1 + power(10::numeric, ((v_loser_mmr.rating - v_winner_mmr.rating) / 400)));
  v_loser_expected := 1 / (1 + power(10::numeric, ((v_winner_mmr.rating - v_loser_mmr.rating) / 400)));

  v_winner_k := case
    when v_winner_mmr.provisional or v_winner_mmr.matches_count < 5 then 40
    when v_winner_mmr.matches_count < 20 then 32
    else 24 end;
  v_loser_k := case
    when v_loser_mmr.provisional or v_loser_mmr.matches_count < 5 then 40
    when v_loser_mmr.matches_count < 20 then 32
    else 24 end;

  v_winner_delta := round((v_winner_k * (1 - v_winner_expected))::numeric, 2);
  v_loser_delta := round((v_loser_k * (0 - v_loser_expected))::numeric, 2);

  update public.duel_mmr_profiles
  set rating = rating + v_winner_delta,
      matches_count = matches_count + 1,
      wins = wins + 1,
      provisional = (matches_count + 1) < 10,
      last_match_at = now(), updated_at = now()
  where user_id = v_winner.user_id;

  update public.duel_mmr_profiles
  set rating = greatest(0, rating + v_loser_delta),
      matches_count = matches_count + 1,
      losses = losses + 1,
      provisional = (matches_count + 1) < 10,
      last_match_at = now(), updated_at = now()
  where user_id = v_loser.user_id;

  insert into public.duel_rating_events (
    duel_id, user_id, opponent_user_id, result,
    rating_before, rating_after, rating_delta, expected_score, k_factor, integrity_status, judge_confidence
  )
  values
    (v_duel.id, v_winner.user_id, v_loser.user_id, 'win',
     v_winner_mmr.rating, v_winner_mmr.rating + v_winner_delta, v_winner_delta, v_winner_expected, v_winner_k, v_duel.integrity_status, v_judgment.confidence),
    (v_duel.id, v_loser.user_id, v_winner.user_id, 'loss',
     v_loser_mmr.rating, greatest(0, v_loser_mmr.rating + v_loser_delta), v_loser_delta, v_loser_expected, v_loser_k, v_duel.integrity_status, v_judgment.confidence);

  update public.debate_duels
  set rating_processed_at = now(), rating_excluded_reason = null, updated_at = now()
  where id = v_duel.id;

  return true;
end;
$$;

-- Public wrapper keeps the participant auth gate, delegates the math.
create or replace function public.process_debate_duel_rating(p_duel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not exists (
      select 1 from public.debate_duel_participants
      where duel_id = p_duel_id and user_id = auth.uid()
    )
  then
    raise exception 'FORBIDDEN';
  end if;
  return public.process_debate_duel_rating_internal(p_duel_id);
end;
$$;

-- 4) Forfeit Elo: forfeiter loses, opponent gains nothing --------------------
create or replace function public.process_debate_duel_forfeit_internal(
  p_duel_id uuid,
  p_forfeiter_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_forfeiter public.debate_duel_participants%rowtype;
  v_opponent public.debate_duel_participants%rowtype;
  v_forfeiter_mmr public.duel_mmr_profiles%rowtype;
  v_opponent_mmr public.duel_mmr_profiles%rowtype;
  v_expected numeric;
  v_k integer;
  v_delta numeric(8,2);
begin
  select * into v_duel from public.debate_duels where id = p_duel_id for update;
  if not found then return false; end if;
  if v_duel.rating_processed_at is not null then return false; end if;

  if coalesce(v_duel.duel_kind, 'custom') <> 'matchmaking'
     or not v_duel.rated
     or coalesce(v_duel.ai_opponent, false) then
    update public.debate_duels
    set rating_processed_at = now(), rating_excluded_reason = 'unrated_duel', updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  if v_duel.integrity_status in ('suspicious', 'no_contest') then
    update public.debate_duels
    set rating_processed_at = now(), rating_excluded_reason = 'integrity_' || v_duel.integrity_status, updated_at = now()
    where id = v_duel.id;
    return false;
  end if;

  select * into v_forfeiter from public.debate_duel_participants
  where duel_id = v_duel.id and user_id = p_forfeiter_user_id;
  if not found then return false; end if;

  select * into v_opponent from public.debate_duel_participants
  where duel_id = v_duel.id and user_id <> p_forfeiter_user_id
  limit 1;
  if not found or v_opponent.user_id is null then return false; end if;

  insert into public.duel_mmr_profiles (user_id) values (v_forfeiter.user_id) on conflict (user_id) do nothing;
  insert into public.duel_mmr_profiles (user_id) values (v_opponent.user_id) on conflict (user_id) do nothing;

  select * into v_forfeiter_mmr from public.duel_mmr_profiles where user_id = v_forfeiter.user_id for update;
  select * into v_opponent_mmr from public.duel_mmr_profiles where user_id = v_opponent.user_id for update;

  v_expected := 1 / (1 + power(10::numeric, ((v_opponent_mmr.rating - v_forfeiter_mmr.rating) / 400)));
  v_k := case
    when v_forfeiter_mmr.provisional or v_forfeiter_mmr.matches_count < 5 then 40
    when v_forfeiter_mmr.matches_count < 20 then 32
    else 24 end;
  v_delta := round((v_k * (0 - v_expected))::numeric, 2);

  update public.duel_mmr_profiles
  set rating = greatest(0, rating + v_delta),
      matches_count = matches_count + 1,
      losses = losses + 1,
      provisional = (matches_count + 1) < 10,
      last_match_at = now(), updated_at = now()
  where user_id = v_forfeiter.user_id;

  -- Opponent intentionally untouched: a forfeit win yields no rating gain.

  insert into public.duel_rating_events (
    duel_id, user_id, opponent_user_id, result,
    rating_before, rating_after, rating_delta, expected_score, k_factor, integrity_status, judge_confidence
  )
  values (
    v_duel.id, v_forfeiter.user_id, v_opponent.user_id, 'loss',
    v_forfeiter_mmr.rating, greatest(0, v_forfeiter_mmr.rating + v_delta), v_delta, v_expected, v_k, v_duel.integrity_status, null
  );

  update public.debate_duels
  set rating_processed_at = now(), rating_excluded_reason = null, updated_at = now()
  where id = v_duel.id;

  return true;
end;
$$;

-- 5) Forfeit RPC: refunds + resolution + forfeit Elo -------------------------
create or replace function public.forfeit_debate_duel(
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
  v_actor public.debate_duel_participants%rowtype;
  v_opponent public.debate_duel_participants%rowtype;
  v_speech_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel from public.debate_duels
  where share_code = upper(trim(p_share_code))
  for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;

  select * into v_actor from public.debate_duel_participants
  where duel_id = v_duel.id and user_id = p_actor_user_id;
  if not found then raise exception 'DUEL_JOIN_REQUIRED'; end if;

  -- Pre-start lobby: cancel, no charge so no refund, no rating.
  if v_duel.status = 'lobby' then
    update public.debate_duels
    set status = 'cancelled', current_phase = 'completed', outcome_reason = 'abandoned',
        forfeited_by = p_actor_user_id, completed_at = now(), updated_at = now()
    where id = v_duel.id;
    update public.debate_duel_participants
    set completed_at = now(), updated_at = now()
    where duel_id = v_duel.id;
    return v_duel.id;
  end if;

  if v_duel.status <> 'in_progress' then
    raise exception 'DUEL_NOT_FORFEITABLE';
  end if;

  select * into v_opponent from public.debate_duel_participants
  where duel_id = v_duel.id and user_id <> p_actor_user_id
  limit 1;

  select count(*) into v_speech_count
  from public.debate_duel_speeches where duel_id = v_duel.id;

  -- Refunds (human duels only): non-forfeiter always made whole; forfeiter
  -- refunded only when nobody has spoken yet (clean abandon).
  if v_duel.entry_cost > 0 and not coalesce(v_duel.ai_opponent, false) then
    if v_opponent.user_id is not null then
      perform public.adjust_orb_balance(v_opponent.user_id, v_duel.entry_cost, 'duel_refund', v_duel.id);
    end if;
    if v_speech_count = 0 then
      perform public.adjust_orb_balance(v_actor.user_id, v_duel.entry_cost, 'duel_refund', v_duel.id);
    end if;
  end if;

  update public.debate_duels
  set status = 'completed', current_phase = 'completed', outcome_reason = 'forfeit',
      forfeited_by = p_actor_user_id, completed_at = now(), updated_at = now()
  where id = v_duel.id;

  update public.debate_duel_participants
  set completed_at = now(), updated_at = now()
  where duel_id = v_duel.id;

  -- Hidden MMR: forfeiter loses, opponent no gain (rated matchmaking only).
  perform public.process_debate_duel_forfeit_internal(v_duel.id, p_actor_user_id);

  return v_duel.id;
end;
$$;

-- Grants: internals are service-role only; the public RPCs keep their gates.
revoke execute on function public.process_debate_duel_rating_internal(uuid) from public, anon, authenticated;
grant execute on function public.process_debate_duel_rating_internal(uuid) to service_role;

revoke execute on function public.process_debate_duel_forfeit_internal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.process_debate_duel_forfeit_internal(uuid, uuid) to service_role;

revoke execute on function public.forfeit_debate_duel(text, uuid) from public, anon;
grant execute on function public.forfeit_debate_duel(text, uuid) to authenticated, service_role;

revoke execute on function public.process_debate_duel_rating(uuid) from public, anon;
grant execute on function public.process_debate_duel_rating(uuid) to authenticated, service_role;
