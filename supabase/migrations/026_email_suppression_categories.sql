-- Allow one-click unsubscribe to suppress a lifecycle category without blocking all email streams.

alter table public.email_suppressions
  add column if not exists category text check (
    category is null or category in (
      'onboarding',
      'practice',
      'streak',
      'progress',
      'achievement',
      'course',
      'system'
    )
  );

drop index if exists public.idx_email_suppressions_email_active;

create unique index if not exists idx_email_suppressions_email_category_active
  on public.email_suppressions(lower(email), coalesce(category, 'global'))
  where active;

create index if not exists idx_email_suppressions_email_category
  on public.email_suppressions(lower(email), category)
  where active;
