-- Normalize legacy demo IELTS answer-key envelopes from {"0": value} objects to
-- arrays. The scorer accepts both, but Learn source audits require keyed rows to
-- be authored in the current array shape.

begin;

update public.ielts_question_keys
set
  correct_answer = '["b"]'::jsonb,
  accept_variants = '[]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0001';

update public.ielts_question_keys
set
  correct_answer = '["not_given"]'::jsonb,
  accept_variants = '[]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0002';

update public.ielts_question_keys
set
  correct_answer = '["Sri Lanka"]'::jsonb,
  accept_variants = '["Sri Lanka", "sri lanka"]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0003';

update public.ielts_question_keys
set
  correct_answer = '["c"]'::jsonb,
  accept_variants = '[]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0004';

update public.ielts_question_keys
set
  correct_answer = '["library card"]'::jsonb,
  accept_variants = '["library card", "a library card"]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0011';

update public.ielts_question_keys
set
  correct_answer = '["b"]'::jsonb,
  accept_variants = '[]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0012';

update public.ielts_question_keys
set
  correct_answer = '["rivers"]'::jsonb,
  accept_variants = '["rivers", "river"]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0013';

update public.ielts_question_keys
set
  correct_answer = '["a"]'::jsonb,
  accept_variants = '[]'::jsonb,
  updated_at = now()
where question_id = '0de70000-0000-4000-a000-0000000d0014';

commit;
