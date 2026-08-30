-- Run after `supabase db reset` (or against a disposable preview database):
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/20260829110000_ai_knowledge_platform_contract.sql
begin;

do $$
declare
  v_collection_id uuid;
  v_source_id uuid;
  v_item_id uuid;
  v_embedding extensions.vector(1024);
  v_rejected boolean := false;
  v_allowed_count integer;
  v_wrong_model_count integer;
  v_test_version integer;
  v_original_version integer;
begin
  if to_regclass('public.ai_knowledge_collections') is null
     or to_regclass('public.ai_grading_evaluations') is null then
    raise exception 'AI knowledge platform tables are missing';
  end if;

  if (select count(*) from public.ai_knowledge_collections where slug in (
    'debate.vi.truong_teen', 'debate.en.competitive', 'ielts.speaking', 'ielts.writing'
  )) <> 4 then
    raise exception 'AI knowledge collection seeds are missing';
  end if;

  if not exists (
    select 1 from pg_proc where oid =
      'public.search_ai_knowledge_hybrid(extensions.vector,text,text,text,text,integer,jsonb)'::regprocedure
  ) then
    raise exception 'Hybrid retrieval RPC is missing';
  end if;

  if has_table_privilege('authenticated', 'public.ai_grading_benchmarks', 'select')
     or has_table_privilege('authenticated', 'public.ai_grading_evaluations', 'select') then
    raise exception 'Protected benchmark labels must be service-role only';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.ai_knowledge_items'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.ai_grading_benchmarks'::regclass) then
    raise exception 'Knowledge or benchmark RLS is not enabled';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'writing_responses' and column_name = 'grading_metadata'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'speaking_responses' and column_name = 'grading_metadata'
  ) then
    raise exception 'IELTS grading provenance columns are missing';
  end if;

  select id, active_version into v_collection_id, v_original_version
  from public.ai_knowledge_collections
  where slug = 'ielts.writing';

  v_test_version := v_original_version + 100000;
  insert into public.ai_knowledge_collection_versions (
    collection_id, version, status, import_key
  ) values (
    v_collection_id, v_test_version, 'draft', 'contract-test'
  );

  insert into public.ai_knowledge_sources (
    canonical_url, authority_tier, rights_status, review_status, checksum
  ) values (
    'urn:contract:ai-knowledge:' || gen_random_uuid()::text,
    'official', 'approved_for_derived_use', 'approved', encode(gen_random_bytes(32), 'hex')
  ) returning id into v_source_id;

  insert into public.ai_knowledge_items (
    collection_id, source_id, collection_version, item_kind, language,
    review_status, usable_for, embedding_text, content_hash
  ) values (
    v_collection_id, v_source_id, v_test_version, 'rubric_descriptor', 'en',
    'approved', array['grading'], 'contract evidence', 'contract-hash'
  ) returning id into v_item_id;

  v_embedding := ('[' || array_to_string(array_fill('0.01'::text, array[1024]), ',') || ']')::extensions.vector;

  insert into public.ai_knowledge_embeddings (
    item_id, collection_id, provider, model, dimensions, content_hash, embedding
  ) values (
    v_item_id, v_collection_id, 'voyage', 'voyage-4-large', 1024, 'contract-hash', v_embedding
  );

  update public.ai_knowledge_collection_versions
  set status = 'published', published_at = now()
  where collection_id = v_collection_id and version = v_test_version;
  update public.ai_knowledge_collections
  set active_version = v_test_version
  where id = v_collection_id;

  select count(*) into v_allowed_count
  from public.search_ai_knowledge_hybrid(
    v_embedding, 'contract evidence', 'ielts.writing', 'voyage', 'voyage-4-large', 8,
    '{"forGrading": true, "criterion": null}'::jsonb
  );
  if v_allowed_count <> 1 then
    raise exception 'Approved official grading evidence was not retrievable';
  end if;

  select count(*) into v_wrong_model_count
  from public.search_ai_knowledge_hybrid(
    v_embedding, 'contract evidence', 'ielts.writing', 'self_hosted', 'AITeamVN/Vietnamese_Embedding', 8,
    '{"forGrading": true}'::jsonb
  );
  if v_wrong_model_count <> 0 then
    raise exception 'Cross-collection/provider retrieval was not isolated';
  end if;

  update public.ai_knowledge_collection_versions
  set status = 'superseded'
  where collection_id = v_collection_id and version = v_test_version;
  update public.ai_knowledge_collections
  set active_version = v_original_version
  where id = v_collection_id;

  select count(*) into v_allowed_count
  from public.search_ai_knowledge_hybrid(
    v_embedding, 'contract evidence', 'ielts.writing', 'voyage', 'voyage-4-large', 8,
    jsonb_build_object('forGrading', true, 'collectionVersion', v_test_version)
  );
  if v_allowed_count <> 1 then
    raise exception 'Pinned superseded corpus version was not replayable';
  end if;

  v_rejected := false;
  begin
    update public.ai_knowledge_items set review_status = 'rejected' where id = v_item_id;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Superseded knowledge item mutation was accepted';
  end if;

  v_rejected := false;
  begin
    update public.ai_knowledge_sources set review_status = 'rejected' where id = v_source_id;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Superseded source provenance mutation was accepted';
  end if;

  v_rejected := false;
  begin
    insert into public.ai_knowledge_embeddings (
      item_id, collection_id, provider, model, dimensions, content_hash, embedding
    ) values (
      v_item_id, v_collection_id, 'self_hosted', 'wrong-model', 1024, 'contract-hash', v_embedding
    );
  exception when others then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Embedding model mismatch was accepted';
  end if;
end;
$$;

rollback;
