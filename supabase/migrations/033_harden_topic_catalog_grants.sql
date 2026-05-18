-- Keep the bilingual topic catalog readable to signed-in users only.
-- RLS already denies writes, but explicit grants make the exposed API surface match
-- the intended read-only contract.

revoke all on table public.practice_topics from anon, authenticated;
revoke all on table public.practice_topic_translations from anon, authenticated;
revoke all on table public.practice_topic_category_translations from anon, authenticated;

grant select on table public.practice_topics to authenticated;
grant select on table public.practice_topic_translations to authenticated;
grant select on table public.practice_topic_category_translations to authenticated;
