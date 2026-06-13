-- ============================================================
-- Duel watchdog (forward-progress guarantee)
--
-- advance_overdue_debate_duels() force-advances any in_progress duel past its
-- server-owned phase_deadline so a silent/disconnected speaker can never
-- soft-lock the match. For an overdue speech phase with no submission it
-- inserts an empty placeholder speech (metadata.auto=true) for the active
-- side, then advances one phase. When the final speech phase elapses it moves
-- the duel to 'judging' (the Next.js judge route / pg_net handoff — built in a
-- later phase — finalizes from there).
--
-- NOTE: pg_cron scheduling is intentionally DEFERRED to the session that ships
-- the /judge endpoint + pg_net handoff, so we never leave a duel parked in
-- 'judging' with nothing to finish it. The function is complete and unit-
-- testable now. To schedule later:
--   create extension if not exists pg_cron;
--   select cron.schedule('duel-watchdog', '5 seconds',
--     $$select public.advance_overdue_debate_duels();$$);
-- ============================================================

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
    -- Speech phases: guarantee a row for the active side before advancing.
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
      set current_phase = 'judging',
          status = 'judging',
          phase_started_at = null,
          updated_at = now()
      where id = v_duel.id;
    else
      update public.debate_duels
      set current_phase = v_next,
          phase_started_at = now(),
          updated_at = now()
      where id = v_duel.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.advance_overdue_debate_duels() from public, anon, authenticated;
grant execute on function public.advance_overdue_debate_duels() to service_role;
