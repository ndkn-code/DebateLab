-- Remove Postgres' default PUBLIC execute grant from the corpus vector RPC.

revoke execute on function public.match_debate_corpus_items(
  extensions.vector,
  integer,
  text,
  text,
  numeric
) from public, anon, authenticated;

grant execute on function public.match_debate_corpus_items(
  extensions.vector,
  integer,
  text,
  text,
  numeric
) to service_role;
