begin;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Keep the
-- teacher-review RPCs available only to signed-in users; each RPC also checks
-- that the actor matches auth.uid() and can manage the scoped class.
revoke all on function public.save_ielts_teacher_review(
  uuid, uuid, uuid, integer, uuid, uuid, numeric, numeric, numeric, numeric,
  numeric, numeric, text, uuid
) from public, anon;
grant execute on function public.save_ielts_teacher_review(
  uuid, uuid, uuid, integer, uuid, uuid, numeric, numeric, numeric, numeric,
  numeric, numeric, text, uuid
) to authenticated;

revoke all on function public.publish_ielts_teacher_review(uuid, uuid)
  from public, anon;
grant execute on function public.publish_ielts_teacher_review(uuid, uuid)
  to authenticated;

revoke all on function public.return_ielts_teacher_review(uuid, text, uuid)
  from public, anon;
grant execute on function public.return_ielts_teacher_review(uuid, text, uuid)
  to authenticated;

-- Pin resolution for the service-role lexical RPC and the private rounding
-- helper so callers cannot influence name resolution through role settings.
alter function public.search_debate_corpus_items_lexical(
  text, integer, text, text, text[], numeric
) set search_path = public;

alter function private.ielts_half_band(numeric)
  set search_path = pg_catalog;
revoke all on function private.ielts_half_band(numeric)
  from public, anon, authenticated;

commit;
