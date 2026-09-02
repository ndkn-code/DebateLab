-- Reassert the learner study-plan read boundary after the LMS access migrations.
-- Study plans are private learner state. Platform admins retain the existing
-- operational read path; organization managers do not gain one implicitly.
begin;

alter table public.ielts_study_plans enable row level security;
alter table public.ielts_study_plan_items enable row level security;
alter table public.ielts_study_plan_revisions enable row level security;

revoke all on table public.ielts_study_plans,
  public.ielts_study_plan_items,
  public.ielts_study_plan_revisions
from anon, authenticated;
grant select on table public.ielts_study_plans,
  public.ielts_study_plan_items,
  public.ielts_study_plan_revisions
to authenticated;

-- Keep the platform-admin operational exception from the original schema.
drop policy if exists "Users view own IELTS study plans" on public.ielts_study_plans;
create policy "Users view own IELTS study plans"
  on public.ielts_study_plans
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users view own IELTS study plan items" on public.ielts_study_plan_items;
create policy "Users view own IELTS study plan items"
  on public.ielts_study_plan_items
  for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users view own IELTS study plan revisions"
  on public.ielts_study_plan_revisions;
create policy "Users view own IELTS study plan revisions"
  on public.ielts_study_plan_revisions
  for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

commit;
