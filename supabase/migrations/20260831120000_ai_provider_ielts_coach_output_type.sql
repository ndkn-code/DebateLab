-- Keep the provider-attempt ledger aligned with the IELTS Coach runtime.
-- The ledger is best-effort telemetry, but rejecting a known output type hides
-- schema failures and makes production diagnosis unnecessarily brittle.

alter table public.ai_provider_requests
  drop constraint if exists ai_provider_requests_output_type_check;

alter table public.ai_provider_requests
  add constraint ai_provider_requests_output_type_check
  check (
    output_type is null
    or output_type in (
      'rebuttal',
      'practice_judging',
      'duel_judging',
      'coach_chat',
      'coach_deep_review',
      'coach_metadata',
      'coach_title',
      'coach_visual_prompt',
      'coach_visual_planner',
      'ielts_coach_contract',
      'ielts_writing_score',
      'ielts_speaking_score',
      'ielts_writing_score_adjudication',
      'ielts_speaking_score_adjudication',
      'ielts_micro_item_drafts',
      'stt_transcript_repair',
      'admin_ai_insights',
      'onboarding_feedback',
      'phoneme_report'
    )
  );

comment on constraint ai_provider_requests_output_type_check
  on public.ai_provider_requests is
  'Closed contract for all runtime provider output types, including the structured IELTS Coach contract.';

-- The first coach-ledger migration was authored against aggregate fields that
-- are not part of DebateLab's canonical conversation table.
-- Keep completion atomic while updating only the canonical timestamp.
create or replace function public.complete_ai_coach_turn(
  p_user_id uuid,
  p_turn_id uuid,
  p_claim_token uuid,
  p_attempt_count integer,
  p_user_message text,
  p_assistant_message text,
  p_response_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turn public.ai_coach_turns%rowtype;
  v_user_message_id uuid;
  v_assistant_message_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted server role required';
  end if;

  select * into v_turn
  from public.ai_coach_turns t
  where t.id = p_turn_id
    and t.user_id = p_user_id
    and t.status = 'running'
    and t.claim_token = p_claim_token
    and t.attempt_count = p_attempt_count
  for update;

  if not found then
    raise exception 'Coach turn claim is stale';
  end if;
  if char_length(trim(p_user_message)) = 0
    or char_length(trim(p_assistant_message)) = 0 then
    raise exception 'Coach messages cannot be empty';
  end if;

  insert into public.chat_messages (conversation_id, role, content)
  values (v_turn.conversation_id, 'user', trim(p_user_message))
  returning id into v_user_message_id;

  insert into public.chat_messages (conversation_id, role, content, metadata)
  values (
    v_turn.conversation_id,
    'assistant',
    p_assistant_message,
    coalesce(p_response_metadata, '{}'::jsonb)
  )
  returning id into v_assistant_message_id;

  update public.chat_conversations
  set updated_at = now()
  where id = v_turn.conversation_id;

  update public.ai_coach_turns
  set status = 'completed',
      lease_expires_at = null,
      claim_token = null,
      user_message_id = v_user_message_id,
      assistant_message_id = v_assistant_message_id,
      response_text = p_assistant_message,
      response_metadata = coalesce(p_response_metadata, '{}'::jsonb),
      error_code = null,
      completed_at = now(),
      updated_at = now()
  where id = v_turn.id;

  return jsonb_build_object(
    'outcome', 'completed',
    'turnId', v_turn.id,
    'assistantMessageId', v_assistant_message_id
  );
end;
$$;

revoke all on function public.complete_ai_coach_turn(
  uuid, uuid, uuid, integer, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_ai_coach_turn(
  uuid, uuid, uuid, integer, text, text, jsonb
) to service_role;
