-- Allow the first learner-visible IELTS Learn micro-activities to be stored in
-- the existing activities table. The types are implemented through the typed
-- activity registry; this migration only updates the storage constraint.

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
    'ielts_gap_fill'
  ]::text[]));
