-- =============================================================================
-- WS-6.2.2 — IELTS study-plan revision log
-- =============================================================================
-- Append-only explanation log behind the study-plan page's "what changed in your
-- plan" section. Each row records one plan revision: the trigger, a bilingual
-- summary, how many items changed, and before/after snapshots for trust and
-- debugging.
--
-- Seam: WS-6.2.4 (replan triggers) WRITES these rows when it cancels/reschedules
-- future pending items; WS-6.2.2 (this card) only READS + DISPLAYS them. The
-- table is created here so the read path + page render against a real shape;
-- 6.2.4 should add the write repository, NOT recreate this table.
--
-- Security model:
--   * Learners can SELECT only their own revisions (RLS SELECT-own).
--   * Writes are server-authoritative through service_role.
--   * Bilingual summaries + JSONB snapshots; no answer keys or scores copied.
-- =============================================================================

begin;

create table if not exists public.ielts_study_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.ielts_study_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_version integer check (from_version is null or from_version > 0),
  to_version integer not null check (to_version > 0),
  trigger_type text not null check (length(btrim(trigger_type)) > 0),
  trigger_source_type text,
  trigger_source_id text,
  summary_en text not null check (length(btrim(summary_en)) > 0),
  summary_vi text not null check (length(btrim(summary_vi)) > 0),
  changed_item_count integer not null default 0 check (changed_item_count >= 0),
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (from_version is null or to_version >= from_version)
);

comment on table public.ielts_study_plan_revisions is
  'Append-only IELTS study-plan revision log. WS-6.2.4 writes one row per replan; the study-plan page reads them for the "what changed in your plan" section.';
comment on column public.ielts_study_plan_revisions.trigger_type is
  'Free-text replan trigger key owned by WS-6.2.4 (e.g. prediction_snapshot, band_change, goal_edit, adherence_drop).';
comment on column public.ielts_study_plan_revisions.changed_item_count is
  'Count of plan items cancelled/rescheduled/added by this revision.';

create index if not exists idx_ielts_study_plan_revisions_plan
  on public.ielts_study_plan_revisions(plan_id, created_at desc);
create index if not exists idx_ielts_study_plan_revisions_user
  on public.ielts_study_plan_revisions(user_id, created_at desc);

alter table public.ielts_study_plan_revisions enable row level security;

revoke all on public.ielts_study_plan_revisions from anon, authenticated;
grant select on public.ielts_study_plan_revisions to authenticated;
grant select, insert, update, delete on public.ielts_study_plan_revisions to service_role;

drop policy if exists "Users view own IELTS study plan revisions"
  on public.ielts_study_plan_revisions;
create policy "Users view own IELTS study plan revisions"
  on public.ielts_study_plan_revisions
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

commit;
