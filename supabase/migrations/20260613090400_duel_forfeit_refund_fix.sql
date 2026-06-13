-- ============================================================
-- Fix duel forfeit refunds.
--
-- adjust_orb_balance() was hardened by a later migration into a *practice-only,
-- self-only* helper: it raises FORBIDDEN unless auth.uid() = p_user_id, and
-- rejects any type other than practice_speaking / practice_debate. A
-- SECURITY DEFINER forfeit therefore cannot use it to refund the OPPONENT
-- (different user) with a 'duel_refund' type. Inline the refund instead —
-- exactly how start_debate_duel charges entry credits directly — and
-- internalize the forfeit so the (future) watchdog and shadow tests can drive
-- it without an auth context.
-- ============================================================

create or replace function public.forfeit_debate_duel_internal(
  p_duel_id uuid,
  p_forfeiter_user_id uuid
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
  v_balance integer;
begin
  select * into v_duel from public.debate_duels where id = p_duel_id for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;

  select * into v_actor from public.debate_duel_participants
  where duel_id = v_duel.id and user_id = p_forfeiter_user_id;
  if not found then raise exception 'DUEL_JOIN_REQUIRED'; end if;

  -- Pre-start lobby: cancel, no charge so no refund, no rating.
  if v_duel.status = 'lobby' then
    update public.debate_duels
    set status = 'cancelled', current_phase = 'completed', outcome_reason = 'abandoned',
        forfeited_by = p_forfeiter_user_id, completed_at = now(), updated_at = now()
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
  where duel_id = v_duel.id and user_id <> p_forfeiter_user_id
  limit 1;

  select count(*) into v_speech_count
  from public.debate_duel_speeches where duel_id = v_duel.id;

  -- Refunds (human duels only): non-forfeiter always made whole; forfeiter
  -- refunded only when nobody has spoken yet (clean abandon). Inlined because
  -- adjust_orb_balance is self-only + practice-only.
  if v_duel.entry_cost > 0 and not coalesce(v_duel.ai_opponent, false) then
    if v_opponent.user_id is not null then
      update public.profiles
      set orb_balance = orb_balance + v_duel.entry_cost, updated_at = now()
      where id = v_opponent.user_id
      returning orb_balance into v_balance;
      insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
      values (v_opponent.user_id, v_duel.entry_cost, 'duel_refund', v_duel.id, v_balance);
    end if;
    if v_speech_count = 0 then
      update public.profiles
      set orb_balance = orb_balance + v_duel.entry_cost, updated_at = now()
      where id = v_actor.user_id
      returning orb_balance into v_balance;
      insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
      values (v_actor.user_id, v_duel.entry_cost, 'duel_refund', v_duel.id, v_balance);
    end if;
  end if;

  update public.debate_duels
  set status = 'completed', current_phase = 'completed', outcome_reason = 'forfeit',
      forfeited_by = p_forfeiter_user_id, completed_at = now(), updated_at = now()
  where id = v_duel.id;

  update public.debate_duel_participants
  set completed_at = now(), updated_at = now()
  where duel_id = v_duel.id;

  -- Hidden MMR: forfeiter loses, opponent no gain (rated matchmaking only).
  perform public.process_debate_duel_forfeit_internal(v_duel.id, p_forfeiter_user_id);

  return v_duel.id;
end;
$$;

-- Thin auth wrapper: resolve share code, verify caller is the actor + a
-- participant, delegate to the internal resolver.
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
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel from public.debate_duels
  where share_code = upper(trim(p_share_code));
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;

  select * into v_actor from public.debate_duel_participants
  where duel_id = v_duel.id and user_id = p_actor_user_id;
  if not found then raise exception 'DUEL_JOIN_REQUIRED'; end if;

  return public.forfeit_debate_duel_internal(v_duel.id, p_actor_user_id);
end;
$$;

revoke execute on function public.forfeit_debate_duel_internal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.forfeit_debate_duel_internal(uuid, uuid) to service_role;

revoke execute on function public.forfeit_debate_duel(text, uuid) from public, anon;
grant execute on function public.forfeit_debate_duel(text, uuid) to authenticated, service_role;
