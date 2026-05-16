-- Admin-managed live copy overrides for app-owned Thinkfy email templates.

create table if not exists public.email_template_overrides (
  id uuid primary key default gen_random_uuid(),
  template_key text not null check (
    template_key in (
      'welcome',
      'onboarding_nudge',
      'practice_reminder',
      'streak_rescue',
      'winback',
      'weekly_progress',
      'achievement',
      'course_nudge'
    )
  ),
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  fields jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_key, locale)
);

create index if not exists idx_email_template_overrides_active
  on public.email_template_overrides(template_key, locale)
  where is_active;

create index if not exists idx_email_template_overrides_updated
  on public.email_template_overrides(updated_at desc);

create table if not exists public.email_template_override_events (
  id uuid primary key default gen_random_uuid(),
  template_override_id uuid references public.email_template_overrides(id) on delete set null,
  template_key text not null check (
    template_key in (
      'welcome',
      'onboarding_nudge',
      'practice_reminder',
      'streak_rescue',
      'winback',
      'weekly_progress',
      'achievement',
      'course_nudge'
    )
  ),
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  action text not null check (action in ('save', 'reset')),
  fields jsonb not null default '{}'::jsonb,
  previous_fields jsonb,
  version integer not null,
  actor_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_template_override_events_template
  on public.email_template_override_events(template_key, locale, created_at desc);

create index if not exists idx_email_template_override_events_created
  on public.email_template_override_events(created_at desc);

alter table public.email_template_overrides enable row level security;
alter table public.email_template_override_events enable row level security;

drop policy if exists "Admins can view email template overrides" on public.email_template_overrides;
create policy "Admins can view email template overrides"
  on public.email_template_overrides for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can insert email template overrides" on public.email_template_overrides;
create policy "Admins can insert email template overrides"
  on public.email_template_overrides for insert
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can update email template overrides" on public.email_template_overrides;
create policy "Admins can update email template overrides"
  on public.email_template_overrides for update
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view email template override events" on public.email_template_override_events;
create policy "Admins can view email template override events"
  on public.email_template_override_events for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can insert email template override events" on public.email_template_override_events;
create policy "Admins can insert email template override events"
  on public.email_template_override_events for insert
  with check (private.is_admin(auth.uid()));

grant select, insert, update on public.email_template_overrides to authenticated;
grant select, insert on public.email_template_override_events to authenticated;
grant all on public.email_template_overrides to service_role;
grant all on public.email_template_override_events to service_role;
