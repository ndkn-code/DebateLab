-- Allow curated Trường Teen case skeletons to be stored as corpus items.

alter table public.debate_corpus_items
  drop constraint if exists debate_corpus_items_item_type_check;

alter table public.debate_corpus_items
  add constraint debate_corpus_items_item_type_check
  check (
    item_type in (
      'debate_moment',
      'phrase_bank',
      'judging_lesson',
      'case_skeleton'
    )
  );
