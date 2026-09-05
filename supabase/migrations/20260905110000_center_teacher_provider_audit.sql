-- Record teacher assistant provider attempts without dropping their audit rows.
begin;

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
      'phoneme_report',
      'teacher_plan'
    )
  );

comment on constraint ai_provider_requests_output_type_check
  on public.ai_provider_requests is
  'Closed contract for all runtime provider output types, including structured IELTS Coach and teacher operations plans.';

commit;
