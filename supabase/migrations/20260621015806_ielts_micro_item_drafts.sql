-- =============================================================================
-- WS-6.1.4 — IELTS AI micro-item draft queue
-- =============================================================================
-- Bootstrap queue for teacher-reviewed Learn-mode micro-items. Drafts are
-- generated only from existing IELTS item-bank content and NEVER auto-published.
--
-- Security model:
--   * Drafts contain answer keys, so they are admin-only. RLS has no learner
--     read policy.
--   * Published learner-visible activity rows receive only public draft_content.
--     The answer key remains here, keyed by published_activity_id for later
--     server-side scoring.
--   * The activity_type check is extended additively for the first text
--     micro-types from the shared adaptive contract.
-- =============================================================================

begin;

create table if not exists public.ielts_micro_item_drafts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references public.ielts_tests(id) on delete set null,
  source_question_id uuid references public.ielts_questions(id) on delete set null,
  source_passage_id uuid references public.passages(id) on delete set null,
  source_listening_section_id uuid references public.listening_sections(id) on delete set null,
  activity_type text not null check (activity_type in (
    'ielts_vocab_collocation',
    'ielts_paraphrase_transform',
    'ielts_gap_fill'
  )),
  subskill_key text references public.ielts_subskills(key)
    on update cascade on delete set null,
  draft_content jsonb not null,
  answer_key jsonb not null,
  rationale_en text not null,
  rationale_vi text not null,
  provenance jsonb not null default '{}'::jsonb,
  model_provider text,
  model_name text,
  prompt_version text not null default 'ielts-micro-draft-v1',
  status text not null default 'needs_review' check (status in (
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'published'
  )),
  qa_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  edited_by uuid references public.profiles(id) on delete set null,
  published_activity_id uuid references public.activities(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ielts_micro_item_drafts_source_check
    check (
      source_question_id is not null
      or source_passage_id is not null
      or source_listening_section_id is not null
    ),
  constraint ielts_micro_item_drafts_json_shape_check
    check (
      jsonb_typeof(draft_content) = 'object'
      and jsonb_typeof(answer_key) = 'object'
      and answer_key <> '{}'::jsonb
      and not (draft_content ?| array[
        'answer_key',
        'answerKey',
        'correct_answer',
        'correctAnswer',
        'accept_variants',
        'acceptVariants',
        'acceptedAnswers'
      ])
    ),
  constraint ielts_micro_item_drafts_publish_check
    check (
      (status <> 'published' and published_activity_id is null and published_at is null)
      or (status = 'published' and published_activity_id is not null and published_at is not null)
    ),
  constraint ielts_micro_item_drafts_review_check
    check (
      status in ('draft', 'needs_review')
      or (reviewer_id is not null and reviewed_at is not null)
    )
);

comment on table public.ielts_micro_item_drafts is
  'Admin-only QA queue for AI-drafted IELTS Learn micro-items. Learner-visible content and answer keys are separated.';

comment on column public.ielts_micro_item_drafts.draft_content is
  'Learner-visible micro-activity content. Must never contain answer keys.';

comment on column public.ielts_micro_item_drafts.answer_key is
  'Admin-only/server-side scoring key for the draft or published micro-activity.';

comment on column public.ielts_micro_item_drafts.provenance is
  'Source IDs, source text slices, and generation audit metadata proving the item was drafted from original IELTS content.';

create index if not exists idx_ielts_micro_item_drafts_test_status
  on public.ielts_micro_item_drafts(test_id, status, created_at desc);

create index if not exists idx_ielts_micro_item_drafts_source_question
  on public.ielts_micro_item_drafts(source_question_id, created_at desc)
  where source_question_id is not null;

create index if not exists idx_ielts_micro_item_drafts_status_created
  on public.ielts_micro_item_drafts(status, created_at desc);

create index if not exists idx_ielts_micro_item_drafts_subskill
  on public.ielts_micro_item_drafts(subskill_key)
  where subskill_key is not null;

create unique index if not exists idx_ielts_micro_item_drafts_published_activity
  on public.ielts_micro_item_drafts(published_activity_id)
  where published_activity_id is not null;

alter table public.ielts_micro_item_drafts enable row level security;

drop policy if exists "Admins manage IELTS micro item drafts"
  on public.ielts_micro_item_drafts;
create policy "Admins manage IELTS micro item drafts"
  on public.ielts_micro_item_drafts
  for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

revoke all on table public.ielts_micro_item_drafts
  from anon, authenticated, service_role;
grant select, insert, update, delete on table public.ielts_micro_item_drafts
  to authenticated;
grant all on table public.ielts_micro_item_drafts
  to service_role;

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

commit;
