-- Campaign approval, immutable audience snapshots, and recipient-level retry state.

begin;

alter table public.email_campaigns
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists audience_snapshot_count integer not null default 0 check (audience_snapshot_count >= 0),
  add column if not exists completed_at timestamptz,
  add column if not exists last_error text;

alter table public.email_campaigns drop constraint if exists email_campaigns_status_check;
alter table public.email_campaigns
  add constraint email_campaigns_status_check check (
    status in ('draft', 'approved', 'scheduled', 'sending', 'paused', 'sent', 'failed', 'canceled')
  );

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  display_name text,
  locale text not null check (locale in ('en', 'vi')),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'delivered', 'failed', 'suppressed', 'canceled')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  send_key text not null,
  available_at timestamptz not null default now(),
  last_error text,
  email_message_id uuid references public.email_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id),
  unique (send_key)
);

create index if not exists email_campaign_recipients_claim_idx
  on public.email_campaign_recipients(campaign_id, status, available_at, created_at);

drop trigger if exists email_campaign_recipients_touch_updated_at on public.email_campaign_recipients;
create trigger email_campaign_recipients_touch_updated_at
before update on public.email_campaign_recipients
for each row execute function private.touch_notification_updated_at();

alter table public.email_campaign_recipients enable row level security;
drop policy if exists "Admins manage email campaign recipients" on public.email_campaign_recipients;
create policy "Admins manage email campaign recipients"
  on public.email_campaign_recipients for all to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

revoke all on table public.email_campaign_recipients from anon;
grant select, insert, update, delete on table public.email_campaign_recipients to authenticated;
grant all on table public.email_campaign_recipients to service_role;

commit;
