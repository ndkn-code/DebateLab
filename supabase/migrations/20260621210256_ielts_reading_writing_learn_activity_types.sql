-- WS-6.3d Workstream A — B2B IELTS reading/writing Learn micro-activities.
-- This only extends the existing activities storage constraint; completion,
-- XP, adaptive evidence, and mastery continue through completeActivity.

alter table public.activities
  drop constraint if exists activities_activity_type_check;

alter table public.activities
  add constraint activities_activity_type_check
  check (activity_type = any (array[
    'lesson',
    'quiz',
    'matching',
    'fill_blank',
    'drag_order',
    'flashcard',
    'ielts_vocab_collocation',
    'ielts_paraphrase_transform',
    'ielts_gap_fill',
    'ielts_tfng_reasoning',
    'ielts_scan_detail',
    'ielts_sentence_transform',
    'ielts_cohesion_linker'
  ]::text[]));

alter table public.ielts_micro_item_drafts
  drop constraint if exists ielts_micro_item_drafts_activity_type_check;

alter table public.ielts_micro_item_drafts
  add constraint ielts_micro_item_drafts_activity_type_check
  check (activity_type = any (array[
    'ielts_vocab_collocation',
    'ielts_paraphrase_transform',
    'ielts_gap_fill',
    'ielts_tfng_reasoning',
    'ielts_scan_detail',
    'ielts_sentence_transform',
    'ielts_cohesion_linker'
  ]::text[]));
