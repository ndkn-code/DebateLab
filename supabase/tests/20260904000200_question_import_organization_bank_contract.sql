-- Contract checks for the organization question import/bank boundary.
begin;
set local role postgres;
do $$
declare t text;
begin
  foreach t in array array['question_import_batches','question_import_batch_documents','question_import_draft_items','question_import_draft_keys','question_bank_collections','question_bank_stimuli','question_bank_items','question_bank_keys','organization_question_import_entitlements','organization_question_import_usage','question_import_compliance_events'] loop
    if to_regclass('public.'||t) is null then raise exception 'missing table %', t; end if;
    if not exists(select 1 from pg_class where oid=('public.'||t)::regclass and relrowsecurity) then raise exception 'RLS disabled on %', t; end if;
  end loop;
  if to_regclass('public.question_import_documents') is null then raise exception 'missing worker compatibility view'; end if;
  if not exists(select 1 from pg_enum where enumtypid='public.ielts_question_type'::regtype and enumlabel='matching_sentence_endings') then raise exception 'missing enum value'; end if;
  if not exists(select 1 from pg_enum where enumtypid='public.question_import_document_status'::regtype and enumlabel='quarantined') then raise exception 'missing reversible document quarantine state'; end if;
  if not exists(select 1 from pg_proc where proname='publish_question_import_items') then raise exception 'missing publish RPC'; end if;
  foreach t in array array['create_question_bank_collection','get_question_import_quota','confirm_question_import_answer','save_question_import_draft'] loop
    if not exists(select 1 from pg_proc where proname=t) then raise exception 'missing RPC %', t; end if;
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_question_import_batch','reserve_question_import_quota','reconcile_question_import_quota','release_question_import_quota','submit_question_import','save_question_import_draft','request_question_import_changes','publish_question_import_items','mark_question_import_source_action','create_question_bank_collection','get_question_import_quota','confirm_question_import_answer') and p.prosecdef is false) then raise exception 'import RPC must be SECURITY DEFINER'; end if;
  if not exists(select 1 from pg_trigger where tgname='question_import_draft_scope') or not exists(select 1 from pg_trigger where tgname='question_bank_item_scope') then raise exception 'missing scope triggers'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='lms_material_versions' and column_name='purpose') then raise exception 'missing material purpose'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='question_import_documents' and column_name='material_version_id') then raise exception 'missing worker document compatibility column'; end if;
  foreach t in array array['register_question_import_material','claim_question_import_provider_job','persist_question_import_result','release_question_import_worker_quota'] loop
    if not exists(select 1 from pg_proc where proname=t) then raise exception 'missing worker RPC %', t; end if;
    if exists(select 1 from pg_proc where proname=t and prosrc not like '%auth.role()%service_role%') then raise exception 'worker RPC % must require service role', t; end if;
  end loop;
  if not exists(select 1 from pg_proc where proname='publish_question_import_items' and prosrc like '%IMPORT_ITEM_SCOPE_MISMATCH%' and prosrc like '%question_bank_collections set status=%published%') then raise exception 'publish RPC lacks forged-ID or collection-state protection'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='question_import_draft_keys' and policyname='question_import_keys_read' and qual like '%created_by%') then raise exception 'teacher draft-key policy missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='question_bank_items' and policyname='bank_item_read' and qual like '%question_import_is_teacher%') then raise exception 'learner bank isolation policy missing'; end if;
end $$;
rollback;
