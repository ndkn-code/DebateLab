-- Protected IELTS benchmark labels are append-only. Corrections require a new
-- benchmark_key so historical release decisions remain reproducible.

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
     or new.split is distinct from old.split then
    raise exception 'AI grading benchmark labels and provenance are immutable; create a new benchmark_key';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_ai_grading_benchmark_label_mutation()
  from public, anon, authenticated;

drop trigger if exists prevent_ai_grading_benchmark_label_mutation
  on public.ai_grading_benchmarks;
create trigger prevent_ai_grading_benchmark_label_mutation
  before update on public.ai_grading_benchmarks
  for each row execute function private.prevent_ai_grading_benchmark_label_mutation();

