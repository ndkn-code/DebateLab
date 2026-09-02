-- IELTS question groups: set-level stimulus shared by a run of numbered
-- questions (matching banks, summary/note/table/flow-chart completion text,
-- diagram/map images with hotspots).  One `ielts_questions` row still equals
-- one numbered question; a group is joined by (test_id, group_key) and never
-- changes how existing single-blank content is stored or graded.

begin;

create table if not exists public.ielts_question_groups (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.ielts_tests(id) on delete cascade,
  skill public.ielts_skill not null,
  passage_id uuid references public.passages(id) on delete cascade,
  listening_section_id uuid references public.listening_sections(id) on delete cascade,
  group_key text not null check (group_key ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  order_index integer not null default 0 check (order_index >= 0),
  title text,
  instructions text,
  -- Typed in TypeScript (lib/ielts/question-types/groups.ts):
  --   text | table | flowchart | image (with hotspots keyed by slot)
  stimulus jsonb,
  -- Shared option bank [{id,label,text}] for headings / features / endings /
  -- word lists / map letters.  Empty when blanks are typed free text.
  bank jsonb not null default '[]'::jsonb,
  -- "NB You may use any letter more than once."
  bank_reuse boolean not null default false,
  -- How the group's blanks are answered: from the bank or typed.
  answer_mode text check (answer_mode is null or answer_mode in ('select', 'text')),
  -- "Questions 21 and 22 may be given IN ANY ORDER" — graded set-wise.
  any_order boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, group_key),
  check (not (passage_id is not null and listening_section_id is not null))
);

create index if not exists ielts_question_groups_test_order_idx
  on public.ielts_question_groups(test_id, order_index);
create index if not exists ielts_question_groups_passage_idx
  on public.ielts_question_groups(passage_id) where passage_id is not null;
create index if not exists ielts_question_groups_listening_section_idx
  on public.ielts_question_groups(listening_section_id) where listening_section_id is not null;

alter table public.ielts_question_groups enable row level security;

drop policy if exists "IELTS question groups are viewable when published" on public.ielts_question_groups;
create policy "IELTS question groups are viewable when published" on public.ielts_question_groups
  for select using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1 from public.ielts_tests t
       where t.id = ielts_question_groups.test_id and t.status = 'published'
    )
  );

drop policy if exists "Admins manage IELTS question groups" on public.ielts_question_groups;
create policy "Admins manage IELTS question groups" on public.ielts_question_groups
  for all using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

revoke all on public.ielts_question_groups from anon;
grant select on public.ielts_question_groups to authenticated;
grant all on public.ielts_question_groups to service_role;

commit;
