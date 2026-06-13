-- ============================================================
-- store_debate_duel_judgment: allow the no-cookie finalize path
--
-- The pg_net judging handoff (and the shadow tests) finalize a duel with the
-- service-role client, where auth.uid() is null. The previous gate
-- (`if not can_access_duel(p_duel_id, auth.uid())`) rejected that because
-- can_access_duel(..., null) is always false. Mirror the
-- finalize_debate_duel_stats gate instead: authenticated callers must still be
-- a participant; service_role / SECURITY DEFINER callers (auth.uid() = null)
-- pass. anon stays revoked (migration 20260613090300), so this opens nothing to
-- untrusted callers.
-- ============================================================

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
  -- Authenticated callers may only write a verdict for a duel they can access;
  -- service_role callers (auth.uid() = null) are trusted server code and pass.
  if auth.uid() is not null and not public.can_access_duel(p_duel_id, auth.uid()) then
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
