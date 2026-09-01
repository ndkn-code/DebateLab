-- Benchmark slice metadata affects release metrics and therefore has the same
-- immutability requirements as examiner labels. Corrections must create a new
-- benchmark_key rather than rewriting a historical release population.

begin;

create or replace function private.prevent_ai_grading_benchmark_label_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.collection_id is distinct from old.collection_id
     or new.source_id is distinct from old.source_id
     or new.benchmark_key is distinct from old.benchmark_key
     or new.skill is distinct from old.skill
     or new.task_type is distinct from old.task_type
     or new.band_or_score_range is distinct from old.band_or_score_range
     or new.accent_group is distinct from old.accent_group
     or new.protected_label is distinct from old.protected_label
     or new.metadata is distinct from old.metadata
     or new.split is distinct from old.split then
    raise exception 'AI grading benchmark labels and provenance are immutable; create a new benchmark_key';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_ai_grading_benchmark_label_mutation()
  from public, anon, authenticated;

create or replace function private.prevent_active_benchmark_source_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  if exists (
    select 1
    from public.ai_grading_benchmarks benchmark
    where benchmark.source_id = v_source_id
      and benchmark.is_active = true
  ) then
    raise exception 'Sources used by active grading benchmarks are immutable; create a replacement source and benchmark';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_active_benchmark_source_mutation()
  from public, anon, authenticated;

drop trigger if exists ai_knowledge_sources_active_benchmark_immutable
  on public.ai_knowledge_sources;
create trigger ai_knowledge_sources_active_benchmark_immutable
  before update or delete on public.ai_knowledge_sources
  for each row execute function private.prevent_active_benchmark_source_mutation();

commit;
