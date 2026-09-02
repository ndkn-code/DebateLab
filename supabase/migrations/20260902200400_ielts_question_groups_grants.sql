-- Align question-group grants with their sibling tables.
--
-- `ielts_questions` / `passages` / `listening_sections` grant `anon` and
-- `authenticated` table access and rely on RLS ("viewable when published").
-- The group table must match, or a published set renders its questions but
-- not its shared stimulus for anonymous-role readers (including the local
-- dev bypass). The attempt snapshot mirrors `ielts_attempt_question_blueprints`:
-- learners may only SELECT their own rows; writes are service-role only.

begin;

grant select on public.ielts_question_groups to anon;

revoke insert, update, delete, truncate, references, trigger
  on public.ielts_attempt_question_group_blueprints from authenticated;
grant select on public.ielts_attempt_question_group_blueprints to authenticated;
revoke all on public.ielts_attempt_question_group_blueprints from anon;

commit;
