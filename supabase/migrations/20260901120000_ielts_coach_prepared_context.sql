begin;

-- One learner-safe projection replaces the dependent Coach evidence reads.
-- SECURITY INVOKER is intentional: table RLS still applies, while the explicit
-- auth.uid() equality and row predicates make cross-learner use fail closed.
create or replace function public.load_ielts_coach_prepared_context(
  p_learner_id uuid,
  p_max_recent_attempts integer default 12
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(24, coalesce(p_max_recent_attempts, 12)));
  v_result jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_learner_id then
    raise exception 'IELTS_COACH_LEARNER_SCOPE_MISMATCH'
      using errcode = '42501';
  end if;

  with active_classes as materialized (
    select c.id
    from public.class_memberships cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = p_learner_id
      and cm.member_role = 'student'
      and cm.status = 'active'
      and c.program_type = 'ielts'
      and c.status = 'active'
  ), recent_attempts as materialized (
    select a.id, a.started_at, a.submitted_at
    from public.ielts_attempts a
    where a.user_id = p_learner_id
      and a.status <> 'in_progress'
    order by a.started_at desc
    limit v_limit
  )
  select jsonb_build_object(
    'learnerId', p_learner_id,
    'activeIeltsClassIds', (
      select coalesce(jsonb_agg(ac.id order by ac.id), '[]'::jsonb)
      from active_classes ac
    ),
    'goal', (
      select jsonb_build_object(
        'userId', sp.user_id,
        'targetOverallBand', sp.target_overall_band,
        'targetListeningBand', sp.target_listening_band,
        'targetReadingBand', sp.target_reading_band,
        'targetWritingBand', sp.target_writing_band,
        'targetSpeakingBand', sp.target_speaking_band,
        'targetTestDate', sp.target_test_date
      )
      from public.ielts_study_plans sp
      where sp.user_id = p_learner_id
        and sp.status = 'active'
      order by sp.updated_at desc
      limit 1
    ),
    'attempts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'attemptId', ra.id,
        'occurredAt', coalesce(ra.submitted_at, ra.started_at)
      ) order by ra.started_at desc), '[]'::jsonb)
      from recent_attempts ra
    ),
    'skillStates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'userId', s.user_id,
        'skill', s.skill,
        'subskillKey', s.subskill_key,
        'questionType', s.question_type,
        'bandEstimate', s.band_estimate,
        'confidence', s.confidence,
        'occurredAt', s.updated_at
      ) order by s.updated_at desc), '[]'::jsonb)
      from (
        select state.*
        from public.ielts_skill_states state
        where state.user_id = p_learner_id
          and state.skill in ('listening', 'reading')
          and state.evidence_count > 0
          and state.band_estimate is not null
        order by state.updated_at desc
        limit 12
      ) s
    ),
    'bandScores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'attemptId', score.attempt_id,
        'userId', score.user_id,
        'listeningBand', score.listening_band,
        'readingBand', score.reading_band,
        'computedAt', score.computed_at
      )), '[]'::jsonb)
      from public.attempt_band_scores score
      join recent_attempts ra on ra.id = score.attempt_id
      where score.user_id = p_learner_id
    ),
    'writingResponses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', response.id,
        'attemptId', response.attempt_id,
        'userId', response.user_id,
        'revision', response.revision,
        'taskNumber', response.task_number,
        'taskBand', response.task_band,
        'taskResponseBand', response.task_response_band,
        'coherenceCohesionBand', response.coherence_cohesion_band,
        'lexicalResourceBand', response.lexical_resource_band,
        'grammarBand', response.grammar_band,
        'gradingMetadata', jsonb_build_object(
          'confidence', response.grading_metadata -> 'confidence',
          'overallConfidence', response.grading_metadata -> 'overallConfidence',
          'gradingVersion', coalesce(
            response.grading_metadata -> 'gradingVersion',
            response.grading_metadata -> 'grading_version'
          )
        ),
        'scoredAt', response.scored_at,
        'updatedAt', response.updated_at
      )), '[]'::jsonb)
      from public.writing_responses response
      join recent_attempts ra on ra.id = response.attempt_id
      where response.user_id = p_learner_id
        and response.status in ('scored', 'overridden')
    ),
    'speakingResponses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', response.id,
        'attemptId', response.attempt_id,
        'userId', response.user_id,
        'revision', response.revision,
        'partNumber', response.part_number,
        'speakingBand', response.speaking_band,
        'fluencyCoherenceBand', response.fluency_coherence_band,
        'lexicalResourceBand', response.lexical_resource_band,
        'grammarBand', response.grammar_band,
        'pronunciationBand', response.pronunciation_band,
        'gradingMetadata', jsonb_build_object(
          'confidence', response.grading_metadata -> 'confidence',
          'overallConfidence', response.grading_metadata -> 'overallConfidence',
          'gradingVersion', coalesce(
            response.grading_metadata -> 'gradingVersion',
            response.grading_metadata -> 'grading_version'
          )
        ),
        'scoredAt', response.scored_at,
        'updatedAt', response.updated_at
      )), '[]'::jsonb)
      from public.speaking_responses response
      join recent_attempts ra on ra.id = response.attempt_id
      where response.user_id = p_learner_id
        and response.status in ('scored', 'overridden')
    ),
    'publishedTeacherFeedback', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', review.id,
        'userId', review.user_id,
        'classId', review.class_id,
        'attemptId', review.attempt_id,
        'writingResponseId', review.writing_response_id,
        'speakingResponseId', review.speaking_response_id,
        'reviewKind', review.review_kind,
        'revision', review.revision,
        'publishedAt', review.published_at,
        'taskBand', review.task_band,
        'skillBand', review.skill_band,
        'taskResponseBand', review.task_response_band,
        'coherenceCohesionBand', review.coherence_cohesion_band,
        'lexicalResourceBand', review.lexical_resource_band,
        'grammarBand', review.grammar_band,
        'fluencyCoherenceBand', review.fluency_coherence_band,
        'pronunciationBand', review.pronunciation_band,
        'criterionFeedback', jsonb_build_object(
          'taskResponse', review.criterion_feedback -> 'taskResponse',
          'coherenceCohesion', review.criterion_feedback -> 'coherenceCohesion',
          'lexicalResource', review.criterion_feedback -> 'lexicalResource',
          'grammaticalRangeAccuracy', review.criterion_feedback -> 'grammaticalRangeAccuracy',
          'fluencyCoherence', review.criterion_feedback -> 'fluencyCoherence',
          'pronunciation', review.criterion_feedback -> 'pronunciation'
        )
      ) order by review.published_at desc), '[]'::jsonb)
      from public.ielts_teacher_reviews review
      join recent_attempts ra on ra.id = review.attempt_id
      join active_classes ac on ac.id = review.class_id
      where review.user_id = p_learner_id
        and review.status = 'published'
        and review.published_at is not null
    ),
    'assignedWork', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', assignment.id,
        'classId', assignment.class_id,
        'title', assignment.title,
        'dueAt', assignment.due_at,
        'assignedTrack', assignment.assigned_track,
        'topicCategory', assignment.topic_category,
        'metadata', jsonb_build_object(
          'skill', assignment.metadata -> 'skill',
          'criterion', assignment.metadata -> 'criterion',
          'questionType', coalesce(
            assignment.metadata -> 'questionType',
            assignment.metadata -> 'question_type'
          ),
          'assignedLearnerId', coalesce(
            assignment.metadata -> 'assignedLearnerId',
            assignment.metadata -> 'assigned_learner_id'
          ),
          'estimatedMinutes', coalesce(
            assignment.metadata -> 'estimatedMinutes',
            assignment.metadata -> 'estimated_minutes'
          )
        )
      ) order by assignment.due_at asc nulls last), '[]'::jsonb)
      from (
        select candidate.*
        from public.club_assignments candidate
        join active_classes candidate_class
          on candidate_class.id = candidate.class_id
        where candidate.assignment_type = 'ielts_mock'
          and candidate.ielts_test_id is not null
          and candidate.status = 'active'
          and not exists (
            select 1
            from public.ielts_attempts completed
            where completed.user_id = p_learner_id
              and completed.assignment_id = candidate.id
              and completed.status = 'completed'
          )
        order by candidate.due_at asc nulls last
        limit 20
      ) assignment
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.load_ielts_coach_prepared_context(uuid, integer) is
  'RLS-bound, learner-safe evidence projection for one IELTS Coach turn.';

revoke all on function public.load_ielts_coach_prepared_context(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.load_ielts_coach_prepared_context(uuid, integer)
  to authenticated;

commit;
