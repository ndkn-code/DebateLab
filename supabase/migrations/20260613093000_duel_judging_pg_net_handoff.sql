-- ============================================================
-- Duel judging pg_net handoff (no-client fallback)
--
-- When BOTH debaters disconnect after the final rebuttal, the watchdog
-- (advance_overdue_debate_duels) parks the duel in `judging` — but the AI
-- judging itself runs in the Next.js layer (the LLM call), so Postgres cannot
-- finish it alone. With a live client present, the Phase 2 client backstop
-- pokes /judge. With nobody present, this job hands off over HTTP via pg_net to
-- that same /judge endpoint, which authenticates the call with a shared secret
-- and finalizes through the service-role client (judgeDebateDuelRoomInternal).
--
-- Config (deploy-time; read from Supabase Vault so no secret lives in SQL):
--   select vault.create_secret('https://app.thinkfy.net', 'duel_judge_endpoint');
--   select vault.create_secret('<DUEL_WATCHDOG_SECRET value>', 'duel_watchdog_secret');
-- The same secret must be set as DUEL_WATCHDOG_SECRET (or CRON_SECRET) in the
-- web app env. Until both Vault secrets exist the job is a safe no-op, so this
-- migration is safe to apply well ahead of launch.
-- ============================================================

create extension if not exists pg_net;

-- Backoff / idempotency marker so we never re-POST every tick while an LLM
-- judging request is still in flight.
alter table public.debate_duels
  add column if not exists judge_dispatched_at timestamptz;

create or replace function public.dispatch_overdue_duel_judging()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_secret text;
  v_duel record;
  v_count integer := 0;
begin
  select decrypted_secret into v_base
  from vault.decrypted_secrets
  where name = 'duel_judge_endpoint'
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'duel_watchdog_secret'
  limit 1;

  -- Not configured yet (pre-launch) → safe no-op.
  if v_base is null or v_secret is null then
    return 0;
  end if;
  v_base := rtrim(v_base, '/');

  for v_duel in
    select id, share_code
    from public.debate_duels
    where status = 'judging'
      and completed_at is null
      -- Grace window: let a present client's backstop finish first.
      and updated_at < now() - interval '20 seconds'
      -- Retry backoff: only re-dispatch once the last handoff has gone stale.
      and (
        judge_dispatched_at is null
        or judge_dispatched_at < now() - interval '90 seconds'
      )
    order by updated_at asc
    for update skip locked
    limit 25
  loop
    perform net.http_post(
      url := v_base || '/api/debate-duels/' || v_duel.share_code || '/judge',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 55000
    );

    update public.debate_duels
    set judge_dispatched_at = now(),
        updated_at = now()
    where id = v_duel.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.dispatch_overdue_duel_judging() from public, anon, authenticated;
grant execute on function public.dispatch_overdue_duel_judging() to service_role;

-- Runs every 15s; a no-op until the Vault secrets above are set.
select cron.schedule(
  'duel-judging-dispatch',
  '15 seconds',
  $$select public.dispatch_overdue_duel_judging();$$
);
