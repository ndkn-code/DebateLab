-- Explicit AI choice: bind creation to an owned, live queue ticket.
-- This migration does not change the price, ledger entries, start rules, or RLS.
-- Remove the unbound signature so old clients fail closed rather than charging.
drop function if exists public.create_ai_backfill_duel(uuid, uuid, text, text, text, text, text, text, text, integer, integer, integer);

create or replace function public.create_ai_backfill_duel(
  p_human_user_id uuid,
  p_ai_user_id uuid,
  p_practice_topic_key text,
  p_topic_title text,
  p_topic_category text,
  p_topic_category_key text,
  p_topic_difficulty text,
  p_topic_description text,
  p_practice_language text,
  p_prep_time_seconds integer,
  p_opening_time_seconds integer,
  p_rebuttal_time_seconds integer,
  p_ticket_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share_code text;
  v_duel_id uuid;
  v_human public.profiles%rowtype;
  v_ai public.profiles%rowtype;
  v_human_balance integer;
  v_ticket public.debate_duel_matchmaking_tickets%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_human_user_id then
    raise exception 'FORBIDDEN';
  end if;
  if p_topic_difficulty not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'INVALID_DIFFICULTY';
  end if;

  -- The ticket is both the consent target and idempotency key. Human matching
  -- and cancellation lock this same row, so only the winning action proceeds.
  select * into v_ticket
  from public.debate_duel_matchmaking_tickets
  where id = p_ticket_id and user_id = p_human_user_id
  for update;
  if not found then raise exception 'TICKET_NOT_FOUND'; end if;

  if v_ticket.status = 'matched' and v_ticket.matched_duel_id is not null then
    select share_code into v_share_code from public.debate_duels
    where id = v_ticket.matched_duel_id;
    return v_share_code;
  end if;
  if v_ticket.status <> 'queued' or v_ticket.expires_at <= now() then
    raise exception 'TICKET_NOT_QUEUED';
  end if;
  if v_ticket.practice_language is distinct from p_practice_language
    or v_ticket.topic_category_key is distinct from p_topic_category_key
    or v_ticket.topic_difficulty is distinct from p_topic_difficulty
    or v_ticket.prep_time_seconds <> p_prep_time_seconds
    or v_ticket.opening_time_seconds <> p_opening_time_seconds
    or v_ticket.rebuttal_time_seconds <> p_rebuttal_time_seconds then
    raise exception 'TICKET_SETTINGS_CHANGED';
  end if;

  select orb_balance into v_human_balance from public.profiles where id = p_human_user_id for update;
  if coalesce(v_human_balance, 0) < 200 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  select * into v_human from public.profiles where id = p_human_user_id;
  select * into v_ai from public.profiles where id = p_ai_user_id;
  if v_ai.id is null then
    raise exception 'AI_OPPONENT_MISSING';
  end if;

  v_share_code := public.generate_duel_share_code();

  insert into public.debate_duels (
    share_code, creator_id, practice_topic_key, topic_title, topic_category, topic_category_key,
    topic_difficulty, topic_description, practice_language,
    prep_time_seconds, opening_time_seconds, rebuttal_time_seconds,
    entry_cost, side_assignment_mode, creator_side_preference, duel_kind, rated, ai_opponent,
    status, current_phase, phase_started_at, started_at
  )
  values (
    v_share_code, p_human_user_id, p_practice_topic_key, p_topic_title, p_topic_category, p_topic_category_key,
    p_topic_difficulty, p_topic_description, coalesce(p_practice_language, 'en'),
    p_prep_time_seconds, p_opening_time_seconds, p_rebuttal_time_seconds,
    200, 'choose', 'proposition', 'matchmaking', false, true,
    'in_progress', 'prep', now(), now()
  )
  returning id into v_duel_id;

  update public.profiles set orb_balance = orb_balance - 200 where id = p_human_user_id;
  insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  values (p_human_user_id, -200, 'duel_entry', v_duel_id, v_human_balance - 200);

  insert into public.debate_duel_participants (
    duel_id, user_id, role, ready_at, credits_charged_at, display_name_snapshot, avatar_url_snapshot
  )
  values
    (v_duel_id, p_human_user_id, 'proposition', now(), now(), coalesce(v_human.display_name, 'Debater'), v_human.avatar_url),
    (v_duel_id, p_ai_user_id, 'opposition', now(), now(), coalesce(v_ai.display_name, 'AI Sparring Partner'), v_ai.avatar_url);

  -- Resolve the human's queued ticket so the matchmaking poll redirects them in.
  update public.debate_duel_matchmaking_tickets
  set status = 'matched', matched_duel_id = v_duel_id, matched_at = now(), updated_at = now()
  where id = v_ticket.id and status = 'queued';

  return v_share_code;
end;
$$;

revoke execute on function public.create_ai_backfill_duel(uuid, uuid, text, text, text, text, text, text, text, integer, integer, integer, uuid) from public, anon;
grant execute on function public.create_ai_backfill_duel(uuid, uuid, text, text, text, text, text, text, text, integer, integer, integer, uuid) to authenticated, service_role;
