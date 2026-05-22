-- Support issue reports submitted through the embedded Tally form.

create table if not exists public.support_issue_reports (
  id uuid primary key default gen_random_uuid(),
  tally_event_id text not null,
  tally_response_id text,
  tally_submission_id text,
  tally_form_id text,
  tally_form_name text,
  user_id uuid references public.profiles(id) on delete set null,
  user_email text,
  locale text,
  route text,
  source text not null default 'tally',
  issue_type text,
  severity text,
  title text,
  description text,
  expected_behavior text,
  steps_to_reproduce text,
  contact_permission text,
  attachments jsonb not null default '[]'::jsonb,
  environment jsonb not null default '{}'::jsonb,
  hidden_fields jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (
    status in ('new', 'triaged', 'in_progress', 'resolved', 'closed')
  ),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_support_issue_reports_tally_event_id
  on public.support_issue_reports(tally_event_id);

create unique index if not exists idx_support_issue_reports_tally_response_id
  on public.support_issue_reports(tally_response_id)
  where tally_response_id is not null;

create index if not exists idx_support_issue_reports_status_submitted
  on public.support_issue_reports(status, submitted_at desc);

create index if not exists idx_support_issue_reports_user_submitted
  on public.support_issue_reports(user_id, submitted_at desc)
  where user_id is not null;

create index if not exists idx_support_issue_reports_created
  on public.support_issue_reports(created_at desc);

alter table public.support_issue_reports enable row level security;

drop policy if exists "Admins can view support issue reports" on public.support_issue_reports;
create policy "Admins can view support issue reports"
  on public.support_issue_reports for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can update support issue reports" on public.support_issue_reports;
create policy "Admins can update support issue reports"
  on public.support_issue_reports for update
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

revoke all on public.support_issue_reports from anon;
revoke all on public.support_issue_reports from authenticated;
grant select, update on public.support_issue_reports to authenticated;
grant all on public.support_issue_reports to service_role;
