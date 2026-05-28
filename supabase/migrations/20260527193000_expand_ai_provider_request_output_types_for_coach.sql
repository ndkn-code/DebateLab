-- Allow AI Coach provider telemetry to use specific output_type values.

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
      'coach_visual_planner'
    )
  );
