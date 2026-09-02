-- Invalidate review decisions whenever draft knowledge or its embedding changes.
--
-- Review is a decision about one exact source revision, item payload and vector.
-- An importer may safely replay identical upserts, but any substantive mutation
-- must return the affected draft evidence to the review queue before publication.

begin;

create or replace function private.invalidate_ai_knowledge_draft_source_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atomic_classification_review boolean;
begin
  if new.id is not distinct from old.id
    and new.canonical_url is not distinct from old.canonical_url
    and new.publisher is not distinct from old.publisher
    and new.title is not distinct from old.title
    and new.authority_tier is not distinct from old.authority_tier
    and new.rights_status is not distinct from old.rights_status
    and new.checksum is not distinct from old.checksum
    and new.captured_at is not distinct from old.captured_at
    and new.metadata is not distinct from old.metadata
    and new.submitted_by is not distinct from old.submitted_by then
    return new;
  end if;

  -- The admin review contract intentionally clears rights/authority and records
  -- the independent decision in one statement. Permit only that narrow atomic
  -- classification review. Content, locator, submitter or source-identity
  -- changes can never preserve or establish approval in the same update.
  v_atomic_classification_review :=
    new.id is not distinct from old.id
    and new.canonical_url is not distinct from old.canonical_url
    and new.publisher is not distinct from old.publisher
    and new.title is not distinct from old.title
    and new.checksum is not distinct from old.checksum
    and new.captured_at is not distinct from old.captured_at
    and new.metadata is not distinct from old.metadata
    and new.submitted_by is not distinct from old.submitted_by
    and new.review_status = 'approved'
    and new.reviewed_by is not null
    and new.reviewed_at is not null
    and new.reviewed_at is distinct from old.reviewed_at
    and (new.submitted_by is null or new.reviewed_by <> new.submitted_by)
    and new.rights_status in (
      'approved_for_derived_use',
      'approved_for_excerpt',
      'public_domain'
    );

  if not v_atomic_classification_review then
    new.review_status := 'needs_review';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  -- A source review covers every draft item that relies on that exact source
  -- revision. Published and superseded versions remain immutable under the
  -- existing prevent_published_ai_knowledge_source_mutation trigger.
  update public.ai_knowledge_items item
  set review_status = 'needs_review',
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  from public.ai_knowledge_collection_versions version
  where item.source_id = old.id
    and version.collection_id = item.collection_id
    and version.version = item.collection_version
    and version.status = 'draft'
    and (
      item.review_status is distinct from 'needs_review'
      or item.reviewed_by is not null
      or item.reviewed_at is not null
    );

  return new;
end;
$$;

drop trigger if exists invalidate_ai_knowledge_draft_source_review
  on public.ai_knowledge_sources;
create trigger invalidate_ai_knowledge_draft_source_review
  before update of
    id,
    canonical_url,
    publisher,
    title,
    authority_tier,
    rights_status,
    checksum,
    captured_at,
    metadata,
    submitted_by
  on public.ai_knowledge_sources
  for each row execute function private.invalidate_ai_knowledge_draft_source_review();

create or replace function private.invalidate_ai_knowledge_draft_item_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is not distinct from old.id
    and new.collection_id is not distinct from old.collection_id
    and new.source_id is not distinct from old.source_id
    and new.external_key is not distinct from old.external_key
    and new.collection_version is not distinct from old.collection_version
    and new.item_kind is not distinct from old.item_kind
    and new.language is not distinct from old.language
    and new.criterion is not distinct from old.criterion
    and new.band_min is not distinct from old.band_min
    and new.band_max is not distinct from old.band_max
    and new.task_type is not distinct from old.task_type
    and new.format is not distinct from old.format
    and new.source_locator is not distinct from old.source_locator
    and new.permitted_excerpt is not distinct from old.permitted_excerpt
    and new.structured_insight is not distinct from old.structured_insight
    and new.usable_for is not distinct from old.usable_for
    and new.embedding_text is not distinct from old.embedding_text
    and new.content_hash is not distinct from old.content_hash
    and new.metadata is not distinct from old.metadata
    and new.submitted_by is not distinct from old.submitted_by then
    return new;
  end if;

  -- The pre-existing immutability trigger rejects changes to an item already
  -- in a published version. This additional check also prevents moving a draft
  -- item into a published or superseded version while preserving its approval.
  if exists (
    select 1
    from public.ai_knowledge_collection_versions version
    where (
      (version.collection_id = old.collection_id and version.version = old.collection_version)
      or (version.collection_id = new.collection_id and version.version = new.collection_version)
    )
      and version.status in ('published', 'superseded')
  ) then
    raise exception 'Published AI knowledge items are immutable; create a new collection version';
  end if;

  if exists (
    select 1
    from public.ai_knowledge_collection_versions version
    where (
      (version.collection_id = old.collection_id and version.version = old.collection_version)
      or (version.collection_id = new.collection_id and version.version = new.collection_version)
    )
      and version.status = 'draft'
  ) then
    new.review_status := 'needs_review';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists invalidate_ai_knowledge_draft_item_review
  on public.ai_knowledge_items;
create trigger invalidate_ai_knowledge_draft_item_review
  before update of
    id,
    collection_id,
    source_id,
    external_key,
    collection_version,
    item_kind,
    language,
    criterion,
    band_min,
    band_max,
    task_type,
    format,
    source_locator,
    permitted_excerpt,
    structured_insight,
    usable_for,
    embedding_text,
    content_hash,
    metadata,
    submitted_by
  on public.ai_knowledge_items
  for each row execute function private.invalidate_ai_knowledge_draft_item_review();

create or replace function private.invalidate_ai_knowledge_draft_embedding_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_item_id uuid;
  v_new_item_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_item_id := old.item_id;
  end if;
  if tg_op in ('UPDATE', 'INSERT') then
    v_new_item_id := new.item_id;
  end if;

  -- ON CONFLICT DO UPDATE may still fire a row trigger even when every
  -- meaningful value is unchanged. Keep those importer replays idempotent.
  if tg_op = 'UPDATE'
    and new.id is not distinct from old.id
    and new.item_id is not distinct from old.item_id
    and new.collection_id is not distinct from old.collection_id
    and new.provider is not distinct from old.provider
    and new.model is not distinct from old.model
    and new.dimensions is not distinct from old.dimensions
    and new.input_type is not distinct from old.input_type
    and new.content_hash is not distinct from old.content_hash
    and new.embedding::text is not distinct from old.embedding::text
    and new.token_count_estimate is not distinct from old.token_count_estimate
    and new.embedded_at is not distinct from old.embedded_at
    and new.created_at is not distinct from old.created_at
    and new.updated_at is not distinct from old.updated_at then
    return new;
  end if;

  if exists (
    select 1
    from public.ai_knowledge_items item
    join public.ai_knowledge_collection_versions version
      on version.collection_id = item.collection_id
      and version.version = item.collection_version
    where item.id in (v_old_item_id, v_new_item_id)
      and version.status in ('published', 'superseded')
  ) then
    raise exception 'Published AI knowledge embeddings are immutable; create a new collection version';
  end if;

  update public.ai_knowledge_items item
  set review_status = 'needs_review',
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  from public.ai_knowledge_collection_versions version
  where item.id in (v_old_item_id, v_new_item_id)
    and version.collection_id = item.collection_id
    and version.version = item.collection_version
    and version.status = 'draft'
    and (
      item.review_status = 'approved'
      or item.reviewed_by is not null
      or item.reviewed_at is not null
    );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invalidate_ai_knowledge_draft_embedding_review
  on public.ai_knowledge_embeddings;
create trigger invalidate_ai_knowledge_draft_embedding_review
  after insert or update or delete on public.ai_knowledge_embeddings
  for each row execute function private.invalidate_ai_knowledge_draft_embedding_review();

revoke all on function private.invalidate_ai_knowledge_draft_source_review()
  from public, anon, authenticated;
revoke all on function private.invalidate_ai_knowledge_draft_item_review()
  from public, anon, authenticated;
revoke all on function private.invalidate_ai_knowledge_draft_embedding_review()
  from public, anon, authenticated;

-- Review identity must come from the authenticated database session. Admins
-- retain read access, while ingestion remains service-role-only; direct table
-- mutation can no longer forge another reviewer's UUID.
create or replace function public.review_ai_knowledge_record(
  p_kind text,
  p_id uuid,
  p_review_status text,
  p_review_notes text default null,
  p_authority_tier text default null,
  p_rights_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := auth.uid();
  v_submitted_by uuid;
  v_effective_rights text;
  v_record jsonb;
begin
  if v_reviewer is null or not private.is_admin(v_reviewer) then
    raise exception 'Only an authenticated administrator can review AI knowledge';
  end if;
  if p_kind not in ('source', 'item') then
    raise exception 'Unknown AI knowledge record kind';
  end if;
  if p_review_status not in ('candidate', 'needs_review', 'approved', 'rejected') then
    raise exception 'Invalid AI knowledge review status';
  end if;

  if p_kind = 'source' then
    select submitted_by, rights_status
      into v_submitted_by, v_effective_rights
    from public.ai_knowledge_sources
    where id = p_id
    for update;
    if not found then raise exception 'AI knowledge source not found'; end if;
    if v_submitted_by is not null and v_submitted_by = v_reviewer then
      raise exception 'Importer and reviewer must be different people';
    end if;
    if p_authority_tier is not null and p_authority_tier not in (
      'official', 'qualified_examiner_or_adjudicator', 'expert_educational',
      'community', 'ai_derived'
    ) then
      raise exception 'Invalid AI knowledge authority tier';
    end if;
    if p_rights_status is not null and p_rights_status not in (
      'approved_for_derived_use', 'approved_for_excerpt', 'public_domain',
      'requires_review', 'restricted', 'unknown'
    ) then
      raise exception 'Invalid AI knowledge rights status';
    end if;
    v_effective_rights := coalesce(p_rights_status, v_effective_rights);
    if p_review_status = 'approved' and v_effective_rights not in (
      'approved_for_derived_use', 'approved_for_excerpt', 'public_domain'
    ) then
      raise exception 'Approved source requires cleared rights';
    end if;

    -- Classification changes first invalidate the previous decision and all
    -- dependent draft items. The approval-only update then records the actual
    -- authenticated reviewer over the exact resulting source revision.
    update public.ai_knowledge_sources
    set authority_tier = coalesce(p_authority_tier, authority_tier),
        rights_status = coalesce(p_rights_status, rights_status),
        updated_at = now()
    where id = p_id;
    update public.ai_knowledge_sources
    set review_status = p_review_status,
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        review_notes = p_review_notes,
        updated_at = now()
    where id = p_id
    returning jsonb_build_object(
      'id', id,
      'review_status', review_status,
      'submitted_by', submitted_by,
      'reviewed_by', reviewed_by,
      'reviewed_at', reviewed_at,
      'updated_at', updated_at
    ) into v_record;
  else
    select submitted_by into v_submitted_by
    from public.ai_knowledge_items
    where id = p_id
    for update;
    if not found then raise exception 'AI knowledge item not found'; end if;
    if v_submitted_by is not null and v_submitted_by = v_reviewer then
      raise exception 'Importer and reviewer must be different people';
    end if;
    if p_authority_tier is not null or p_rights_status is not null then
      raise exception 'Authority and rights apply only to sources';
    end if;
    update public.ai_knowledge_items
    set review_status = p_review_status,
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        updated_at = now()
    where id = p_id
    returning jsonb_build_object(
      'id', id,
      'review_status', review_status,
      'submitted_by', submitted_by,
      'reviewed_by', reviewed_by,
      'reviewed_at', reviewed_at,
      'updated_at', updated_at
    ) into v_record;
  end if;
  return v_record;
end;
$$;

revoke insert, update, delete on public.ai_knowledge_sources from authenticated;
revoke insert, update, delete on public.ai_knowledge_items from authenticated;
revoke insert, update, delete on public.ai_knowledge_embeddings from authenticated;
revoke all on function public.review_ai_knowledge_record(text, uuid, text, text, text, text)
  from public, anon, service_role;
grant execute on function public.review_ai_knowledge_record(text, uuid, text, text, text, text)
  to authenticated;

commit;
