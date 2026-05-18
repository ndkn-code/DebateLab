-- Harden indexes for feedback popup foreign keys surfaced by Supabase advisors.

create index if not exists idx_smart_popup_campaigns_created_by
  on public.smart_popup_campaigns(created_by)
  where created_by is not null;

create index if not exists idx_smart_popup_campaigns_published_by
  on public.smart_popup_campaigns(published_by)
  where published_by is not null;

create index if not exists idx_smart_popup_campaigns_updated_by
  on public.smart_popup_campaigns(updated_by)
  where updated_by is not null;

create index if not exists idx_smart_popup_survey_versions_created_by
  on public.smart_popup_survey_versions(created_by)
  where created_by is not null;

create index if not exists idx_smart_popup_survey_responses_survey_version
  on public.smart_popup_survey_responses(survey_version_id);
