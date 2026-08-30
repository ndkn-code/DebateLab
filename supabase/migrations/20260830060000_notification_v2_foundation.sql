-- Notification v2 foundation.
-- Additive only: canonical events/inbox/delivery jobs coexist with the legacy
-- LMS outbox and notification tables until their consumers are migrated.

begin;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (length(btrim(event_type)) between 1 and 120),
  source text not null default 'app' check (length(btrim(source)) between 1 and 80),
  actor_id uuid references public.profiles(id) on delete set null,
  subject_type text,
  subject_id text,
  title text not null check (length(btrim(title)) between 1 and 500),
  body text not null check (length(btrim(body)) between 1 and 20_000),
  message_class text not null default 'operational' check (message_class in ('transactional', 'operational', 'lifecycle', 'marketing')),
  topic text,
  payload jsonb not null default '{}'::jsonb,
  importance text not null default 'normal' check (importance in ('low', 'normal', 'high', 'critical')),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_inbox_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'unread' check (state in ('unread', 'read', 'archived')),
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, recipient_id)
);

create table if not exists public.notification_user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  digest_frequency text not null default 'none' check (digest_frequency in ('none', 'daily', 'weekly')),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (length(btrim(event_type)) between 1 and 120),
  channel text not null check (channel in ('in_app', 'email', 'push')),
  enabled boolean not null default true,
  frequency text not null default 'immediate' check (frequency in ('immediate', 'digest')),
  updated_at timestamptz not null default now(),
  unique (user_id, event_type, channel)
);

create table if not exists public.notification_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (length(btrim(subject_type)) between 1 and 120),
  subject_id text not null check (length(btrim(subject_id)) between 1 and 500),
  channel text not null default 'all' check (channel in ('all', 'in_app', 'email', 'push')),
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subject_type, subject_id, channel)
);

create table if not exists public.notification_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  inbox_item_id uuid not null references public.notification_inbox_items(id) on delete cascade,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 100),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, recipient_id, channel)
);

create or replace function private.touch_notification_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function private.touch_notification_updated_at();
drop trigger if exists notification_user_settings_touch_updated_at on public.notification_user_settings;
create trigger notification_user_settings_touch_updated_at
before update on public.notification_user_settings
for each row execute function private.touch_notification_updated_at();
drop trigger if exists notification_mutes_touch_updated_at on public.notification_mutes;
create trigger notification_mutes_touch_updated_at
before update on public.notification_mutes
for each row execute function private.touch_notification_updated_at();
drop trigger if exists notification_delivery_jobs_touch_updated_at on public.notification_delivery_jobs;
create trigger notification_delivery_jobs_touch_updated_at
before update on public.notification_delivery_jobs
for each row execute function private.touch_notification_updated_at();

create index if not exists notification_events_created_idx
  on public.notification_events(created_at desc);
create index if not exists notification_events_subject_idx
  on public.notification_events(subject_type, subject_id, created_at desc);
create index if not exists notification_inbox_recipient_idx
  on public.notification_inbox_items(recipient_id, created_at desc);
create index if not exists notification_inbox_unread_idx
  on public.notification_inbox_items(recipient_id, created_at desc)
  where state = 'unread';
create index if not exists notification_mutes_lookup_idx
  on public.notification_mutes(user_id, subject_type, subject_id, channel);
create index if not exists notification_delivery_claim_idx
  on public.notification_delivery_jobs(status, available_at, created_at);
create index if not exists notification_delivery_lease_idx
  on public.notification_delivery_jobs(lease_expires_at)
  where status = 'processing';

-- Additive compatibility fields for the existing email audit stream.
alter table public.email_messages
  add column if not exists notification_event_id uuid references public.notification_events(id) on delete set null,
  add column if not exists message_class text,
  add column if not exists sender_stream text,
  add column if not exists delayed_at timestamptz,
  add column if not exists last_provider_event_at timestamptz;

alter table public.email_messages drop constraint if exists email_messages_status_check;
alter table public.email_messages
  add constraint email_messages_status_check check (status in (
    'queued', 'skipped', 'sent', 'scheduled', 'delayed', 'delivered', 'opened',
    'clicked', 'bounced', 'complained', 'failed', 'suppressed'
  ));
alter table public.email_messages drop constraint if exists email_messages_message_class_check;
alter table public.email_messages
  add constraint email_messages_message_class_check check (
    message_class is null or message_class in ('transactional', 'operational', 'lifecycle', 'marketing')
  );
alter table public.email_messages drop constraint if exists email_messages_sender_stream_check;
alter table public.email_messages
  add constraint email_messages_sender_stream_check check (
    sender_stream is null or sender_stream in ('notifications', 'updates')
  );
create index if not exists email_messages_notification_event_idx
  on public.email_messages(notification_event_id)
  where notification_event_id is not null;

create or replace function private.notification_channel_enabled(
  p_user_id uuid,
  p_event_type text,
  p_channel text,
  p_subject_type text default null,
  p_subject_id text default null,
  p_message_class text default 'operational'
) returns boolean
language sql stable security definer set search_path = public, private as $$
  select not exists (
    select 1 from public.notification_mutes m
    where m.user_id = p_user_id
      and p_subject_type is not null and p_subject_id is not null
      and m.subject_type = p_subject_type and m.subject_id = p_subject_id
      and m.channel in ('all', p_channel)
      and (m.muted_until is null or m.muted_until > now())
  ) and case p_channel
    when 'in_app' then
      coalesce((select s.in_app_enabled from public.notification_user_settings s where s.user_id = p_user_id), true)
      and coalesce((select np.enabled from public.notification_preferences np where np.user_id = p_user_id and np.event_type = p_event_type and np.channel = p_channel), true)
    when 'email' then
      p_message_class = 'transactional' or (
        coalesce((select s.email_enabled from public.notification_user_settings s where s.user_id = p_user_id), false)
        and coalesce((select np.enabled from public.notification_preferences np where np.user_id = p_user_id and np.event_type = p_event_type and np.channel = p_channel), true)
      )
    when 'push' then
      coalesce((select s.push_enabled from public.notification_user_settings s where s.user_id = p_user_id), false)
      and coalesce((select np.enabled from public.notification_preferences np where np.user_id = p_user_id and np.event_type = p_event_type and np.channel = p_channel), true)
    else false
  end;
$$;

create or replace function private.notification_delivery_available_at(
  p_user_id uuid,
  p_event_type text,
  p_channel text,
  p_importance text
) returns timestamptz
language plpgsql stable security definer set search_path = public, private as $$
declare
  v_settings public.notification_user_settings%rowtype;
  v_frequency text;
  v_timezone text := 'Asia/Ho_Chi_Minh';
  v_local_now timestamp;
  v_target timestamp;
  v_local_time time;
begin
  if p_channel = 'in_app' or p_importance = 'critical' then return now(); end if;

  select * into v_settings from public.notification_user_settings where user_id = p_user_id;
  if found then v_timezone := v_settings.timezone; end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'Asia/Ho_Chi_Minh';
  end if;
  select frequency into v_frequency from public.notification_preferences
  where user_id = p_user_id and event_type = p_event_type and channel = p_channel;
  v_local_now := now() at time zone v_timezone;

  if v_frequency = 'digest' or coalesce(v_settings.digest_frequency, 'none') <> 'none' then
    if coalesce(v_settings.digest_frequency, 'daily') = 'weekly' then
      v_target := date_trunc('week', v_local_now) + interval '1 week 8 hours';
    else
      v_target := date_trunc('day', v_local_now) + interval '8 hours';
      if v_target <= v_local_now then v_target := v_target + interval '1 day'; end if;
    end if;
    return v_target at time zone v_timezone;
  end if;

  if v_settings.quiet_hours_start is not null and v_settings.quiet_hours_end is not null then
    v_local_time := v_local_now::time;
    if v_settings.quiet_hours_start < v_settings.quiet_hours_end
       and v_local_time >= v_settings.quiet_hours_start
       and v_local_time < v_settings.quiet_hours_end then
      v_target := v_local_now::date + v_settings.quiet_hours_end;
      return v_target at time zone v_timezone;
    elsif v_settings.quiet_hours_start > v_settings.quiet_hours_end
       and (v_local_time >= v_settings.quiet_hours_start or v_local_time < v_settings.quiet_hours_end) then
      v_target := v_local_now::date + v_settings.quiet_hours_end;
      if v_local_time >= v_settings.quiet_hours_start then v_target := v_target + interval '1 day'; end if;
      return v_target at time zone v_timezone;
    end if;
  end if;
  return now();
end;
$$;

-- Snapshot legacy profile consent into explicit settings/preferences. Invalid or
-- absent legacy values are treated as opt-out for optional email, never consent.
with profile_consent as (
  select
    p.id,
    case when jsonb_typeof(p.preferences -> 'email_notifications') = 'boolean'
      then (p.preferences ->> 'email_notifications')::boolean else false end as email_enabled
  from public.profiles p
)
insert into public.notification_user_settings(
  user_id, in_app_enabled, email_enabled, push_enabled, digest_frequency, timezone
)
select id, true, email_enabled, false, 'none', 'Asia/Ho_Chi_Minh'
from profile_consent
on conflict (user_id) do nothing;

with profile_consent as (
  select
    p.id,
    case when jsonb_typeof(p.preferences -> 'email_notifications') = 'boolean'
      then (p.preferences ->> 'email_notifications')::boolean else false end as email_enabled,
    case when p.preferences ->> 'email_opt_in_scope' in ('all', 'reminders_only')
      then p.preferences ->> 'email_opt_in_scope' else 'all' end as email_scope,
    case when jsonb_typeof(p.preferences -> 'practice_reminders') = 'boolean'
      then (p.preferences ->> 'practice_reminders')::boolean else true end as practice_enabled,
    case when jsonb_typeof(p.preferences -> 'streak_reminders') = 'boolean'
      then (p.preferences ->> 'streak_reminders')::boolean else true end as streak_enabled,
    case when jsonb_typeof(p.preferences -> 'achievement_updates') = 'boolean'
      then (p.preferences ->> 'achievement_updates')::boolean else true end as achievement_enabled
  from public.profiles p
), legacy_event_types(event_type) as (
  values ('welcome'), ('onboarding_nudge'), ('practice_reminder'),
    ('streak_rescue'), ('winback'), ('weekly_progress'), ('achievement'),
    ('course_nudge'), ('club_invitation')
)
insert into public.notification_preferences(user_id, event_type, channel, enabled, frequency)
select c.id, e.event_type, channels.channel,
  case channels.channel
    when 'in_app' then true
    when 'push' then false
    when 'email' then c.email_enabled
      and (c.email_scope <> 'reminders_only' or e.event_type in ('practice_reminder', 'streak_rescue', 'course_nudge'))
      and case
        when e.event_type in ('practice_reminder', 'winback', 'course_nudge') then c.practice_enabled
        when e.event_type = 'streak_rescue' then c.streak_enabled
        when e.event_type in ('weekly_progress', 'achievement') then c.achievement_enabled
        else true
      end
  end,
  'immediate'
from profile_consent c
cross join legacy_event_types e
cross join (values ('in_app'), ('email'), ('push')) as channels(channel)
on conflict (user_id, event_type, channel) do nothing;

create or replace function public.enqueue_notification_event(
  p_event_key text,
  p_event_type text,
  p_title text,
  p_body text,
  p_recipient_ids uuid[],
  p_payload jsonb default '{}'::jsonb,
  p_importance text default 'normal',
  p_source text default 'app',
  p_actor_id uuid default null,
  p_subject_type text default null,
  p_subject_id text default null,
  p_enqueue_delivery_jobs boolean default true,
  p_message_class text default 'operational',
  p_topic text default null
) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  v_event_id uuid;
  v_inbox_id uuid;
  v_recipient uuid;
  v_channel text;
begin
  if nullif(btrim(p_event_key), '') is null or nullif(btrim(p_event_type), '') is null
    or nullif(btrim(p_title), '') is null or nullif(btrim(p_body), '') is null then
    raise exception 'NOTIFICATION_EVENT_REQUIRED_FIELDS';
  end if;

  insert into public.notification_events(
    event_key, event_type, source, actor_id, subject_type, subject_id,
    title, body, message_class, topic, payload, importance
  ) values (
    p_event_key, p_event_type, coalesce(nullif(btrim(p_source), ''), 'app'),
    p_actor_id, p_subject_type, p_subject_id, p_title, p_body,
    coalesce(p_message_class, 'operational'), p_topic,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_importance, 'normal')
  ) on conflict (event_key) do nothing returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.notification_events where event_key = p_event_key;
  end if;

  foreach v_recipient in array coalesce(p_recipient_ids, '{}'::uuid[]) loop
    v_inbox_id := null;
    insert into public.notification_inbox_items(event_id, recipient_id, state, archived_at)
    values (
      v_event_id,
      v_recipient,
      case when private.notification_channel_enabled(
        v_recipient, p_event_type, 'in_app', p_subject_type, p_subject_id, p_message_class
      ) then 'unread' else 'archived' end,
      case when private.notification_channel_enabled(
        v_recipient, p_event_type, 'in_app', p_subject_type, p_subject_id, p_message_class
      ) then null else now() end
    )
    on conflict (event_id, recipient_id) do nothing
    returning id into v_inbox_id;

    if v_inbox_id is null then
      select id into v_inbox_id from public.notification_inbox_items
      where event_id = v_event_id and recipient_id = v_recipient;
    end if;

    if p_enqueue_delivery_jobs then
      foreach v_channel in array array['in_app', 'email', 'push'] loop
        if private.notification_channel_enabled(
          v_recipient, p_event_type, v_channel, p_subject_type, p_subject_id, p_message_class
        ) then
          insert into public.notification_delivery_jobs(
            inbox_item_id, event_id, recipient_id, channel, idempotency_key, payload, available_at
          ) values (
            v_inbox_id, v_event_id, v_recipient, v_channel,
            'notification:' || v_event_id::text || ':' || v_recipient::text || ':' || v_channel,
            coalesce(p_payload, '{}'::jsonb),
            private.notification_delivery_available_at(v_recipient, p_event_type, v_channel, p_importance)
          ) on conflict (event_id, recipient_id, channel) do nothing;
        end if;
      end loop;
    end if;
  end loop;
  return v_event_id;
end;
$$;

-- Backfill legacy LMS inbox rows as one canonical event per legacy dedupe key.
insert into public.notification_events(event_key, event_type, source, title, body, payload, created_at)
select 'legacy:lms:' || n.dedupe_key,
       n.event_type,
       'legacy_lms',
       n.title,
       n.body,
       jsonb_build_object('legacyNotificationId', min(n.id::text)::uuid, 'legacyDedupeKey', n.dedupe_key),
       min(n.created_at)
from public.lms_notifications n
group by n.dedupe_key, n.event_type, n.title, n.body
on conflict (event_key) do nothing;

insert into public.notification_inbox_items(event_id, recipient_id, state, read_at, created_at)
select e.id,
       n.recipient_id,
       case when n.read_at is null then 'unread' else 'read' end,
       n.read_at,
       n.created_at
from public.lms_notifications n
join public.notification_events e on e.event_key = 'legacy:lms:' || n.dedupe_key
on conflict (event_id, recipient_id) do nothing;

-- Future LMS materialization is dual-written to v2, but does not enqueue a
-- delivery job: the existing LMS/email outbox worker remains authoritative
-- until its consumer is switched to notification_delivery_jobs.
create or replace function private.sync_lms_notification_to_notification_v2()
returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  perform public.enqueue_notification_event(
    'legacy:lms:' || new.dedupe_key,
    new.event_type,
    new.title,
    new.body,
    array[new.recipient_id],
    jsonb_build_object('legacyNotificationId', new.id, 'legacyDedupeKey', new.dedupe_key),
    'normal',
    'legacy_lms',
    null,
    'lms_notification',
    new.id::text,
    false,
    'operational',
    'lms_notification'
  );
  return new;
end;
$$;
drop trigger if exists lms_notification_v2_dual_write on public.lms_notifications;
create trigger lms_notification_v2_dual_write
after insert on public.lms_notifications
for each row execute function private.sync_lms_notification_to_notification_v2();

create or replace function public.reclaim_notification_delivery_jobs(
  p_limit integer default 100,
  p_max_attempts integer default 5
) returns integer
language plpgsql security definer set search_path = public, private as $$
declare v_count integer;
begin
  with expired as (
    select id from public.notification_delivery_jobs
    where status = 'processing' and lease_expires_at < now()
    order by lease_expires_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  update public.notification_delivery_jobs j
      set status = case when j.attempts >= greatest(1, coalesce(j.max_attempts, p_max_attempts, 5)) then 'dead_letter' else 'failed' end,
      available_at = case when j.attempts >= greatest(1, coalesce(j.max_attempts, p_max_attempts, 5)) then j.available_at else now() end,
      locked_at = null,
      lease_token = null, lease_expires_at = null,
      last_error = coalesce(j.last_error, 'delivery lease expired'), updated_at = now()
  from expired e where j.id = e.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_notification_delivery_job(
  p_job_id uuid,
  p_lease_seconds integer default 300
) returns public.notification_delivery_jobs
language plpgsql security definer set search_path = public, private as $$
declare v_job public.notification_delivery_jobs;
begin
  perform public.reclaim_notification_delivery_jobs(1, 5);
  update public.notification_delivery_jobs j
  set status = 'processing', attempts = j.attempts + 1,
      locked_at = now(), lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600))),
      updated_at = now()
  where j.id = p_job_id and j.status in ('pending', 'failed')
    and j.attempts < j.max_attempts and j.available_at <= now()
  returning j.* into v_job;
  if v_job.id is null then raise exception 'NOTIFICATION_DELIVERY_JOB_NOT_CLAIMABLE'; end if;
  return v_job;
end;
$$;

create or replace function public.claim_notification_delivery_jobs(
  p_limit integer default 50,
  p_lease_seconds integer default 300
) returns setof public.notification_delivery_jobs
language plpgsql security definer set search_path = public, private as $$
begin
  perform public.reclaim_notification_delivery_jobs(greatest(1, least(coalesce(p_limit, 50), 100)), 5);
  return query
  with candidates as (
    select id from public.notification_delivery_jobs
    where status in ('pending', 'failed') and attempts < max_attempts and available_at <= now()
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.notification_delivery_jobs j
  set status = 'processing', attempts = j.attempts + 1,
      locked_at = now(),
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600))),
      updated_at = now()
  from candidates c where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.complete_notification_delivery_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_error text default null,
  p_provider_message_id text default null
) returns public.notification_delivery_jobs
language plpgsql security definer set search_path = public, private as $$
declare v_job public.notification_delivery_jobs;
begin
  update public.notification_delivery_jobs j
  set status = case when p_success then 'completed' else case when j.attempts >= j.max_attempts then 'dead_letter' else 'failed' end end,
      provider_message_id = coalesce(nullif(btrim(p_provider_message_id), ''), j.provider_message_id),
      last_error = case when p_success then null else nullif(btrim(p_error), '') end,
      available_at = case when p_success or j.attempts >= j.max_attempts then j.available_at else now() + make_interval(secs => least(3600, greatest(30, power(2, least(j.attempts, 10))::integer * 30))) end,
      completed_at = case when p_success then now() else j.completed_at end,
      locked_at = null,
      lease_token = null, lease_expires_at = null, updated_at = now()
  where j.id = p_job_id and j.status = 'processing' and j.lease_token = p_lease_token
  returning j.* into v_job;
  if v_job.id is null then raise exception 'NOTIFICATION_DELIVERY_LEASE_MISMATCH'; end if;
  return v_job;
end;
$$;

alter table public.notification_events enable row level security;
alter table public.notification_inbox_items enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_mutes enable row level security;
alter table public.notification_user_settings enable row level security;
alter table public.notification_delivery_jobs enable row level security;

drop policy if exists "Users read notification events in inbox" on public.notification_events;
create policy "Users read notification events in inbox" on public.notification_events
for select to authenticated using (
  private.is_admin(auth.uid()) or exists (
    select 1 from public.notification_inbox_items i
    where i.event_id = notification_events.id and i.recipient_id = auth.uid()
  )
);
drop policy if exists "Users read own notification inbox" on public.notification_inbox_items;
create policy "Users read own notification inbox" on public.notification_inbox_items
for select to authenticated using (recipient_id = auth.uid() or private.is_admin(auth.uid()));
drop policy if exists "Users update own notification inbox" on public.notification_inbox_items;
create policy "Users update own notification inbox" on public.notification_inbox_items
for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences" on public.notification_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage own notification mutes" on public.notification_mutes;
create policy "Users manage own notification mutes" on public.notification_mutes
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage own notification settings" on public.notification_user_settings;
create policy "Users manage own notification settings" on public.notification_user_settings
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.notification_events, public.notification_inbox_items to authenticated;
grant update (state, read_at, archived_at) on public.notification_inbox_items to authenticated;
grant select, insert, update, delete on public.notification_preferences, public.notification_user_settings, public.notification_mutes to authenticated;
grant all on public.notification_events, public.notification_inbox_items, public.notification_delivery_jobs to service_role;
grant all on public.notification_preferences, public.notification_user_settings, public.notification_mutes to service_role;
grant execute on function public.enqueue_notification_event(text, text, text, text, uuid[], jsonb, text, text, uuid, text, text, boolean, text, text) to service_role;
grant execute on function public.claim_notification_delivery_jobs(integer, integer) to service_role;
grant execute on function public.claim_notification_delivery_job(uuid, integer) to service_role;
grant execute on function public.complete_notification_delivery_job(uuid, uuid, boolean, text, text) to service_role;
grant execute on function public.reclaim_notification_delivery_jobs(integer, integer) to service_role;
revoke all on function public.enqueue_notification_event(text, text, text, text, uuid[], jsonb, text, text, uuid, text, text, boolean, text, text) from public, anon, authenticated;
revoke all on function public.claim_notification_delivery_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.claim_notification_delivery_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery_job(uuid, uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.reclaim_notification_delivery_jobs(integer, integer) from public, anon, authenticated;
revoke all on function private.notification_channel_enabled(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.notification_delivery_available_at(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.sync_lms_notification_to_notification_v2() from public, anon, authenticated;
revoke all on function private.touch_notification_updated_at() from public, anon, authenticated;

commit;
