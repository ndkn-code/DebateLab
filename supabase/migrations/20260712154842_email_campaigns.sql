-- Thin campaign orchestration over the existing email_messages send/tracking layer.

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  template_key text not null,
  subject text,
  body jsonb not null default '{}'::jsonb,
  variables jsonb not null default '{}'::jsonb,
  locale text not null default 'en' check (locale in ('en', 'vi')),
  audience jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'canceled')),
  scheduled_for timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  sent_count integer not null default 0 check (sent_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_campaigns_schedule_state check (
    (status = 'scheduled' and scheduled_for is not null)
    or status <> 'scheduled'
  )
);

create index idx_email_campaigns_created_at
  on public.email_campaigns(created_at desc);

create index idx_email_campaigns_created_by
  on public.email_campaigns(created_by)
  where created_by is not null;

create index idx_email_campaigns_due
  on public.email_campaigns(scheduled_for)
  where status in ('scheduled', 'sending');

-- Campaign linkage intentionally lives in metadata so the established hot
-- email_messages table and Resend webhook pipeline remain unchanged.
create index idx_email_messages_campaign_id
  on public.email_messages ((metadata ->> 'campaignId'))
  where metadata ? 'campaignId';

alter table public.email_campaigns enable row level security;

create policy "Admins can view email campaigns"
  on public.email_campaigns for select
  to authenticated
  using ((select private.is_admin((select auth.uid()))));

create policy "Admins can create email campaigns"
  on public.email_campaigns for insert
  to authenticated
  with check ((select private.is_admin((select auth.uid()))));

create policy "Admins can update email campaigns"
  on public.email_campaigns for update
  to authenticated
  using ((select private.is_admin((select auth.uid()))))
  with check ((select private.is_admin((select auth.uid()))));

create policy "Admins can delete email campaigns"
  on public.email_campaigns for delete
  to authenticated
  using ((select private.is_admin((select auth.uid()))));

revoke all on table public.email_campaigns from anon;
grant select, insert, update, delete on table public.email_campaigns to authenticated;
grant all on table public.email_campaigns to service_role;
