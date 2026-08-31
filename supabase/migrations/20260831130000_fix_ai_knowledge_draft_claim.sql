-- Fix PL/pgSQL output-column shadowing in the knowledge draft claim.
-- `collection_id` and `version` are RETURNS TABLE variables, so an unqualified
-- conflict target is ambiguous at runtime even though the migration parses.
create or replace function public.prepare_ai_knowledge_collection_draft(
  p_collection_slug text,
  p_version integer,
  p_import_key text,
  p_submitted_by uuid default null
)
returns table (collection_id uuid, version integer, language text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.ai_knowledge_collections%rowtype;
  v_existing public.ai_knowledge_collection_versions%rowtype;
begin
  if p_version is null or p_version < 1 then
    raise exception 'Knowledge draft version must be a positive integer';
  end if;

  select c.* into v_collection
  from public.ai_knowledge_collections as c
  where c.slug = p_collection_slug
  for update;
  if not found then
    raise exception 'Unknown AI knowledge collection: %', p_collection_slug;
  end if;
  if p_version <= v_collection.active_version then
    raise exception 'Draft version % must be greater than active version %', p_version, v_collection.active_version;
  end if;

  select v.* into v_existing
  from public.ai_knowledge_collection_versions as v
  where v.collection_id = v_collection.id
    and v.version = p_version;
  if found and v_existing.status <> 'draft' then
    raise exception 'Collection version % is not a mutable draft', p_version;
  end if;
  if found and v_existing.submitted_by is not null
    and p_submitted_by is distinct from v_existing.submitted_by then
    raise exception 'Only the original importer can resume this AI knowledge draft';
  end if;

  insert into public.ai_knowledge_collection_versions as target (
    collection_id, version, status, import_key, submitted_by
  ) values (
    v_collection.id, p_version, 'draft', p_import_key, p_submitted_by
  ) on conflict on constraint ai_knowledge_collection_versions_pkey do update set
    import_key = excluded.import_key,
    updated_at = now();

  return query select v_collection.id, p_version, v_collection.language;
end;
$$;

revoke all on function public.prepare_ai_knowledge_collection_draft(text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_ai_knowledge_collection_draft(text, integer, text, uuid)
  to service_role;
