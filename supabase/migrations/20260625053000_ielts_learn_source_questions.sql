-- Seed scorable IELTS Learn source questions and repoint activities that were
-- accidentally wired to a keyless Writing Task 2 essay placeholder.

begin;

insert into public.ielts_tests (
  id,
  slug,
  title,
  kind,
  module,
  skill,
  status,
  version,
  description,
  published_at,
  metadata
) values (
  '0de70000-0000-4000-a000-0000000f1000',
  'ielts-learn-writing-source-bank-v1',
  'IELTS Learn Writing Source Bank',
  'drill',
  'academic',
  'writing',
  'published',
  1,
  'Hidden source bank for IELTS Learn micro-activities.',
  now(),
  '{
    "purpose": "ielts_learn_source_bank",
    "hidden_from_library": true,
    "seed": "20260625053000_ielts_learn_source_questions"
  }'::jsonb
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  kind = excluded.kind,
  module = excluded.module,
  skill = excluded.skill,
  status = excluded.status,
  description = excluded.description,
  metadata = public.ielts_tests.metadata || excluded.metadata,
  updated_at = now(),
  published_at = coalesce(public.ielts_tests.published_at, excluded.published_at);

insert into public.ielts_questions (
  id,
  test_id,
  skill,
  question_type,
  order_index,
  group_instructions,
  prompt,
  options,
  max_points,
  word_limit,
  metadata
) values
  (
    '0de70000-0000-4000-a000-0000000d1001',
    '0de70000-0000-4000-a000-0000000f1000',
    'writing',
    'mcq_single',
    1,
    null,
    'Choose the strongest collocation for a Task 2 essay sentence: Governments should ____ policies that encourage lifelong learning.',
    '[
      { "id": "a", "text": "make" },
      { "id": "b", "text": "implement" },
      { "id": "c", "text": "do" },
      { "id": "d", "text": "perform" }
    ]'::jsonb,
    1,
    null,
    '{"purpose": "ielts_learn_source_bank"}'::jsonb
  ),
  (
    '0de70000-0000-4000-a000-0000000d1002',
    '0de70000-0000-4000-a000-0000000f1000',
    'writing',
    'mcq_single',
    2,
    null,
    'Choose the best word for an IELTS education essay: Scholarships can make university more ____ for students from low-income families.',
    '[
      { "id": "a", "text": "accessible" },
      { "id": "b", "text": "accessed" },
      { "id": "c", "text": "access" },
      { "id": "d", "text": "accessibly" }
    ]'::jsonb,
    1,
    null,
    '{"purpose": "ielts_learn_source_bank"}'::jsonb
  ),
  (
    '0de70000-0000-4000-a000-0000000d1003',
    '0de70000-0000-4000-a000-0000000f1000',
    'writing',
    'sentence_completion',
    3,
    'Write ONE word.',
    'If universities invested more in teacher training, students ____ receive more individual feedback.',
    '[]'::jsonb,
    1,
    1,
    '{"purpose": "ielts_learn_source_bank"}'::jsonb
  )
on conflict (id) do update set
  test_id = excluded.test_id,
  skill = excluded.skill,
  question_type = excluded.question_type,
  order_index = excluded.order_index,
  group_instructions = excluded.group_instructions,
  prompt = excluded.prompt,
  options = excluded.options,
  max_points = excluded.max_points,
  word_limit = excluded.word_limit,
  metadata = public.ielts_questions.metadata || excluded.metadata,
  updated_at = now();

insert into public.ielts_question_keys (
  question_id,
  correct_answer,
  accept_variants,
  explanation_en,
  explanation_vi,
  examiner_notes
) values
  (
    '0de70000-0000-4000-a000-0000000d1001',
    '["b"]'::jsonb,
    '["implement policies", "implement"]'::jsonb,
    'The standard academic collocation is "implement policies"; the other verbs are unnatural in this context.',
    'Cụm từ học thuật tự nhiên là "implement policies"; các động từ còn lại không phù hợp trong ngữ cảnh này.',
    '{"source": "ielts_learn_source_bank"}'::jsonb
  ),
  (
    '0de70000-0000-4000-a000-0000000d1002',
    '["a"]'::jsonb,
    '["accessible"]'::jsonb,
    '"Accessible" means easier to enter or use, which fits the sentence about scholarships and university access.',
    '"Accessible" nghĩa là dễ tiếp cận hơn, phù hợp với câu về học bổng và cơ hội vào đại học.',
    '{"source": "ielts_learn_source_bank"}'::jsonb
  ),
  (
    '0de70000-0000-4000-a000-0000000d1003',
    '["would"]'::jsonb,
    '[]'::jsonb,
    'The if-clause uses past simple for an unreal condition, so the result clause needs "would".',
    'Mệnh đề if dùng quá khứ đơn cho điều kiện giả định, nên mệnh đề kết quả cần "would".',
    '{"source": "ielts_learn_source_bank"}'::jsonb
  )
on conflict (question_id) do update set
  correct_answer = excluded.correct_answer,
  accept_variants = excluded.accept_variants,
  explanation_en = excluded.explanation_en,
  explanation_vi = excluded.explanation_vi,
  examiner_notes = public.ielts_question_keys.examiner_notes || excluded.examiner_notes,
  updated_at = now();

update public.activities
set
  content = jsonb_set(
    content,
    '{sources}',
    jsonb_build_array(
      jsonb_build_object(
        'questionId', '0de70000-0000-4000-a000-0000000d1001',
        'subskillKey', 'writing:collocation_precision',
        'labelEn', 'Policy collocation',
        'labelVi', 'Cụm từ về chính sách'
      )
    ),
    false
  ),
  updated_at = now()
where id = '0de70000-0000-4000-a000-0000000f0003'
  and activity_type = 'ielts_vocab_collocation';

update public.activities
set
  content = jsonb_set(
    content,
    '{sources}',
    jsonb_build_array(
      jsonb_build_object(
        'questionId', '0de70000-0000-4000-a000-0000000d1003',
        'subskillKey', 'writing:grammar_range_accuracy',
        'labelEn', 'Conditional grammar',
        'labelVi', 'Ngữ pháp câu điều kiện'
      )
    ),
    false
  ),
  updated_at = now()
where id = '0de70000-0000-4000-a000-0000000f0004'
  and activity_type = 'ielts_gap_fill';

update public.activities
set
  content = jsonb_set(
    content,
    '{sources}',
    jsonb_build_array(
      jsonb_build_object(
        'questionId', '0de70000-0000-4000-a000-0000000d1002',
        'subskillKey', 'writing:lexical_resource',
        'labelEn', 'Education vocabulary',
        'labelVi', 'Từ vựng chủ đề giáo dục'
      )
    ),
    false
  ),
  updated_at = now()
where id = '0de70000-0000-4000-a000-0000000f0005'
  and activity_type = 'ielts_vocab_collocation';

commit;
