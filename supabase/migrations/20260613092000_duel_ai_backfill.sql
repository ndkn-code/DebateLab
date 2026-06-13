-- ============================================================
-- AI-opponent backfill.
--
-- When no human is available, a matchmaking ticket is satisfied by an AI duel:
-- human = proposition (charged 200), AI = opposition (the sentinel AI user,
-- free), ai_opponent=true, rated=false. The human plays their turns normally;
-- the AI's turns are generated server-side (lib/debate-duels/ai-opponent.ts)
-- and submitted via submit_ai_duel_speech. The watchdog is taught to NOT
-- auto-placeholder the AI's phases (it waits for the client-driven /ai-turn).
--
-- The auth gates allow a service_role caller (auth.uid() IS NULL) so the shadow
-- harness can exercise the full flow; authenticated callers must act as
-- themselves / a participant.
-- ============================================================

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
  p_rebuttal_time_seconds integer
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
begin
  if auth.uid() is not null and auth.uid() <> p_human_user_id then
    raise exception 'FORBIDDEN';
  end if;
  if p_topic_difficulty not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'INVALID_DIFFICULTY';
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
  where user_id = p_human_user_id and status = 'queued';

  return v_share_code;
end;
$$;

revoke execute on function public.create_ai_backfill_duel(uuid, uuid, text, text, text, text, text, text, text, integer, integer, integer) from public, anon;
grant execute on function public.create_ai_backfill_duel(uuid, uuid, text, text, text, text, text, text, text, integer, integer, integer) to authenticated, service_role;

-- Insert the AI's (opposition) speech for the active round and advance the phase.
-- AI = opposition, so it speaks at round 2 (opening) and round 4 (rebuttal).
create or replace function public.submit_ai_duel_speech(
  p_duel_id uuid,
  p_round_number integer,
  p_transcript text,
  p_duration_seconds integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_ai_participant public.debate_duel_participants%rowtype;
  v_speech_type text;
  v_expected_phase text;
  v_next_phase text;
begin
  if auth.uid() is not null
    and not exists (
      select 1 from public.debate_duel_participants
      where duel_id = p_duel_id and user_id = auth.uid()
    )
  then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel from public.debate_duels where id = p_duel_id for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;
  if not coalesce(v_duel.ai_opponent, false) then raise exception 'NOT_AI_DUEL'; end if;
  if v_duel.status <> 'in_progress' then raise exception 'DUEL_NOT_IN_PROGRESS'; end if;

  if p_round_number = 2 then
    v_speech_type := 'opening'; v_expected_phase := 'opposition-opening'; v_next_phase := 'rebuttal-prep';
  elsif p_round_number = 4 then
    v_speech_type := 'rebuttal'; v_expected_phase := 'opposition-rebuttal'; v_next_phase := 'judging';
  else
    raise exception 'INVALID_AI_ROUND';
  end if;

  -- Not the AI's turn (or already advanced): idempotent no-op.
  if v_duel.current_phase <> v_expected_phase then
    return v_duel.current_phase;
  end if;

  if not exists (
    select 1 from public.debate_duel_speeches where duel_id = p_duel_id and round_number = p_round_number
  ) then
    select * into v_ai_participant from public.debate_duel_participants
    where duel_id = p_duel_id and role = 'opposition'
    limit 1;
    if not found then raise exception 'AI_PARTICIPANT_MISSING'; end if;

    insert into public.debate_duel_speeches (
      duel_id, participant_id, round_number, speech_type, side, transcript, duration_seconds, metadata
    )
    values (
      p_duel_id, v_ai_participant.id, p_round_number, v_speech_type, 'opposition',
      coalesce(p_transcript, ''), greatest(coalesce(p_duration_seconds, 0), 0),
      jsonb_build_object('ai', true)
    )
    on conflict (duel_id, round_number) do nothing;
  end if;

  update public.debate_duels
  set current_phase = v_next_phase,
      status = case when v_next_phase = 'judging' then 'judging' else 'in_progress' end,
      phase_started_at = case when v_next_phase = 'judging' then null else now() end,
      updated_at = now()
  where id = p_duel_id and current_phase = v_expected_phase;

  return v_next_phase;
end;
$$;

revoke execute on function public.submit_ai_duel_speech(uuid, integer, text, integer) from public, anon;
grant execute on function public.submit_ai_duel_speech(uuid, integer, text, integer) to authenticated, service_role;

-- Teach the watchdog to leave the AI's turn alone (no empty placeholder): the
-- client-driven /ai-turn generates + submits the AI speech. AI = opposition.
create or replace function public.advance_overdue_debate_duels()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_next text;
  v_round integer;
  v_side text;
  v_speech_type text;
  v_participant public.debate_duel_participants%rowtype;
  v_count integer := 0;
begin
  for v_duel in
    select *
    from public.debate_duels
    where status = 'in_progress'
      and phase_deadline is not null
      and phase_deadline < now()
    order by phase_deadline asc
    for update skip locked
  loop
    -- AI-backfill duels: don't auto-advance the AI's (opposition) speech phases;
    -- the client-driven /ai-turn generates the AI speech instead of leaving an
    -- empty placeholder.
    if coalesce(v_duel.ai_opponent, false)
      and v_duel.current_phase in ('opposition-opening', 'opposition-rebuttal')
    then
      continue;
    end if;

    if v_duel.current_phase in (
      'proposition-opening', 'opposition-opening',
      'proposition-rebuttal', 'opposition-rebuttal'
    ) then
      v_round := case v_duel.current_phase
        when 'proposition-opening' then 1
        when 'opposition-opening' then 2
        when 'proposition-rebuttal' then 3
        when 'opposition-rebuttal' then 4
      end;
      v_side := case when v_duel.current_phase like 'proposition%' then 'proposition' else 'opposition' end;
      v_speech_type := case when v_duel.current_phase like '%opening' then 'opening' else 'rebuttal' end;

      if not exists (
        select 1 from public.debate_duel_speeches
        where duel_id = v_duel.id and round_number = v_round
      ) then
        select * into v_participant
        from public.debate_duel_participants
        where duel_id = v_duel.id and role = v_side
        limit 1;

        if found then
          insert into public.debate_duel_speeches (
            duel_id, participant_id, round_number, speech_type, side,
            transcript, duration_seconds, metadata
          )
          values (
            v_duel.id, v_participant.id, v_round, v_speech_type, v_side,
            '', 0, jsonb_build_object('auto', true, 'reason', 'phase_timeout')
          )
          on conflict (duel_id, round_number) do nothing;
        end if;
      end if;
    end if;

    v_next := case v_duel.current_phase
      when 'prep' then 'proposition-opening'
      when 'proposition-opening' then 'opposition-opening'
      when 'opposition-opening' then 'rebuttal-prep'
      when 'rebuttal-prep' then 'proposition-rebuttal'
      when 'proposition-rebuttal' then 'opposition-rebuttal'
      when 'opposition-rebuttal' then 'judging'
      else 'judging'
    end;

    if v_next = 'judging' then
      update public.debate_duels
      set current_phase = 'judging', status = 'judging', phase_started_at = null, updated_at = now()
      where id = v_duel.id;
    else
      update public.debate_duels
      set current_phase = v_next, phase_started_at = now(), updated_at = now()
      where id = v_duel.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.advance_overdue_debate_duels() from public, anon, authenticated;
grant execute on function public.advance_overdue_debate_duels() to service_role;
