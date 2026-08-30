-- Run after the AI knowledge platform and operations migrations.
begin;

do $$
begin
  if to_regclass('public.ai_knowledge_collection_versions') is null then
    raise exception 'AI knowledge collection version table is missing';
  end if;
  if not exists (
    select 1 from pg_proc where oid =
      'public.prepare_ai_knowledge_collection_draft(text,integer,text,uuid)'::regprocedure
  ) then
    raise exception 'Draft preparation RPC is missing';
  end if;
  if not exists (
    select 1 from pg_proc where oid =
      'public.publish_ai_knowledge_collection_version(text,integer,uuid,text)'::regprocedure
  ) then
    raise exception 'Atomic publication RPC is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_published_ai_knowledge_source_mutation'
      and not tgisinternal
  ) then
    raise exception 'Published source provenance immutability trigger is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_published_ai_knowledge_item_mutation'
      and not tgisinternal
  ) then
    raise exception 'Published item immutability trigger is missing';
  end if;
  if exists (
    select 1 from public.ai_knowledge_collection_versions
    where status = 'published' and published_at is null
  ) then
    raise exception 'Published versions require a publication timestamp';
  end if;
  if has_table_privilege('authenticated', 'public.ai_knowledge_collection_versions', 'select') then
    raise exception 'Collection version controls must remain service-role only';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.prepare_ai_knowledge_collection_draft(text,integer,text,uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.publish_ai_knowledge_collection_version(text,integer,uuid,text)',
    'execute'
  ) then
    raise exception 'Knowledge draft/publication RPCs must remain service-role only';
  end if;
end;
$$;

rollback;
