-- Trigger records are table-shaped. Referencing a collection-only field from
-- the item branch can fail before SQL boolean short-circuiting is applied.
-- Split the table branches so each NEW/OLD record is accessed only with fields
-- that exist on that trigger's table.
create or replace function private.prevent_ai_knowledge_vector_space_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'ai_knowledge_items' then
    if new.collection_id is distinct from old.collection_id
      and exists (
        select 1
        from public.ai_knowledge_embeddings as embedding
        where embedding.item_id = old.id
      ) then
      raise exception 'Cannot move an embedded AI knowledge item to another collection';
    end if;
  elsif tg_table_name = 'ai_knowledge_collections' then
    if (
      new.embedding_provider is distinct from old.embedding_provider
      or new.embedding_model is distinct from old.embedding_model
      or new.embedding_dimensions is distinct from old.embedding_dimensions
    ) and exists (
      select 1
      from public.ai_knowledge_embeddings as embedding
      where embedding.collection_id = old.id
    ) then
      raise exception 'Cannot change an AI knowledge collection embedding configuration after embeddings exist';
    end if;
  else
    raise exception 'Unsupported AI knowledge vector-space trigger table: %', tg_table_name;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_ai_knowledge_vector_space_mutation()
  from public, anon, authenticated;
