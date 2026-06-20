-- =============================================================================
-- WS-1.1 — IELTS content authoring (atomic question+key writes + versioning)
-- =============================================================================
-- Builds on the WS-0.3 data model (20260618205215_ielts_data_model.sql). ADDITIVE
-- ONLY — no existing table/column is altered or dropped; safe on a live DB.
--
-- Why this migration exists (data-access.md §8 — "one canonical create path"):
--   A question's non-secret fields (ielts_questions) and its SECRET answer key
--   (ielts_question_keys) MUST be written together in ONE transaction. supabase-js
--   issues one HTTP request per statement, so two separate inserts are two
--   transactions — a failure between them would leave an orphan question with no
--   key (ungradeable) or a key with no question. These RPCs make the pair atomic.
--
-- Security model:
--   * Both functions are SECURITY INVOKER (the default) — they do NOT bypass RLS.
--     The existing "Admins manage IELTS questions/answer keys" policies from
--     WS-0.3 still govern every write, so an authoring RPC inherits exactly the
--     same authorization as a direct insert. No privilege escalation, no need for
--     an in-function is_admin() check. (Service-role callers bypass RLS as usual.)
--   * search_path is pinned to public so unqualified table names can't be shadowed.
--   * EXECUTE is revoked from anon and granted only to authenticated + service_role.
--
-- Versioning:
--   * ielts_content_versions stores an immutable jsonb snapshot of a test's full
--     tree (test + passages + listening sections + questions + KEYS) at each
--     publish/snapshot. Because the snapshot embeds answer keys it is admin-only
--     (no learner-readable policy), exactly like ielts_question_keys.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Atomic create: insert an ielts_questions row and its ielts_question_keys
--    row in a single transaction. Returns the (non-secret) question row only.
-- -----------------------------------------------------------------------------
create or replace function public.create_ielts_question_with_key(
  p_test_id uuid,
  p_skill public.ielts_skill,
  p_question_type public.ielts_question_type,
  p_prompt text,
  p_passage_id uuid default null,
  p_listening_section_id uuid default null,
  p_order_index integer default 0,
  p_group_key text default null,
  p_group_instructions text default null,
  p_options jsonb default '[]'::jsonb,
  p_max_points integer default 1,
  p_word_limit integer default null,
  p_visual jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_correct_answer jsonb default '{}'::jsonb,
  p_accept_variants jsonb default '[]'::jsonb,
  p_explanation_en text default null,
  p_explanation_vi text default null,
  p_model_answer text default null,
  p_examiner_notes jsonb default '{}'::jsonb
) returns public.ielts_questions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_question public.ielts_questions;
begin
  insert into public.ielts_questions (
    test_id, passage_id, listening_section_id, skill, question_type,
    order_index, group_key, group_instructions, prompt, options,
    max_points, word_limit, visual, metadata
  ) values (
    p_test_id, p_passage_id, p_listening_section_id, p_skill, p_question_type,
    p_order_index, p_group_key, p_group_instructions, p_prompt,
    coalesce(p_options, '[]'::jsonb),
    p_max_points, p_word_limit, p_visual, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_question;

  insert into public.ielts_question_keys (
    question_id, correct_answer, accept_variants, explanation_en,
    explanation_vi, model_answer, examiner_notes
  ) values (
    v_question.id,
    coalesce(p_correct_answer, '{}'::jsonb),
    coalesce(p_accept_variants, '[]'::jsonb),
    p_explanation_en, p_explanation_vi, p_model_answer,
    coalesce(p_examiner_notes, '{}'::jsonb)
  );

  return v_question;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Atomic update: replace an ielts_questions row and its key row together.
--    The key row is upserted (re-created if somehow missing). Returns the row.
-- -----------------------------------------------------------------------------
create or replace function public.update_ielts_question_with_key(
  p_question_id uuid,
  p_skill public.ielts_skill,
  p_question_type public.ielts_question_type,
  p_prompt text,
  p_passage_id uuid default null,
  p_listening_section_id uuid default null,
  p_order_index integer default 0,
  p_group_key text default null,
  p_group_instructions text default null,
  p_options jsonb default '[]'::jsonb,
  p_max_points integer default 1,
  p_word_limit integer default null,
  p_visual jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_correct_answer jsonb default '{}'::jsonb,
  p_accept_variants jsonb default '[]'::jsonb,
  p_explanation_en text default null,
  p_explanation_vi text default null,
  p_model_answer text default null,
  p_examiner_notes jsonb default '{}'::jsonb
) returns public.ielts_questions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_question public.ielts_questions;
begin
  update public.ielts_questions set
    skill = p_skill,
    question_type = p_question_type,
    prompt = p_prompt,
    passage_id = p_passage_id,
    listening_section_id = p_listening_section_id,
    order_index = p_order_index,
    group_key = p_group_key,
    group_instructions = p_group_instructions,
    options = coalesce(p_options, '[]'::jsonb),
    max_points = p_max_points,
    word_limit = p_word_limit,
    visual = p_visual,
    metadata = coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where id = p_question_id
  returning * into v_question;

  if not found then
    raise exception 'ielts question % not found', p_question_id
      using errcode = 'no_data_found';
  end if;

  insert into public.ielts_question_keys (
    question_id, correct_answer, accept_variants, explanation_en,
    explanation_vi, model_answer, examiner_notes, updated_at
  ) values (
    p_question_id,
    coalesce(p_correct_answer, '{}'::jsonb),
    coalesce(p_accept_variants, '[]'::jsonb),
    p_explanation_en, p_explanation_vi, p_model_answer,
    coalesce(p_examiner_notes, '{}'::jsonb),
    now()
  )
  on conflict (question_id) do update set
    correct_answer = excluded.correct_answer,
    accept_variants = excluded.accept_variants,
    explanation_en = excluded.explanation_en,
    explanation_vi = excluded.explanation_vi,
    model_answer = excluded.model_answer,
    examiner_notes = excluded.examiner_notes,
    updated_at = now();

  return v_question;
end;
$$;

revoke all on function public.create_ielts_question_with_key(
  uuid, public.ielts_skill, public.ielts_question_type, text, uuid, uuid,
  integer, text, text, jsonb, integer, integer, jsonb, jsonb, jsonb, jsonb,
  text, text, text, jsonb
) from public, anon;
grant execute on function public.create_ielts_question_with_key(
  uuid, public.ielts_skill, public.ielts_question_type, text, uuid, uuid,
  integer, text, text, jsonb, integer, integer, jsonb, jsonb, jsonb, jsonb,
  text, text, text, jsonb
) to authenticated, service_role;

revoke all on function public.update_ielts_question_with_key(
  uuid, public.ielts_skill, public.ielts_question_type, text, uuid, uuid,
  integer, text, text, jsonb, integer, integer, jsonb, jsonb, jsonb, jsonb,
  text, text, text, jsonb
) from public, anon;
grant execute on function public.update_ielts_question_with_key(
  uuid, public.ielts_skill, public.ielts_question_type, text, uuid, uuid,
  integer, text, text, jsonb, integer, integer, jsonb, jsonb, jsonb, jsonb,
  text, text, text, jsonb
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Content versioning: immutable snapshot of a test's full tree per version.
--    Snapshot embeds answer keys -> admin-only (no learner policy), like keys.
-- -----------------------------------------------------------------------------
create table if not exists public.ielts_content_versions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.ielts_tests(id) on delete cascade,
  version integer not null check (version > 0),
  status public.ielts_content_status not null,
  snapshot jsonb not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (test_id, version)
);

create index if not exists idx_ielts_content_versions_test
  on public.ielts_content_versions(test_id, version desc);

alter table public.ielts_content_versions enable row level security;
revoke all on public.ielts_content_versions from anon;
drop policy if exists "Admins manage IELTS content versions" on public.ielts_content_versions;
create policy "Admins manage IELTS content versions" on public.ielts_content_versions
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

commit;
