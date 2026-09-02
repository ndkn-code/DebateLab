-- Freeze question groups into the per-attempt content snapshot so an
-- in-flight attempt keeps rendering and grading against the exact set
-- stimulus it was started with, even if the author later edits the group.
-- Append-only, like ielts_attempt_question_blueprints.

begin;

create table if not exists public.ielts_attempt_question_group_blueprints (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_id uuid not null references public.ielts_tests(id) on delete restrict,
  group_id uuid references public.ielts_question_groups(id) on delete restrict,
  skill public.ielts_skill not null,
  group_key text not null,
  order_index integer not null default 0,
  title text,
  instructions text,
  stimulus jsonb,
  bank jsonb not null default '[]'::jsonb,
  bank_reuse boolean not null default false,
  answer_mode text,
  any_order boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  passage_id uuid,
  listening_section_id uuid,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, group_key)
);

create index if not exists ielts_attempt_question_group_blueprints_attempt_idx
  on public.ielts_attempt_question_group_blueprints(attempt_id, order_index);
create index if not exists ielts_attempt_question_group_blueprints_user_idx
  on public.ielts_attempt_question_group_blueprints(user_id, attempt_id);

alter table public.ielts_attempt_question_group_blueprints enable row level security;

drop policy if exists "Users view own IELTS attempt group blueprints"
  on public.ielts_attempt_question_group_blueprints;
create policy "Users view own IELTS attempt group blueprints"
  on public.ielts_attempt_question_group_blueprints
  for select using (
    user_id = (select auth.uid()) or private.is_admin((select auth.uid()))
  );

revoke all on public.ielts_attempt_question_group_blueprints from anon;
grant select on public.ielts_attempt_question_group_blueprints to authenticated;
grant all on public.ielts_attempt_question_group_blueprints to service_role;

drop trigger if exists ielts_attempt_group_blueprint_immutable
  on public.ielts_attempt_question_group_blueprints;
create trigger ielts_attempt_group_blueprint_immutable
  before update or delete on public.ielts_attempt_question_group_blueprints
  for each row execute function private.prevent_ielts_attempt_blueprint_mutation();

-- Same signature and body as 20260829180000, plus the group snapshot insert.
create or replace function public.ielts_create_attempt_with_blueprint(
  p_user_id uuid,
  p_test_id uuid,
  p_module public.ielts_module,
  p_attempt_number integer,
  p_sections jsonb,
  p_club_id uuid default null,
  p_class_id uuid default null,
  p_assignment_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_attempt_id uuid;
  v_test public.ielts_tests%rowtype;
begin
  if p_user_id is null or p_test_id is null then raise exception 'INVALID_ATTEMPT_CONTEXT'; end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'EMPTY_ATTEMPT_BLUEPRINT';
  end if;
  select * into v_test from public.ielts_tests where id = p_test_id;
  if not found then raise exception 'TEST_NOT_FOUND'; end if;
  if v_test.module <> p_module then raise exception 'TEST_MODULE_MISMATCH'; end if;

  insert into public.ielts_attempts (
    user_id, test_id, module, status, attempt_number, club_id, class_id,
    assignment_id, assessment_mode, test_version, blueprint_frozen_at
  ) values (
    p_user_id, p_test_id, p_module, 'in_progress', greatest(p_attempt_number, 1),
    p_club_id, p_class_id, p_assignment_id, v_test.assessment_mode, v_test.version, null
  ) returning id into v_attempt_id;

  insert into public.ielts_attempt_sections (
    attempt_id, user_id, skill, section_order, label, time_limit_seconds
  )
  select v_attempt_id, p_user_id, x.skill::public.ielts_skill, x.section_order,
         x.label, x.time_limit_seconds
    from jsonb_to_recordset(p_sections) as x(
      skill text, section_order integer, label text, time_limit_seconds integer
    )
   where not (v_test.assessment_mode = 'simulation' and x.skill = 'speaking');
  if not exists (select 1 from public.ielts_attempt_sections where attempt_id = v_attempt_id) then
    raise exception 'EMPTY_ATTEMPT_BLUEPRINT';
  end if;
  if v_test.assessment_mode = 'simulation' and (
    (select count(*) from public.ielts_attempt_sections where attempt_id = v_attempt_id) <> 3
    or (select count(distinct skill) from public.ielts_attempt_sections where attempt_id = v_attempt_id and skill in ('listening','reading','writing')) <> 3
  ) then raise exception 'SIMULATION_REQUIRES_LISTENING_READING_WRITING'; end if;

  insert into public.ielts_attempt_question_blueprints (
    attempt_id, section_id, user_id, test_id, question_id, skill, question_type,
    question_order, group_key, group_instructions, prompt, options, max_points,
    word_limit, visual, metadata, passage_id, listening_section_id, source_updated_at
  )
  select v_attempt_id, s.id, p_user_id, q.test_id, q.id, q.skill, q.question_type,
         q.order_index, q.group_key, q.group_instructions, q.prompt, q.options,
         q.max_points, q.word_limit, q.visual, q.metadata, q.passage_id,
         q.listening_section_id, q.updated_at
    from public.ielts_attempt_sections s
    join public.ielts_questions q
      on q.test_id = p_test_id and q.skill = s.skill
   where s.attempt_id = v_attempt_id;
  if exists (
    select 1 from public.ielts_attempt_sections s
     where s.attempt_id = v_attempt_id
       and not exists (select 1 from public.ielts_attempt_question_blueprints b where b.section_id = s.id)
  ) then raise exception 'INCOMPLETE_ATTEMPT_BLUEPRINT'; end if;

  -- Freeze every group referenced by at least one frozen question.
  insert into public.ielts_attempt_question_group_blueprints (
    attempt_id, user_id, test_id, group_id, skill, group_key, order_index,
    title, instructions, stimulus, bank, bank_reuse, answer_mode, any_order,
    metadata, passage_id, listening_section_id, source_updated_at
  )
  select v_attempt_id, p_user_id, g.test_id, g.id, g.skill, g.group_key, g.order_index,
         g.title, g.instructions, g.stimulus, g.bank, g.bank_reuse, g.answer_mode,
         g.any_order, g.metadata, g.passage_id, g.listening_section_id, g.updated_at
    from public.ielts_question_groups g
   where g.test_id = p_test_id
     and exists (
       select 1 from public.ielts_attempt_question_blueprints b
        where b.attempt_id = v_attempt_id and b.group_key = g.group_key
     );

  insert into public.ielts_attempt_question_keys (attempt_id, question_id, correct_answer, accept_variants)
  select b.attempt_id, b.question_id, coalesce(k.correct_answer, '{}'::jsonb),
         coalesce(k.accept_variants, '[]'::jsonb)
    from public.ielts_attempt_question_blueprints b
    left join public.ielts_question_keys k on k.question_id = b.question_id
   where b.attempt_id = v_attempt_id;

  update public.ielts_attempts
     set blueprint_frozen_at = now(), updated_at = now()
   where id = v_attempt_id;
  return v_attempt_id;
end;
$$;

revoke execute on function public.ielts_create_attempt_with_blueprint(uuid, uuid, public.ielts_module, integer, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ielts_create_attempt_with_blueprint(uuid, uuid, public.ielts_module, integer, jsonb, uuid, uuid, uuid) to service_role;

commit;
