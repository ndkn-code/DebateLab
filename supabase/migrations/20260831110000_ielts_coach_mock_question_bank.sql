-- Synthetic, answer-key-free practice prompts used by the IELTS Coach's
-- deterministic question recommender. These are practice materials, not
-- official IELTS content and not grading benchmarks.

insert into public.ielts_tests (
  id, slug, title, kind, module, skill, status, version,
  time_limit_seconds, description, published_at, assessment_mode, metadata
)
values
  (
    md5('debatelab:coach:writing-academic:v1')::uuid,
    'coach-writing-academic-v1',
    'Coach Writing — Academic Practice',
    'drill', 'academic', 'writing', 'published', 1, 2400,
    'Synthetic IELTS-style writing prompts for targeted practice.',
    now(), 'practice',
    '{"synthetic":true,"coach_recommendable":true,"provenance":"debatelab-authored-mock","not_official_ielts":true}'::jsonb
  ),
  (
    md5('debatelab:coach:writing-general:v1')::uuid,
    'coach-writing-general-v1',
    'Coach Writing — General Training Practice',
    'drill', 'general_training', 'writing', 'published', 1, 2400,
    'Synthetic IELTS-style General Training writing prompts for targeted practice.',
    now(), 'practice',
    '{"synthetic":true,"coach_recommendable":true,"provenance":"debatelab-authored-mock","not_official_ielts":true}'::jsonb
  ),
  (
    md5('debatelab:coach:speaking:v1')::uuid,
    'coach-speaking-v1',
    'Coach Speaking Practice',
    'drill', 'academic', 'speaking', 'published', 1, 900,
    'Synthetic IELTS-style speaking prompts for targeted practice.',
    now(), 'practice',
    '{"synthetic":true,"coach_recommendable":true,"provenance":"debatelab-authored-mock","not_official_ielts":true}'::jsonb
  )
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  version = excluded.version,
  time_limit_seconds = excluded.time_limit_seconds,
  description = excluded.description,
  assessment_mode = excluded.assessment_mode,
  metadata = excluded.metadata,
  updated_at = now();

with prompt_rows(test_key, ordinal, question_type, prompt, word_limit, criteria, tags, difficulty) as (
  values
    ('writing-academic', 1, 'writing_task2_essay', 'Some cities are making their centres car-free. Discuss the advantages and disadvantages of this policy.', 250, array['task_response','coherence_and_cohesion'], array['writing:argument-development','writing:balanced-discussion'], 6.5),
    ('writing-academic', 2, 'writing_task2_essay', 'University students should be required to take courses outside their main field of study. To what extent do you agree or disagree?', 250, array['task_response','lexical_resource'], array['writing:position','writing:topic-vocabulary'], 7.5),
    ('writing-academic', 3, 'writing_task2_essay', 'Many people now work from home. What problems can this create for individuals and organisations, and how can they be addressed?', 250, array['task_response','grammatical_range_and_accuracy'], array['writing:problem-solution','writing:complex-sentences'], 6.5),
    ('writing-academic', 4, 'writing_task2_essay', 'Some people believe public libraries are no longer necessary because information is available online. Discuss both views and give your own opinion.', 250, array['coherence_and_cohesion','lexical_resource'], array['writing:paragraphing','writing:comparison'], 7.5),
    ('writing-general', 1, 'writing_task1_general', 'You recently stayed at a hotel and left an important item in your room. Write a letter to the hotel manager. Describe the item, explain where you think you left it, and say what you would like the manager to do.', 150, array['task_achievement','coherence_and_cohesion'], array['writing:letter-purpose','writing:request'], 5.5),
    ('writing-general', 2, 'writing_task1_general', 'A local community centre is asking residents for ideas. Write a letter suggesting a new class or activity. Explain your idea, who would benefit, and how it could be organised.', 150, array['task_achievement','lexical_resource'], array['writing:letter-tone','writing:suggestion'], 6.5),
    ('writing-general', 3, 'writing_task1_general', 'Your work schedule has changed and now conflicts with an evening course. Write to the course coordinator. Explain the situation, describe how it affects you, and request a solution.', 150, array['task_achievement','grammatical_range_and_accuracy'], array['writing:formal-letter','writing:request'], 6.5),
    ('speaking', 1, 'speaking_part1', 'Let us talk about your daily routine. Which part of your day do you enjoy most, and why?', null, array['fluency_and_coherence','pronunciation'], array['speaking:personal-topic','speaking:extended-answer'], 5.0),
    ('speaking', 2, 'speaking_part1', 'Do you prefer studying alone or with other people? Give reasons for your preference.', null, array['fluency_and_coherence','lexical_resource'], array['speaking:preference','speaking:reasons'], 6.0),
    ('speaking', 3, 'speaking_part2_cuecard', 'Describe a skill you would like to learn. Say what the skill is, why you want to learn it, how you would learn it, and explain how it could help you in the future.', null, array['fluency_and_coherence','lexical_resource'], array['speaking:long-turn','speaking:organisation'], 7.0),
    ('speaking', 4, 'speaking_part2_cuecard', 'Describe a place in your town or city that has changed. Say where it is, what it was like before, how it changed, and explain whether the change was positive.', null, array['grammatical_range_and_accuracy','pronunciation'], array['speaking:past-present','speaking:long-turn'], 7.0),
    ('speaking', 5, 'speaking_part3', 'Why do some useful skills disappear when technology changes, and should schools try to preserve them?', null, array['fluency_and_coherence','grammatical_range_and_accuracy'], array['speaking:abstract-discussion','speaking:cause-effect'], 8.0),
    ('speaking', 6, 'speaking_part3', 'How can governments encourage people to use public spaces more often?', null, array['lexical_resource','pronunciation'], array['speaking:policy','speaking:examples'], 8.0)
), resolved as (
  select
    case prompt_rows.test_key
      when 'writing-academic' then md5('debatelab:coach:writing-academic:v1')::uuid
      when 'writing-general' then md5('debatelab:coach:writing-general:v1')::uuid
      else md5('debatelab:coach:speaking:v1')::uuid
    end as test_id,
    prompt_rows.*
  from prompt_rows
)
insert into public.ielts_questions (
  id, test_id, skill, question_type, order_index, prompt, max_points,
  word_limit, metadata
)
select
  md5('debatelab:coach:question:v1:' || test_key || ':' || ordinal::text)::uuid,
  test_id,
  case when test_key = 'speaking' then 'speaking'::public.ielts_skill else 'writing'::public.ielts_skill end,
  question_type::public.ielts_question_type,
  ordinal,
  prompt,
  0,
  word_limit,
  jsonb_build_object(
    'synthetic', true,
    'coach_recommendable', true,
    'coach_criteria', to_jsonb(criteria),
    'subskill_tags', to_jsonb(tags),
    'difficulty_band_hint', difficulty,
    'provenance', 'debatelab-authored-mock',
    'not_official_ielts', true,
    'answer_key_available', false
  )
from resolved
on conflict (id) do update set
  test_id = excluded.test_id,
  question_type = excluded.question_type,
  order_index = excluded.order_index,
  prompt = excluded.prompt,
  max_points = excluded.max_points,
  word_limit = excluded.word_limit,
  metadata = excluded.metadata,
  updated_at = now();

create index if not exists idx_ielts_questions_coach_recommendation
  on public.ielts_questions (skill, question_type, order_index)
  where metadata @> '{"coach_recommendable":true}'::jsonb;

comment on index public.idx_ielts_questions_coach_recommendation is
  'Published learner-safe question candidates for deterministic IELTS Coach recommendations; answer keys remain isolated.';
