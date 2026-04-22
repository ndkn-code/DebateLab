-- ============================================================
-- Duel security hardening
-- ============================================================

create unique index if not exists idx_debate_duel_participants_duel_id_id
  on public.debate_duel_participants(duel_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debate_duel_speeches_duel_participant_fk'
  ) then
    alter table public.debate_duel_speeches
      add constraint debate_duel_speeches_duel_participant_fk
      foreign key (duel_id, participant_id)
      references public.debate_duel_participants(duel_id, id)
      on delete cascade;
  end if;
end $$;

drop policy if exists "Participants can insert duel speeches" on public.debate_duel_speeches;
create policy "Participants can insert duel speeches"
  on public.debate_duel_speeches for insert
  with check (
    exists (
      select 1
      from public.debate_duel_participants participant
      where participant.id = debate_duel_speeches.participant_id
        and participant.user_id = auth.uid()
        and participant.duel_id = debate_duel_speeches.duel_id
    )
  );

drop policy if exists "Participants can update own duel speeches" on public.debate_duel_speeches;
create policy "Participants can update own duel speeches"
  on public.debate_duel_speeches for update
  using (
    exists (
      select 1
      from public.debate_duel_participants participant
      where participant.id = debate_duel_speeches.participant_id
        and participant.user_id = auth.uid()
        and participant.duel_id = debate_duel_speeches.duel_id
    )
  )
  with check (
    exists (
      select 1
      from public.debate_duel_participants participant
      where participant.id = debate_duel_speeches.participant_id
        and participant.user_id = auth.uid()
        and participant.duel_id = debate_duel_speeches.duel_id
    )
  );

create or replace function public.store_debate_duel_judgment(
  p_duel_id uuid,
  p_winner_participant_id uuid,
  p_winner_side text,
  p_judge_model text,
  p_confidence numeric,
  p_verdict jsonb,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_duel(p_duel_id, auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.debate_duel_judgments (
    duel_id,
    winner_participant_id,
    winner_side,
    judge_model,
    confidence,
    verdict,
    summary,
    updated_at
  )
  values (
    p_duel_id,
    p_winner_participant_id,
    p_winner_side,
    p_judge_model,
    p_confidence,
    coalesce(p_verdict, '{}'::jsonb),
    coalesce(p_summary, ''),
    now()
  )
  on conflict (duel_id)
  do update set
    winner_participant_id = excluded.winner_participant_id,
    winner_side = excluded.winner_side,
    judge_model = excluded.judge_model,
    confidence = excluded.confidence,
    verdict = excluded.verdict,
    summary = excluded.summary,
    updated_at = now();
end;
$$;

drop policy if exists "Participants can insert duel judgments" on public.debate_duel_judgments;
