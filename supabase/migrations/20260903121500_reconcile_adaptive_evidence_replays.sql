-- Preserve the first accepted source atom before installing replay protection.
-- Historical retries produced duplicate evidence (including later rescoring of
-- deleted response IDs). First-write-wins matches the protected writer contract.
-- Keep every removed payload in a private audit table; no score/source row changes.
create schema if not exists private;
create table if not exists private.ielts_adaptive_evidence_replay_archive (
  evidence_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  retained_evidence_id uuid not null,
  evidence_row jsonb not null,
  archived_at timestamptz not null default now(),
  reason text not null default 'Superseded replay of an already accepted source atom'
);
alter table private.ielts_adaptive_evidence_replay_archive enable row level security;
revoke all on private.ielts_adaptive_evidence_replay_archive from public, anon, authenticated, service_role;

lock table public.ielts_adaptive_evidence in share row exclusive mode;
with ranked as (
  select e.*,
    first_value(id) over (
      partition by user_id, source_table, source_id, evidence_type, subskill_key
      order by created_at, id
    ) as retained_id,
    row_number() over (
      partition by user_id, source_table, source_id, evidence_type, subskill_key
      order by created_at, id
    ) as replay_number
  from public.ielts_adaptive_evidence e
)
insert into private.ielts_adaptive_evidence_replay_archive (
  evidence_id, user_id, retained_evidence_id, evidence_row
)
select id, user_id, retained_id, to_jsonb(ranked) - 'retained_id' - 'replay_number'
from ranked where replay_number > 1
on conflict (evidence_id) do nothing;

delete from public.ielts_adaptive_evidence e
using private.ielts_adaptive_evidence_replay_archive archived
where e.id = archived.evidence_id and to_jsonb(e) = archived.evidence_row;
-- Rebuild affected derived skill states with deriveIeltsSkillStates from the app
-- during the release reconciliation. The evidence remains the source of truth.
