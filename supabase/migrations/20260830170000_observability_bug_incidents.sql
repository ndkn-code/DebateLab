-- Operational incident registry. This intentionally stores no raw alerts, stack traces,
-- user content, URLs, or other diagnostic payloads; Grafana and ClickUp own that data.
create table if not exists public.observability_bug_incidents (
  fingerprint text not null check (fingerprint ~ '^[A-Za-z0-9_.:-]{8,128}$'),
  service text not null check (char_length(service) between 1 and 100),
  environment text not null check (char_length(environment) between 1 and 40),
  clickup_task_id text,
  alert_status text not null check (alert_status in ('firing', 'resolved')),
  severity text not null check (severity in ('p0', 'p1', 'p2', 'p3')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  occurrence_count bigint not null default 1 check (occurrence_count > 0),
  affected_sessions bigint not null default 0 check (affected_sessions >= 0),
  creation_lease_token uuid,
  creation_lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fingerprint, service, environment)
);

create table if not exists public.observability_bug_deliveries (
  delivery_id text primary key check (delivery_id ~ '^[a-f0-9]{64}$'),
  fingerprint text not null,
  service text not null,
  environment text not null,
  applied boolean not null default false,
  previous_alert_status text check (previous_alert_status in ('firing', 'resolved')),
  lease_token uuid,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (fingerprint, service, environment)
    references public.observability_bug_incidents (fingerprint, service, environment)
    deferrable initially deferred
);

create index if not exists observability_bug_incidents_updated_idx
  on public.observability_bug_incidents (updated_at desc);

alter table public.observability_bug_incidents enable row level security;
alter table public.observability_bug_deliveries enable row level security;
revoke all on public.observability_bug_incidents from anon, authenticated;
revoke all on public.observability_bug_deliveries from anon, authenticated;
grant all on public.observability_bug_incidents to service_role;
grant all on public.observability_bug_deliveries to service_role;

create or replace function public.claim_observability_bug_incident(
  p_delivery_id text,
  p_fingerprint text,
  p_service text,
  p_environment text,
  p_alert_status text,
  p_severity text,
  p_first_seen_at timestamptz,
  p_last_seen_at timestamptz,
  p_occurrence_count bigint,
  p_affected_sessions bigint
)
returns table (
  action text,
  lease_token uuid,
  clickup_task_id text,
  previous_alert_status text,
  effective_severity text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_incident public.observability_bug_incidents%rowtype;
  v_delivery public.observability_bug_deliveries%rowtype;
  v_previous_status text;
  v_lease uuid := gen_random_uuid();
begin
  if p_alert_status not in ('firing', 'resolved')
     or p_severity not in ('p0', 'p1', 'p2', 'p3')
     or p_occurrence_count < 1
     or p_affected_sessions < 0 then
    raise exception 'Invalid observability incident claim';
  end if;

  insert into public.observability_bug_incidents (
    fingerprint, service, environment, alert_status, severity,
    first_seen_at, last_seen_at, occurrence_count, affected_sessions
  ) values (
    p_fingerprint, p_service, p_environment, p_alert_status, p_severity,
    p_first_seen_at, p_last_seen_at, p_occurrence_count, p_affected_sessions
  )
  on conflict (fingerprint, service, environment) do nothing;

  insert into public.observability_bug_deliveries (
    delivery_id, fingerprint, service, environment
  ) values (
    p_delivery_id, p_fingerprint, p_service, p_environment
  )
  on conflict (delivery_id) do nothing;

  select * into v_delivery
  from public.observability_bug_deliveries d
  where d.delivery_id = p_delivery_id
  for update;

  if v_delivery.fingerprint <> p_fingerprint
     or v_delivery.service <> p_service
     or v_delivery.environment <> p_environment then
    raise exception 'Delivery identity mismatch';
  end if;
  if v_delivery.completed_at is not null
     or (v_delivery.lease_expires_at is not null and v_delivery.lease_expires_at > now()) then
    return query select 'noop'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select * into v_incident
  from public.observability_bug_incidents i
  where i.fingerprint = p_fingerprint
    and i.service = p_service
    and i.environment = p_environment
  for update;
  v_previous_status := v_incident.alert_status;

  if not v_delivery.applied then
    update public.observability_bug_deliveries d
    set previous_alert_status = v_previous_status, applied = true
    where d.delivery_id = p_delivery_id;
    update public.observability_bug_incidents i set
      alert_status = p_alert_status,
      severity = case
        when array_position(array['p0','p1','p2','p3'], p_severity)
           < array_position(array['p0','p1','p2','p3'], i.severity) then p_severity
        else i.severity
      end,
      first_seen_at = least(i.first_seen_at, p_first_seen_at),
      last_seen_at = greatest(i.last_seen_at, p_last_seen_at),
      occurrence_count = greatest(i.occurrence_count, p_occurrence_count),
      affected_sessions = greatest(i.affected_sessions, p_affected_sessions),
      updated_at = now()
    where i.fingerprint = p_fingerprint
      and i.service = p_service
      and i.environment = p_environment;
  end if;

  select * into v_incident
  from public.observability_bug_incidents i
  where i.fingerprint = p_fingerprint
    and i.service = p_service
    and i.environment = p_environment;

  if v_incident.clickup_task_id is null then
    update public.observability_bug_incidents i set
      creation_lease_token = v_lease,
      creation_lease_expires_at = now() + interval '2 minutes'
    where i.fingerprint = p_fingerprint
      and i.service = p_service
      and i.environment = p_environment
      and (i.creation_lease_expires_at is null or i.creation_lease_expires_at <= now());
    if found then
      update public.observability_bug_deliveries d set
        lease_token = v_lease, lease_expires_at = now() + interval '2 minutes'
      where d.delivery_id = p_delivery_id;
      return query select 'create'::text, v_lease, null::text,
        coalesce(v_delivery.previous_alert_status, v_previous_status), v_incident.severity;
    else
      -- Another delivery owns creation. Retry after its lease so this update is not lost.
      return query select 'defer'::text, null::uuid, null::text,
        coalesce(v_delivery.previous_alert_status, v_previous_status), v_incident.severity;
    end if;
  else
    update public.observability_bug_deliveries d set
      lease_token = v_lease, lease_expires_at = now() + interval '2 minutes'
    where d.delivery_id = p_delivery_id;
    return query select 'update'::text, v_lease, v_incident.clickup_task_id,
      coalesce(v_delivery.previous_alert_status, v_previous_status), v_incident.severity;
  end if;
end;
$$;

create or replace function public.register_observability_bug_clickup_task(
  p_delivery_id text,
  p_fingerprint text,
  p_service text,
  p_environment text,
  p_lease_token uuid,
  p_clickup_task_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.observability_bug_incidents i set
    clickup_task_id = p_clickup_task_id,
    creation_lease_token = null,
    creation_lease_expires_at = null,
    updated_at = now()
  where i.fingerprint = p_fingerprint
    and i.service = p_service
    and i.environment = p_environment
    and i.creation_lease_token = p_lease_token;
  if not found then
    raise exception 'Incident creation lease mismatch';
  end if;

  update public.observability_bug_deliveries d set
    completed_at = now(), lease_token = null, lease_expires_at = null
  where d.delivery_id = p_delivery_id and d.lease_token = p_lease_token;
  if not found then
    raise exception 'Delivery lease mismatch';
  end if;
end;
$$;

create or replace function public.complete_observability_bug_delivery(
  p_delivery_id text,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.observability_bug_deliveries d set
    completed_at = now(), lease_token = null, lease_expires_at = null
  where d.delivery_id = p_delivery_id and d.lease_token = p_lease_token;
  if not found then
    raise exception 'Delivery lease mismatch';
  end if;
end;
$$;

revoke all on function public.claim_observability_bug_incident(text,text,text,text,text,text,timestamptz,timestamptz,bigint,bigint) from public, anon, authenticated;
revoke all on function public.register_observability_bug_clickup_task(text,text,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.complete_observability_bug_delivery(text,uuid) from public, anon, authenticated;
grant execute on function public.claim_observability_bug_incident(text,text,text,text,text,text,timestamptz,timestamptz,bigint,bigint) to service_role;
grant execute on function public.register_observability_bug_clickup_task(text,text,text,text,uuid,text) to service_role;
grant execute on function public.complete_observability_bug_delivery(text,uuid) to service_role;
