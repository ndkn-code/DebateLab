-- Thinkfy user email delivery, auditing, and Resend webhook state.

create schema if not exists private;

create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'
  );
$$;

grant execute on function private.is_admin(uuid) to authenticated;

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  to_email text not null,
  from_email text not null,
  reply_to text[] not null default '{}'::text[],
  template_key text not null,
  category text not null check (
    category in ('onboarding', 'practice', 'streak', 'progress', 'achievement', 'course', 'system')
  ),
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  subject text not null,
  status text not null default 'queued' check (
    status in (
      'queued',
      'skipped',
      'sent',
      'scheduled',
      'delivered',
      'opened',
      'clicked',
      'bounced',
      'complained',
      'failed',
      'suppressed'
    )
  ),
  send_key text not null,
  resend_email_id text,
  variables jsonb not null default '{}'::jsonb,
  tags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  skip_reason text,
  error_message text,
  last_provider_event text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  failed_at timestamptz,
  suppressed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_email_messages_send_key
  on public.email_messages(send_key);

create unique index if not exists idx_email_messages_resend_email_id
  on public.email_messages(resend_email_id)
  where resend_email_id is not null;

create index if not exists idx_email_messages_created
  on public.email_messages(created_at desc);

create index if not exists idx_email_messages_user_created
  on public.email_messages(user_id, created_at desc);

create index if not exists idx_email_messages_template_created
  on public.email_messages(template_key, created_at desc);

create table if not exists public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null,
  event_type text not null,
  resend_email_id text,
  email_message_id uuid references public.email_messages(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_email_webhook_events_svix_id
  on public.email_webhook_events(svix_id);

create index if not exists idx_email_webhook_events_received
  on public.email_webhook_events(received_at desc);

create index if not exists idx_email_webhook_events_resend_email_id
  on public.email_webhook_events(resend_email_id);

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (
    reason in ('bounce', 'complaint', 'unsubscribe', 'manual', 'provider_suppressed')
  ),
  source text not null default 'system',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_email_suppressions_email_active
  on public.email_suppressions(lower(email))
  where active;

create index if not exists idx_email_suppressions_created
  on public.email_suppressions(created_at desc);

create table if not exists public.email_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null default 'email-dispatch',
  status text not null check (status in ('started', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  candidate_users integer not null default 0,
  queued_count integer not null default 0,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_cron_runs_started
  on public.email_cron_runs(job_key, started_at desc);

alter table public.email_messages enable row level security;
alter table public.email_webhook_events enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_cron_runs enable row level security;

drop policy if exists "Admins can view email messages" on public.email_messages;
create policy "Admins can view email messages"
  on public.email_messages for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view email webhook events" on public.email_webhook_events;
create policy "Admins can view email webhook events"
  on public.email_webhook_events for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view email suppressions" on public.email_suppressions;
create policy "Admins can view email suppressions"
  on public.email_suppressions for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view email cron runs" on public.email_cron_runs;
create policy "Admins can view email cron runs"
  on public.email_cron_runs for select
  using (private.is_admin(auth.uid()));

grant select on public.email_messages to authenticated;
grant select on public.email_webhook_events to authenticated;
grant select on public.email_suppressions to authenticated;
grant select on public.email_cron_runs to authenticated;
grant all on public.email_messages to service_role;
grant all on public.email_webhook_events to service_role;
grant all on public.email_suppressions to service_role;
grant all on public.email_cron_runs to service_role;
