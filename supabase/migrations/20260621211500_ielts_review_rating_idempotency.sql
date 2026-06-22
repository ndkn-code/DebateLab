-- =============================================================================
-- WS-6.3h fast-follow — make review rating idempotent
-- =============================================================================
-- record_ielts_review_rating advanced SM-2 + inserted a review event on EVERY
-- call, so a double-fire / retry / concurrent submit double-advanced the
-- schedule and wrote a duplicate review_result event, skewing the adaptive
-- model. The row is already locked FOR UPDATE; add a guard so that if a prior
-- rating already pushed the item past the review time, the call is a no-op.
-- (CREATE OR REPLACE preserves the existing grants.)
-- =============================================================================

create or replace function public.record_ielts_review_rating(
  p_review_item_id uuid,
  p_rating public.ielts_review_rating,
  p_quality_grade smallint,
  p_next_state text,
  p_next_due_at timestamptz,
  p_next_interval_days numeric,
  p_next_ease_factor numeric,
  p_next_repetitions integer,
  p_next_lapses integer,
  p_next_difficulty numeric,
  p_next_stability numeric,
  p_next_retrievability numeric,
  p_reviewed_at timestamptz default now(),
  p_is_correct boolean default null,
  p_response_ms integer default null,
  p_plan_item_id uuid default null,
  p_activity_attempt_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.ielts_review_items
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_item public.ielts_review_items%rowtype;
  v_updated public.ielts_review_items%rowtype;
begin
  if p_quality_grade < 0 or p_quality_grade > 5 then
    raise exception 'IELTS_REVIEW_INVALID_GRADE';
  end if;
  if p_response_ms is not null and p_response_ms < 0 then
    raise exception 'IELTS_REVIEW_INVALID_RESPONSE_MS';
  end if;

  select * into v_item
  from public.ielts_review_items
  where id = p_review_item_id
  for update;
  if not found then
    raise exception 'IELTS_REVIEW_ITEM_NOT_FOUND';
  end if;

  -- Idempotency: if a prior rating already advanced this item past the review
  -- time (double-fire / retry / concurrent submit), no-op rather than
  -- double-advancing SM-2 and inserting a duplicate review event.
  if v_item.due_at > p_reviewed_at then
    return v_item;
  end if;

  update public.ielts_review_items
  set state = p_next_state,
      due_at = p_next_due_at,
      interval_days = p_next_interval_days,
      ease_factor = p_next_ease_factor,
      repetitions = p_next_repetitions,
      lapses = p_next_lapses,
      difficulty = p_next_difficulty,
      stability = p_next_stability,
      retrievability = p_next_retrievability,
      last_reviewed_at = p_reviewed_at,
      updated_at = now()
  where id = p_review_item_id
  returning * into v_updated;

  insert into public.ielts_review_events (
    review_item_id,
    user_id,
    plan_item_id,
    activity_attempt_id,
    rating,
    quality_grade,
    is_correct,
    response_ms,
    previous_state,
    next_state,
    previous_due_at,
    next_due_at,
    previous_interval_days,
    next_interval_days,
    previous_ease_factor,
    next_ease_factor,
    previous_repetitions,
    next_repetitions,
    previous_lapses,
    next_lapses,
    previous_difficulty,
    next_difficulty,
    previous_stability,
    next_stability,
    previous_retrievability,
    next_retrievability,
    metadata,
    created_at
  ) values (
    v_item.id,
    v_item.user_id,
    p_plan_item_id,
    p_activity_attempt_id,
    p_rating,
    p_quality_grade,
    p_is_correct,
    p_response_ms,
    v_item.state,
    p_next_state,
    v_item.due_at,
    p_next_due_at,
    v_item.interval_days,
    p_next_interval_days,
    v_item.ease_factor,
    p_next_ease_factor,
    v_item.repetitions,
    p_next_repetitions,
    v_item.lapses,
    p_next_lapses,
    v_item.difficulty,
    p_next_difficulty,
    v_item.stability,
    p_next_stability,
    v_item.retrievability,
    p_next_retrievability,
    coalesce(p_metadata, '{}'::jsonb),
    p_reviewed_at
  );

  return v_updated;
end;
$function$;
