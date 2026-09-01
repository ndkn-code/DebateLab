begin;

do $$
declare
  collection_id_value uuid;
  source_id_value uuid;
  benchmark_id_value uuid;
begin
  insert into public.ai_knowledge_collections (
    slug, domain, language, embedding_provider, embedding_model
  ) values (
    'ielts.benchmark-lock-test', 'ielts', 'en', 'voyage', 'voyage-4-large'
  ) returning id into collection_id_value;

  insert into public.ai_knowledge_sources (
    canonical_url, authority_tier, rights_status, review_status, checksum
  ) values (
    'https://example.invalid/benchmark-lock-test',
    'official',
    'approved_for_derived_use',
    'approved',
    repeat('a', 64)
  ) returning id into source_id_value;

  insert into public.ai_grading_benchmarks (
    collection_id, source_id, benchmark_key, skill, task_type,
    protected_label, split
  ) values (
    collection_id_value,
    source_id_value,
    'benchmark-lock-test',
    'ielts_writing',
    'writing_task2_essay',
    '{"criteria":{"taskResponse":{"band":6}}}'::jsonb,
    'holdout'
  ) returning id into benchmark_id_value;

  -- Operational fields remain mutable so a benchmark can be retired without
  -- destroying its protected label.
  update public.ai_grading_benchmarks
  set is_active = false,
      metadata = '{"retired":true}'::jsonb
  where id = benchmark_id_value;

  begin
    update public.ai_grading_benchmarks
    set protected_label = '{"criteria":{"taskResponse":{"band":7}}}'::jsonb
    where id = benchmark_id_value;
    raise exception 'Expected protected benchmark label update to fail';
  exception
    when others then
      if sqlerrm = 'Expected protected benchmark label update to fail' then
        raise;
      end if;
      if position('immutable' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

rollback;
