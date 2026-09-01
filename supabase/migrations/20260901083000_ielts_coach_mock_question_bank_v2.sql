-- Additive, first-party IELTS practice prompts for the Coach recommender.
-- These prompts are synthetic practice material: they are not official IELTS
-- content, contain no answer keys/model answers, and are never benchmark truth.

insert into public.ielts_tests (
  id, slug, title, kind, module, skill, status, version,
  time_limit_seconds, description, published_at, assessment_mode, metadata
)
values
  (
    md5('debatelab:coach:writing-academic:v2')::uuid,
    'coach-writing-academic-v2',
    'Coach Writing — Academic Practice 2',
    'drill', 'academic', 'writing', 'published', 2, 2400,
    'Original Academic Writing prompts for criterion- and task-specific coaching.',
    now(), 'practice',
    '{"synthetic":true,"coach_recommendable":true,"provenance":"debatelab-authored-mock","not_official_ielts":true,"answer_key_available":false}'::jsonb
  ),
  (
    md5('debatelab:coach:writing-general:v2')::uuid,
    'coach-writing-general-v2',
    'Coach Writing — General Training Practice 2',
    'drill', 'general_training', 'writing', 'published', 2, 2400,
    'Original General Training Writing prompts for criterion- and task-specific coaching.',
    now(), 'practice',
    '{"synthetic":true,"coach_recommendable":true,"provenance":"debatelab-authored-mock","not_official_ielts":true,"answer_key_available":false}'::jsonb
  ),
  (
    md5('debatelab:coach:speaking:v2')::uuid,
    'coach-speaking-v2',
    'Coach Speaking Practice 2',
    'drill', 'academic', 'speaking', 'published', 2, 1200,
    'Original Speaking Part 1, Part 2, and Part 3 prompts for targeted coaching.',
    now(), 'practice',
    '{"synthetic":true,"coach_recommendable":true,"provenance":"debatelab-authored-mock","not_official_ielts":true,"answer_key_available":false}'::jsonb
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

with prompt_rows(
  test_key, ordinal, question_type, prompt, word_limit,
  criteria, tags, difficulty, practice_focus
) as (
  values
    ('writing-academic-v2', 1, 'writing_task1_academic', 'The table below shows average daily household water use, in litres, in three cities in 2010 and 2025. In Northport, use fell from 310 to 255 litres; in Lakeside, it fell from 280 to 240 litres; and in Hillview, it rose from 190 to 225 litres. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.', 150, array['task_achievement','coherence_and_cohesion'], array['writing:table','writing:overview','writing:comparison'], 5.5, 'table_overview'),
    ('writing-academic-v2', 2, 'writing_task1_academic', 'The line graph below shows the percentage of adults using online banking in four age groups in 2012, 2017, and 2022. For ages 18-29 the figures were 55%, 78%, and 92%; ages 30-49: 42%, 69%, and 86%; ages 50-64: 25%, 48%, and 71%; ages 65+: 8%, 21%, and 43%. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.', 150, array['task_achievement','lexical_resource'], array['writing:line-graph','writing:trends','writing:data-language'], 6.5, 'trend_language'),
    ('writing-academic-v2', 3, 'writing_task1_academic', 'The diagram below shows how coffee beans are processed for retail sale. The stages are: harvesting ripe cherries, washing and sorting, drying in the sun, removing the outer layer, grading the beans, roasting, rapid cooling, and packaging. Summarise the process by selecting and reporting the main features.', 150, array['task_achievement','grammatical_range_and_accuracy'], array['writing:process','writing:sequence','writing:passive-voice'], 6.5, 'process_sequence'),
    ('writing-academic-v2', 4, 'writing_task1_academic', 'The two maps below show a town waterfront in 2000 and today. In 2000 it contained warehouses along the river, a small car park in the west, and an unused railway line. Today the warehouses have been replaced by apartments and cafes, the car park has become a public garden, the railway is a cycling path, and a footbridge connects the waterfront to the town centre. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.', 150, array['task_achievement','coherence_and_cohesion'], array['writing:maps','writing:change','writing:spatial-language'], 7.0, 'map_comparison'),
    ('writing-academic-v2', 5, 'writing_task1_academic', 'The bar chart below compares the percentage of commuters using four forms of transport in a city in 2005 and 2025. Car use changed from 62% to 38%, bus use from 18% to 24%, rail use from 12% to 23%, and cycling from 8% to 15%. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.', 150, array['lexical_resource','grammatical_range_and_accuracy'], array['writing:bar-chart','writing:comparison','writing:complex-sentences'], 7.5, 'comparative_language'),
    ('writing-academic-v2', 6, 'writing_task2_essay', 'Many people check work messages outside their normal working hours. Why has this become common, and what could employers do to reduce its negative effects?', 250, array['task_response','coherence_and_cohesion'], array['writing:two-part-question','writing:cause-solution','writing:work'], 6.5, 'two_part_response'),
    ('writing-academic-v2', 7, 'writing_task2_essay', 'Public transport should be free in large cities. To what extent do you agree or disagree?', 250, array['task_response','lexical_resource'], array['writing:opinion','writing:position','writing:transport'], 7.0, 'clear_position'),
    ('writing-academic-v2', 8, 'writing_task2_essay', 'Some people think secondary schools should focus mainly on academic subjects, while others believe practical skills should receive equal attention. Discuss both views and give your own opinion.', 250, array['task_response','coherence_and_cohesion'], array['writing:discussion','writing:balanced-structure','writing:education'], 7.5, 'balanced_discussion'),
    ('writing-academic-v2', 9, 'writing_task2_essay', 'Tourism is increasing in remote natural areas. What are the advantages and disadvantages of this development?', 250, array['lexical_resource','grammatical_range_and_accuracy'], array['writing:advantages-disadvantages','writing:environment','writing:evaluation'], 7.5, 'balanced_evaluation'),
    ('writing-academic-v2', 10, 'writing_task2_essay', 'Large amounts of edible food are thrown away by households and restaurants. What causes this problem, and what measures could reduce it?', 250, array['task_response','grammatical_range_and_accuracy'], array['writing:problem-solution','writing:food-waste','writing:complex-sentences'], 8.0, 'problem_solution'),

    ('writing-general-v2', 1, 'writing_task1_general', 'A friend will stay in your home while you are away. Write a letter to your friend. Explain how to collect the keys, describe two things they should know about the home, and suggest something to do nearby.', 150, array['task_achievement','coherence_and_cohesion'], array['writing:informal-letter','writing:instructions','writing:suggestion'], 5.5, 'informal_tone'),
    ('writing-general-v2', 2, 'writing_task1_general', 'Noise from a neighbour has recently made it difficult for you to sleep. Write a letter to the neighbour. Explain the problem, describe how it affects you, and suggest a practical solution.', 150, array['task_achievement','lexical_resource'], array['writing:semi-formal-letter','writing:complaint','writing:polite-request'], 6.0, 'semi_formal_tone'),
    ('writing-general-v2', 3, 'writing_task1_general', 'A road near a local school is unsafe for pedestrians. Write a letter to the local council. Describe the problem, explain who is affected, and recommend two changes.', 150, array['task_achievement','grammatical_range_and_accuracy'], array['writing:formal-letter','writing:recommendation','writing:road-safety'], 6.5, 'formal_tone'),
    ('writing-general-v2', 4, 'writing_task1_general', 'You would like to change your working hours for three months. Write a letter to your manager. Explain why you need the change, propose a new schedule, and say how you will ensure your work is completed.', 150, array['coherence_and_cohesion','lexical_resource'], array['writing:formal-letter','writing:request','writing:workplace'], 7.0, 'request_structure'),
    ('writing-general-v2', 5, 'writing_task1_general', 'You stayed with a family friend during a visit to another city. Write a letter to thank them. Say what you enjoyed about the visit, mention something you left behind, and invite them to visit you.', 150, array['task_achievement','grammatical_range_and_accuracy'], array['writing:informal-letter','writing:thanks','writing:invitation'], 7.0, 'informal_range'),
    ('writing-general-v2', 6, 'writing_task2_essay', 'More public services are becoming available only through websites and mobile applications. Do the advantages of this development outweigh the disadvantages?', 250, array['task_response','coherence_and_cohesion'], array['writing:outweigh-essay','writing:public-services','writing:evaluation'], 6.5, 'outweigh_judgement'),
    ('writing-general-v2', 7, 'writing_task2_essay', 'Some people believe teenagers should have part-time jobs, while others think they should concentrate entirely on education. Discuss both views and give your own opinion.', 250, array['task_response','lexical_resource'], array['writing:discussion','writing:teenagers','writing:work-study'], 7.0, 'balanced_discussion'),
    ('writing-general-v2', 8, 'writing_task2_essay', 'An increasing number of families are moving from large cities to smaller towns. What are the advantages and disadvantages of this trend?', 250, array['coherence_and_cohesion','grammatical_range_and_accuracy'], array['writing:advantages-disadvantages','writing:housing','writing:lifestyle'], 7.0, 'balanced_evaluation'),
    ('writing-general-v2', 9, 'writing_task2_essay', 'Many communities produce more household waste than in the past. Why is this happening, and what can individuals and local authorities do about it?', 250, array['task_response','grammatical_range_and_accuracy'], array['writing:problem-solution','writing:waste','writing:shared-responsibility'], 7.5, 'cause_solution'),
    ('writing-general-v2', 10, 'writing_task2_essay', 'Many adults do less physical exercise than they intend to. Why is it difficult for them to exercise regularly, and how could this situation be improved?', 250, array['lexical_resource','coherence_and_cohesion'], array['writing:two-part-question','writing:health','writing:solutions'], 7.5, 'two_part_response'),

    ('speaking-v2', 1, 'speaking_part1', 'Let us talk about parks. How often do you visit a park, and what do you usually do there?', null, array['fluency_and_coherence','pronunciation'], array['speaking:part1','speaking:frequency','speaking:personal-example'], 5.0, 'short_extended_answer'),
    ('speaking-v2', 2, 'speaking_part1', 'Do you enjoy taking photographs? What kinds of things do you normally photograph?', null, array['lexical_resource','pronunciation'], array['speaking:part1','speaking:preferences','speaking:topic-vocabulary'], 5.5, 'topic_vocabulary'),
    ('speaking-v2', 3, 'speaking_part1', 'Who usually cooks in your home, and would you like to cook more often?', null, array['fluency_and_coherence','grammatical_range_and_accuracy'], array['speaking:part1','speaking:habits','speaking:future-intention'], 6.0, 'tense_control'),
    ('speaking-v2', 4, 'speaking_part1', 'What form of transport do you use most often? Is there anything you would change about it?', null, array['lexical_resource','grammatical_range_and_accuracy'], array['speaking:part1','speaking:transport','speaking:comparison'], 6.5, 'specific_detail'),
    ('speaking-v2', 5, 'speaking_part1', 'How are your weekends different from your weekdays?', null, array['fluency_and_coherence','pronunciation'], array['speaking:part1','speaking:comparison','speaking:daily-life'], 7.0, 'coherent_comparison'),
    ('speaking-v2', 6, 'speaking_part2_cuecard', 'Describe a person who gave you useful help. Say who the person was, when they helped you, what they did, and explain why the help was important.', null, array['fluency_and_coherence','lexical_resource'], array['speaking:part2','speaking:long-turn','speaking:narrative'], 6.0, 'narrative_structure'),
    ('speaking-v2', 7, 'speaking_part2_cuecard', 'Describe a difficult decision you made. Say what the decision was, why it was difficult, what you decided, and explain how you felt afterwards.', null, array['grammatical_range_and_accuracy','pronunciation'], array['speaking:part2','speaking:past-tenses','speaking:reflection'], 6.5, 'past_tense_range'),
    ('speaking-v2', 8, 'speaking_part2_cuecard', 'Describe an object you use almost every day. Say what it is, how long you have had it, what you use it for, and explain why it is useful to you.', null, array['lexical_resource','fluency_and_coherence'], array['speaking:part2','speaking:description','speaking:organisation'], 7.0, 'descriptive_range'),
    ('speaking-v2', 9, 'speaking_part2_cuecard', 'Describe an outdoor activity you tried for the first time. Say where and when you tried it, who was with you, what happened, and explain whether you would do it again.', null, array['pronunciation','grammatical_range_and_accuracy'], array['speaking:part2','speaking:sequence','speaking:future-condition'], 7.5, 'extended_narrative'),
    ('speaking-v2', 10, 'speaking_part2_cuecard', 'Describe a local event that brings people together. Say what the event is, where it takes place, what people do, and explain why it matters to the community.', null, array['fluency_and_coherence','lexical_resource'], array['speaking:part2','speaking:community','speaking:abstract-explanation'], 8.0, 'long_turn_depth'),
    ('speaking-v2', 11, 'speaking_part3', 'Why are some people more willing to volunteer than others, and how can organisations retain volunteers?', null, array['fluency_and_coherence','grammatical_range_and_accuracy'], array['speaking:part3','speaking:cause-effect','speaking:solutions'], 6.5, 'abstract_cause_solution'),
    ('speaking-v2', 12, 'speaking_part3', 'Should young people make important decisions independently, or should families guide them closely?', null, array['lexical_resource','pronunciation'], array['speaking:part3','speaking:balanced-view','speaking:family'], 7.0, 'balanced_view'),
    ('speaking-v2', 13, 'speaking_part3', 'Why do people replace useful possessions, and what effects does this have on society?', null, array['fluency_and_coherence','lexical_resource'], array['speaking:part3','speaking:consumerism','speaking:consequences'], 7.5, 'developed_explanation'),
    ('speaking-v2', 14, 'speaking_part3', 'How should cities balance the need for housing with the need for green public spaces?', null, array['grammatical_range_and_accuracy','pronunciation'], array['speaking:part3','speaking:policy','speaking:trade-offs'], 8.0, 'complex_tradeoff'),
    ('speaking-v2', 15, 'speaking_part3', 'Which traditions are most likely to survive social change, and who should be responsible for preserving them?', null, array['fluency_and_coherence','lexical_resource'], array['speaking:part3','speaking:culture','speaking:evaluation'], 8.0, 'abstract_evaluation')
), resolved as (
  select
    case prompt_rows.test_key
      when 'writing-academic-v2' then md5('debatelab:coach:writing-academic:v2')::uuid
      when 'writing-general-v2' then md5('debatelab:coach:writing-general:v2')::uuid
      else md5('debatelab:coach:speaking:v2')::uuid
    end as test_id,
    prompt_rows.*
  from prompt_rows
)
insert into public.ielts_questions (
  id, test_id, skill, question_type, order_index, prompt, max_points,
  word_limit, metadata
)
select
  md5('debatelab:coach:question:v2:' || test_key || ':' || ordinal::text)::uuid,
  test_id,
  case
    when test_key = 'speaking-v2' then 'speaking'::public.ielts_skill
    else 'writing'::public.ielts_skill
  end,
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
    'practice_focus', practice_focus,
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

