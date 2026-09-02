-- Advance new IELTS benchmark study rows to design V2 without rewriting V1
-- history. V1 rows may only pass this validator when their immutable metadata
-- is unchanged (for example, a consent-withdrawal deactivation).
create or replace function private.validate_ielts_benchmark_study_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_kind text;
  v_existing_split text;
  v_unchanged_historical_v1 boolean := false;
begin
  if new.skill not in ('ielts_speaking', 'ielts_writing') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_unchanged_historical_v1 :=
      old.metadata ->> 'studyDesignId' = 'debatelab-ielts-examiner-study'
      and old.metadata ->> 'studyDesignVersion' = '1'
      and new.metadata is not distinct from old.metadata;
  end if;

  if not v_unchanged_historical_v1 and (
    new.metadata ->> 'studyDesignId' is distinct from 'debatelab-ielts-examiner-study'
    or new.metadata ->> 'studyDesignVersion' is distinct from '2'
  ) then
    raise exception 'IELTS benchmark study design V2 is required';
  end if;

  if not new.is_active then
    return new;
  end if;
  if not (new.metadata ?& array[
    'candidateKey', 'promptFamilyKey', 'sourceGroupKey', 'captureSessionKey',
    'studyDesignId', 'studyDesignVersion'
  ]) then
    raise exception 'IELTS benchmark study grouping metadata is incomplete';
  end if;
  if new.protected_label #>> '{consent,withdrawal,status}' <> 'not_withdrawn'
     or new.protected_label #>> '{consent,scopes,commercialAiEvaluation}' <> 'true'
     or new.protected_label #>> '{consent,scopes,humanExaminerReview}' <> 'true' then
    raise exception 'IELTS benchmark consent is incomplete or withdrawn';
  end if;
  if new.split in ('evaluation', 'holdout')
     and new.protected_label #>> '{consent,scopes,futureVersionedReevaluation}' <> 'true' then
    raise exception 'Released benchmark requires future versioned re-evaluation consent';
  end if;
  if new.skill = 'ielts_speaking'
     and new.protected_label #>> '{consent,scopes,voiceProcessing}' <> 'true' then
    raise exception 'Speaking benchmark requires voice-processing consent';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai-benchmark-source:' || new.source_id::text, 0)
  );
  select benchmark.split into v_existing_split
  from public.ai_grading_benchmarks benchmark
  where benchmark.id <> new.id
    and benchmark.is_active
    and benchmark.skill in ('ielts_speaking', 'ielts_writing')
    and benchmark.source_id = new.source_id
  limit 1;
  if found and v_existing_split <> new.split then
    raise exception 'sourceId cannot cross benchmark splits';
  end if;

  foreach v_kind in array array[
    'candidateKey', 'promptFamilyKey', 'sourceGroupKey', 'captureSessionKey'
  ] loop
    v_key := new.metadata ->> v_kind;
    if coalesce(v_key, '') !~ '^[a-z0-9][a-z0-9._-]{7,127}$' then
      raise exception 'Invalid pseudonymous study key: %', v_kind;
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('ai-benchmark-group:' || v_kind || ':' || v_key, 0)
    );
    select benchmark.split into v_existing_split
    from public.ai_grading_benchmarks benchmark
    where benchmark.id <> new.id
      and benchmark.is_active
      and benchmark.skill in ('ielts_speaking', 'ielts_writing')
      and benchmark.metadata ->> v_kind = v_key
    limit 1;
    if found and v_existing_split <> new.split then
      raise exception '% cannot cross benchmark splits', v_kind;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.validate_ielts_benchmark_study_row()
  from public, anon, authenticated;
