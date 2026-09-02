-- Add the official IELTS "matching sentence endings" format to the question
-- type enum.  Enum values cannot be used in the same transaction that adds
-- them, so this migration contains nothing else (see CLAUDE.md gotchas).
alter type public.ielts_question_type
  add value if not exists 'matching_sentence_endings' after 'matching_features';
