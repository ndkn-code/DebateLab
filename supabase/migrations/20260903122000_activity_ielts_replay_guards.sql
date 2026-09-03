-- Aikido 618498548 / 618498565 / 618498648: serialize starts and make
-- activity evidence and assigned IELTS sittings replay-safe.

do $$
begin
  if exists (
    select 1 from public.activity_attempts
    where completed_at is null
    group by user_id, activity_id having count(*) > 1
  ) then
    raise exception 'Duplicate active activity attempts must be reconciled before this migration';
  end if;
end $$;

create unique index if not exists activity_attempts_one_active_uidx
  on public.activity_attempts(user_id, activity_id)
  where completed_at is null;

do $$
begin
  if exists (
    select 1 from public.ielts_adaptive_evidence
    group by user_id, source_table, source_id, evidence_type, subskill_key
    having count(*) > 1
  ) then
    raise exception 'Duplicate IELTS adaptive evidence must be reconciled before this migration';
  end if;
end $$;

create unique index if not exists ielts_adaptive_evidence_source_atom_uidx
  on public.ielts_adaptive_evidence(
    user_id, source_table, source_id, evidence_type, subskill_key
  );

do $$
begin
  if exists (
    select 1 from public.ielts_attempts
    where assignment_id is not null
      and status not in ('expired', 'abandoned')
    group by user_id, assignment_id having count(*) > 1
  ) then
    raise exception 'Duplicate live assigned IELTS attempts must be reconciled before this migration';
  end if;
end $$;

create unique index if not exists ielts_attempts_one_live_assignment_uidx
  on public.ielts_attempts(user_id, assignment_id)
  where assignment_id is not null
    and status not in ('expired', 'abandoned');
