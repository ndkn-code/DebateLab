-- ============================================================
-- Duel server-authoritative clock
-- Adds a DB-owned phase deadline so timers no longer depend on the
-- client clock. A trigger keeps debate_duels.phase_deadline correct
-- whenever the phase, phase_started_at, status, or timer config changes,
-- regardless of whether the server route or the watchdog drives the
-- transition. Non-invasive: existing phase-advance writes need no change.
-- ============================================================

alter table public.debate_duels
  add column if not exists phase_deadline timestamptz;

-- Canonical per-phase duration (mirrors apps/web/src/lib/debate-duels/shared.ts DUEL_PHASES).
create or replace function public.duel_phase_duration(
  p_phase text,
  p_prep_time_seconds integer,
  p_opening_time_seconds integer,
  p_rebuttal_time_seconds integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_phase
    when 'prep' then coalesce(p_prep_time_seconds, 120)
    when 'proposition-opening' then coalesce(p_opening_time_seconds, 180)
    when 'opposition-opening' then coalesce(p_opening_time_seconds, 180)
    when 'rebuttal-prep' then greatest(30, least(coalesce(p_prep_time_seconds, 120), 60))
    when 'proposition-rebuttal' then coalesce(p_rebuttal_time_seconds, 120)
    when 'opposition-rebuttal' then coalesce(p_rebuttal_time_seconds, 120)
    else 0
  end;
$$;

create or replace function public.debate_duels_set_phase_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.status = 'in_progress'
     and NEW.phase_started_at is not null
     and NEW.current_phase in (
       'prep',
       'proposition-opening',
       'opposition-opening',
       'rebuttal-prep',
       'proposition-rebuttal',
       'opposition-rebuttal'
     )
  then
    NEW.phase_deadline := NEW.phase_started_at
      + make_interval(secs => public.duel_phase_duration(
          NEW.current_phase,
          NEW.prep_time_seconds,
          NEW.opening_time_seconds,
          NEW.rebuttal_time_seconds
        ));
  else
    -- lobby / judging / completed / expired / cancelled have no live deadline
    NEW.phase_deadline := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_debate_duels_phase_deadline on public.debate_duels;
create trigger trg_debate_duels_phase_deadline
  before insert or update of
    current_phase,
    phase_started_at,
    status,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds
  on public.debate_duels
  for each row
  execute function public.debate_duels_set_phase_deadline();

-- Backfill any live duels (none expected in current prototype state).
update public.debate_duels
set phase_deadline = phase_started_at
  + make_interval(secs => public.duel_phase_duration(
      current_phase, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds
    ))
where status = 'in_progress'
  and phase_started_at is not null
  and current_phase in (
    'prep','proposition-opening','opposition-opening',
    'rebuttal-prep','proposition-rebuttal','opposition-rebuttal'
  );

-- Index to let the watchdog cheaply find overdue duels.
create index if not exists idx_debate_duels_overdue
  on public.debate_duels(status, phase_deadline)
  where status = 'in_progress';

-- Helper functions are internal; keep them off the public RPC surface.
revoke execute on function public.duel_phase_duration(text, integer, integer, integer) from public, anon;
