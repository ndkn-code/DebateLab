-- Run after 20260829210000_ai_ielts_release_fixes.sql.
begin;

select plan(12);

select has_function(
  'public',
  'retry_ielts_scoring_workflow',
  array['uuid','uuid','uuid','uuid','text','integer','text','uuid'],
  'Teacher retry RPC exists with the repository contract'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.retry_ielts_scoring_workflow(uuid,uuid,uuid,uuid,text,integer,text,uuid)',
    'execute'
  ),
  'Authenticated users can invoke the retry RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.retry_ielts_scoring_workflow(uuid,uuid,uuid,uuid,text,integer,text,uuid)',
    'execute'
  ),
  'Anonymous users cannot invoke the retry RPC'
);

select ok(
  position('is_assigned_class_teacher' in lower(pg_get_functiondef(
    'public.retry_ielts_scoring_workflow(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure
  ))) > 0
  and position('manual_retry_count' in lower(pg_get_functiondef(
    'public.retry_ielts_scoring_workflow(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure
  ))) > 0
  and position('workflow_attempt_count < 3' in lower(pg_get_functiondef(
    'public.retry_ielts_scoring_workflow(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure
  ))) > 0
  and position('idempotency' in lower(pg_get_functiondef(
    'public.retry_ielts_scoring_workflow(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure
  ))) > 0,
  'Retry RPC is class-teacher scoped, bounded, and idempotent'
);

select is(
  private.ielts_simulation_section_order_valid('listening'::public.ielts_skill, 1),
  true,
  'Listening is first in simulations'
);

select is(
  private.ielts_simulation_section_order_valid('reading'::public.ielts_skill, 2),
  true,
  'Reading is second in simulations'
);

select is(
  private.ielts_simulation_section_order_valid('writing'::public.ielts_skill, 3),
  true,
  'Writing is third in simulations'
);

-- Adversarial orderings must be rejected before a section row can be trusted.
select is(
  private.ielts_simulation_section_order_valid('reading'::public.ielts_skill, 1),
  false,
  'Adversarial Reading-before-Listening ordering is rejected'
);

select is(
  private.ielts_simulation_section_order_valid('writing'::public.ielts_skill, 2),
  false,
  'Adversarial Writing-before-Reading ordering is rejected'
);

select ok(
  exists (
    select 1 from pg_trigger
     where tgrelid = 'public.ielts_attempt_sections'::regclass
       and tgname = 'validate_ielts_simulation_section_order'
       and not tgisinternal
  )
  and exists (
    select 1 from pg_trigger
     where tgrelid = 'public.ielts_criterion_evidence'::regclass
       and tgname = 'validate_ielts_criterion_evidence_identity'
       and not tgisinternal
  ),
  'DB-boundary simulation and evidence identity triggers exist'
);

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.ielts_criterion_evidence'::regclass
       and conname = 'ielts_criterion_evidence_attempt_id_fkey'
       and confdeltype = 'r'
  )
  and exists (
    select 1 from pg_constraint
     where conrelid = 'public.ielts_criterion_evidence'::regclass
       and conname = 'ielts_criterion_evidence_writing_response_id_fkey'
       and confdeltype = 'r'
  ),
  'Criterion evidence retention uses RESTRICT rather than cascade deletion'
);

select ok(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'public.ai_provider_requests'::regclass
       and conname = 'ai_provider_requests_output_type_check'
  ) like '%stt_transcript_repair%'
  and (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'public.ai_provider_requests'::regclass
       and conname = 'ai_provider_requests_output_type_check'
  ) like '%admin_ai_insights%'
  and (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'public.ai_provider_requests'::regclass
       and conname = 'ai_provider_requests_output_type_check'
  ) like '%onboarding_feedback%'
  and (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'public.ai_provider_requests'::regclass
       and conname = 'ai_provider_requests_output_type_check'
  ) like '%phoneme_report%',
  'Telemetry schema accepts the newly emitted runtime output types'
);

rollback;
