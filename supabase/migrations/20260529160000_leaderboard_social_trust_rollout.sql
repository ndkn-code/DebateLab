-- Phase 6/7 leaderboard social trust, abuse moderation, analytics rollout.
-- Staged in-repo only. Do not apply to production before the Phase 1/3/4
-- leaderboard migrations are approved and applied.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table if not exists public.leaderboard_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_mode text not null default 'public_name'
    check (display_mode in ('public_name', 'initials_only', 'hidden')),
  allow_kudos boolean not null default true,
  show_organization boolean not null default true,
  participate_in_leaderboards boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_kudos (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.xp_seasons(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  kudos_kind text not null default 'keep_going'
    check (kudos_kind in ('keep_going', 'great_round', 'strong_improvement')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id),
  unique (season_id, sender_user_id, recipient_user_id)
);

create table if not exists public.leaderboard_xp_event_flags (
  id uuid primary key default gen_random_uuid(),
  xp_event_id uuid not null references public.xp_events(id) on delete cascade,
  season_id uuid not null references public.xp_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  flag_type text not null
    check (flag_type in (
      'duplicate_submission',
      'low_duration',
      'duel_integrity',
      'organization_hopping',
      'missing_quality_metadata',
      'manual_review'
    )),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high')),
  status text not null default 'flagged_pending_review'
    check (status in (
      'allowed',
      'flagged_pending_review',
      'suppressed_from_leaderboards',
      'resolved_allowed'
    )),
  reason text,
  source text not null default 'system'
    check (source in ('system', 'admin', 'coach')),
  created_by uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (xp_event_id, flag_type)
);

create table if not exists public.leaderboard_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  xp_event_id uuid references public.xp_events(id) on delete set null,
  flag_id uuid references public.leaderboard_xp_event_flags(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leaderboard_kudos_recipient_season
  on public.leaderboard_kudos(recipient_user_id, season_id, created_at desc)
  where status = 'active';
create index if not exists idx_leaderboard_kudos_sender_season
  on public.leaderboard_kudos(sender_user_id, season_id, created_at desc)
  where status = 'active';
create index if not exists idx_leaderboard_flags_season_status
  on public.leaderboard_xp_event_flags(season_id, status, created_at desc);
create index if not exists idx_leaderboard_flags_user_season
  on public.leaderboard_xp_event_flags(user_id, season_id, created_at desc);
create index if not exists idx_leaderboard_audit_club_created
  on public.leaderboard_admin_audit_log(club_id, created_at desc);
create index if not exists idx_leaderboard_audit_event_created
  on public.leaderboard_admin_audit_log(event_type, created_at desc);

alter table public.leaderboard_privacy_settings enable row level security;
alter table public.leaderboard_kudos enable row level security;
alter table public.leaderboard_xp_event_flags enable row level security;
alter table public.leaderboard_admin_audit_log enable row level security;

drop policy if exists "Users can view own leaderboard privacy" on public.leaderboard_privacy_settings;
create policy "Users can view own leaderboard privacy"
  on public.leaderboard_privacy_settings for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can insert own leaderboard privacy" on public.leaderboard_privacy_settings;
create policy "Users can insert own leaderboard privacy"
  on public.leaderboard_privacy_settings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own leaderboard privacy" on public.leaderboard_privacy_settings;
create policy "Users can update own leaderboard privacy"
  on public.leaderboard_privacy_settings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Kudos participants can view kudos" on public.leaderboard_kudos;
create policy "Kudos participants can view kudos"
  on public.leaderboard_kudos for select
  to authenticated
  using (
    sender_user_id = (select auth.uid())
    or recipient_user_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

drop policy if exists "Users can send own kudos" on public.leaderboard_kudos;
create policy "Users can send own kudos"
  on public.leaderboard_kudos for insert
  to authenticated
  with check (sender_user_id = (select auth.uid()) and sender_user_id <> recipient_user_id);

drop policy if exists "Admins can view leaderboard xp event flags" on public.leaderboard_xp_event_flags;
create policy "Admins can view leaderboard xp event flags"
  on public.leaderboard_xp_event_flags for select
  to authenticated
  using (private.is_admin((select auth.uid())));

drop policy if exists "Admins can manage leaderboard xp event flags" on public.leaderboard_xp_event_flags;
create policy "Admins can manage leaderboard xp event flags"
  on public.leaderboard_xp_event_flags for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

drop policy if exists "Admins can view leaderboard audit log" on public.leaderboard_admin_audit_log;
create policy "Admins can view leaderboard audit log"
  on public.leaderboard_admin_audit_log for select
  to authenticated
  using (private.is_admin((select auth.uid())));

grant select, insert, update on public.leaderboard_privacy_settings to authenticated;
grant select, insert on public.leaderboard_kudos to authenticated;
grant select, insert, update on public.leaderboard_xp_event_flags to authenticated;
grant select on public.leaderboard_admin_audit_log to authenticated;
grant all on public.leaderboard_privacy_settings to service_role;
grant all on public.leaderboard_kudos to service_role;
grant all on public.leaderboard_xp_event_flags to service_role;
grant all on public.leaderboard_admin_audit_log to service_role;

create or replace function private.leaderboard_is_student(p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships memberships
    where memberships.user_id = p_user_id
      and memberships.role = 'student'
      and memberships.status = 'active'
  );
$$;

create or replace function private.leaderboard_effective_privacy(p_user_id uuid)
returns table (
  user_id uuid,
  display_mode text,
  allow_kudos boolean,
  show_organization boolean,
  participate_in_leaderboards boolean,
  is_default boolean,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    p_user_id,
    coalesce(settings.display_mode, case when private.leaderboard_is_student(p_user_id) then 'initials_only' else 'public_name' end),
    coalesce(settings.allow_kudos, true),
    coalesce(settings.show_organization, true),
    coalesce(settings.participate_in_leaderboards, true),
    settings.user_id is null,
    coalesce(settings.updated_at, now())
  from (select p_user_id as user_id) seed
  left join public.leaderboard_privacy_settings settings
    on settings.user_id = seed.user_id;
$$;

create or replace function private.leaderboard_initials(p_name text, p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      upper(
        left(
          regexp_replace(coalesce(nullif(p_name, ''), nullif(p_email, ''), 'Thinkfy debater'), '[^[:alnum:] ]', '', 'g'),
          2
        )
      ),
      ''
    ),
    'TF'
  );
$$;

create or replace function private.leaderboard_safe_personal_row(p_row jsonb, p_viewer_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row_user_id uuid;
  v_privacy record;
  v_is_viewer boolean;
  v_is_admin boolean := private.is_admin(auth.uid());
  v_rank text := coalesce(p_row ->> 'rank', '');
  v_name text;
begin
  if p_row is null or p_row = 'null'::jsonb then
    return 'null'::jsonb;
  end if;

  v_row_user_id := nullif(p_row ->> 'userId', '')::uuid;
  v_is_viewer := v_row_user_id = p_viewer_user_id;

  select *
  into v_privacy
  from private.leaderboard_effective_privacy(v_row_user_id);

  if v_is_viewer or v_is_admin or v_privacy.display_mode = 'public_name' then
    return p_row;
  end if;

  v_name := case
    when v_privacy.display_mode = 'hidden' then 'Private debater'
    else 'Debater #' || v_rank
  end;

  return p_row
    || jsonb_build_object(
      'displayName', v_name,
      'avatarUrl', null,
      'title', case when v_privacy.display_mode = 'hidden' then null else p_row ->> 'title' end,
      'privacy', jsonb_build_object('displayMode', v_privacy.display_mode)
    );
end;
$$;

create or replace function private.leaderboard_event_is_suppressed(p_xp_event_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.leaderboard_xp_event_flags flags
    where flags.xp_event_id = p_xp_event_id
      and flags.status = 'suppressed_from_leaderboards'
  );
$$;

create or replace function private.refresh_leaderboard_visible_totals(p_season_id uuid)
returns table (user_total_count integer, org_total_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.xp_season_user_totals
  where season_id = p_season_id;

  insert into public.xp_season_user_totals (
    season_id,
    user_id,
    season_xp,
    lifetime_xp,
    event_count,
    category_breakdown,
    last_event_at
  )
  select
    events.season_id,
    events.user_id,
    coalesce(sum(events.season_xp), 0)::integer,
    coalesce(sum(events.lifetime_xp), 0)::integer,
    count(events.id)::integer,
    coalesce(
      jsonb_object_agg(category_rows.xp_category, category_rows.category_xp),
      '{}'::jsonb
    ),
    max(events.occurred_at)
  from public.xp_events events
  left join lateral (
    select
      category_events.xp_category,
      sum(category_events.season_xp)::integer as category_xp
    from public.xp_events category_events
    where category_events.season_id = events.season_id
      and category_events.user_id = events.user_id
      and category_events.xp_category = events.xp_category
      and not private.leaderboard_event_is_suppressed(category_events.id)
    group by category_events.xp_category
  ) category_rows on true
  where events.season_id = p_season_id
    and not private.leaderboard_event_is_suppressed(events.id)
  group by events.season_id, events.user_id;

  get diagnostics user_total_count = row_count;

  delete from public.xp_season_org_totals
  where season_id = p_season_id
    and organization_type = 'club';

  insert into public.xp_season_org_totals (
    season_id,
    organization_type,
    organization_id,
    season_xp,
    event_count,
    contributing_user_count,
    active_member_count,
    normalized_xp,
    category_breakdown,
    last_event_at
  )
  with member_counts as (
    select
      memberships.club_id,
      count(distinct memberships.user_id)::integer as active_member_count
    from public.club_memberships memberships
    where memberships.role = 'student'
      and memberships.status = 'active'
    group by memberships.club_id
  ), event_counts as (
    select
      coalesce(events.club_id, classes.club_id) as club_id,
      coalesce(sum(events.season_xp), 0)::integer as season_xp,
      count(events.id)::integer as event_count,
      count(distinct events.user_id)::integer as contributing_user_count,
      max(events.occurred_at) as last_event_at
    from public.xp_events events
    left join public.classes classes
      on classes.id = events.class_id
    where events.season_id = p_season_id
      and coalesce(events.club_id, classes.club_id) is not null
      and not private.leaderboard_event_is_suppressed(events.id)
    group by coalesce(events.club_id, classes.club_id)
  )
  select
    p_season_id,
    'club',
    clubs.id,
    coalesce(event_counts.season_xp, 0),
    coalesce(event_counts.event_count, 0),
    coalesce(event_counts.contributing_user_count, 0),
    coalesce(member_counts.active_member_count, 0),
    round(coalesce(event_counts.season_xp, 0)::numeric / greatest(coalesce(member_counts.active_member_count, 0), 1), 2),
    '{}'::jsonb,
    event_counts.last_event_at
  from public.clubs clubs
  left join member_counts on member_counts.club_id = clubs.id
  left join event_counts on event_counts.club_id = clubs.id
  where clubs.status = 'active';

  get diagnostics org_total_count = row_count;
  return next;
end;
$$;

create or replace function private.refresh_leaderboard_org_totals(p_season_id uuid)
returns table (refreshed_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts record;
begin
  select *
  into v_counts
  from private.refresh_leaderboard_visible_totals(p_season_id);

  refreshed_count := coalesce(v_counts.org_total_count, 0);
  return next;
end;
$$;

create or replace function private.update_leaderboard_privacy_settings(
  p_display_mode text,
  p_allow_kudos boolean,
  p_show_organization boolean,
  p_participate_in_leaderboards boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.leaderboard_privacy_settings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  insert into public.leaderboard_privacy_settings (
    user_id,
    display_mode,
    allow_kudos,
    show_organization,
    participate_in_leaderboards,
    updated_at
  )
  values (
    v_user_id,
    case when p_display_mode in ('public_name', 'initials_only', 'hidden') then p_display_mode else 'initials_only' end,
    coalesce(p_allow_kudos, true),
    coalesce(p_show_organization, true),
    coalesce(p_participate_in_leaderboards, true),
    now()
  )
  on conflict (user_id) do update set
    display_mode = excluded.display_mode,
    allow_kudos = excluded.allow_kudos,
    show_organization = excluded.show_organization,
    participate_in_leaderboards = excluded.participate_in_leaderboards,
    updated_at = now()
  returning * into v_row;

  insert into public.leaderboard_admin_audit_log (
    event_type,
    actor_user_id,
    target_user_id,
    metadata
  )
  values (
    'leaderboard_privacy_updated',
    v_user_id,
    v_user_id,
    jsonb_build_object(
      'display_mode', v_row.display_mode,
      'allow_kudos', v_row.allow_kudos,
      'show_organization', v_row.show_organization,
      'participate_in_leaderboards', v_row.participate_in_leaderboards
    )
  );

  return jsonb_build_object(
    'userId', v_row.user_id,
    'displayMode', v_row.display_mode,
    'allowKudos', v_row.allow_kudos,
    'showOrganization', v_row.show_organization,
    'participateInLeaderboards', v_row.participate_in_leaderboards,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function private.send_leaderboard_kudos(
  p_recipient_user_id uuid,
  p_season_id uuid,
  p_kudos_kind text default 'keep_going'
)
returns table (status text, message text, kudos_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender_user_id uuid := auth.uid();
  v_kind text := case
    when p_kudos_kind in ('keep_going', 'great_round', 'strong_improvement') then p_kudos_kind
    else 'keep_going'
  end;
  v_privacy record;
  v_kudos_id uuid;
begin
  if v_sender_user_id is null then
    status := 'auth_required';
    message := 'Sign in to send encouragement.';
    kudos_id := null;
    return next;
    return;
  end if;

  if p_recipient_user_id is null or p_season_id is null then
    status := 'invalid';
    message := 'Missing kudos target.';
    kudos_id := null;
    return next;
    return;
  end if;

  if v_sender_user_id = p_recipient_user_id then
    status := 'self_not_allowed';
    message := 'You cannot send kudos to yourself.';
    kudos_id := null;
    return next;
    return;
  end if;

  select *
  into v_privacy
  from private.leaderboard_effective_privacy(p_recipient_user_id);

  if not coalesce(v_privacy.allow_kudos, true) then
    status := 'disabled';
    message := 'This member is not accepting kudos.';
    kudos_id := null;
    return next;
    return;
  end if;

  insert into public.leaderboard_kudos (
    season_id,
    sender_user_id,
    recipient_user_id,
    kudos_kind
  )
  values (p_season_id, v_sender_user_id, p_recipient_user_id, v_kind)
  on conflict (season_id, sender_user_id, recipient_user_id) do nothing
  returning id into v_kudos_id;

  if v_kudos_id is null then
    status := 'already_sent';
    message := 'You already sent encouragement this season.';
    kudos_id := null;
    return next;
    return;
  end if;

  insert into public.leaderboard_admin_audit_log (
    event_type,
    actor_user_id,
    target_user_id,
    metadata
  )
  values (
    'leaderboard_kudos_sent',
    v_sender_user_id,
    p_recipient_user_id,
    jsonb_build_object('season_id', p_season_id, 'kudos_kind', v_kind)
  );

  status := 'sent';
  message := 'Encouragement sent.';
  kudos_id := v_kudos_id;
  return next;
end;
$$;

create or replace function private.flag_leaderboard_xp_event(
  p_xp_event_id uuid,
  p_flag_type text,
  p_reason text default null,
  p_severity text default 'medium',
  p_status text default 'flagged_pending_review'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_event public.xp_events%rowtype;
  v_flag public.leaderboard_xp_event_flags%rowtype;
begin
  if not private.is_admin(v_actor_user_id) then
    raise exception 'Forbidden';
  end if;

  select *
  into v_event
  from public.xp_events
  where id = p_xp_event_id;

  if v_event.id is null then
    raise exception 'XP event not found.';
  end if;

  insert into public.leaderboard_xp_event_flags (
    xp_event_id,
    season_id,
    user_id,
    flag_type,
    severity,
    status,
    reason,
    source,
    created_by,
    updated_at
  )
  values (
    v_event.id,
    v_event.season_id,
    v_event.user_id,
    case
      when p_flag_type in ('duplicate_submission', 'low_duration', 'duel_integrity', 'organization_hopping', 'missing_quality_metadata', 'manual_review')
        then p_flag_type
      else 'manual_review'
    end,
    case when p_severity in ('low', 'medium', 'high') then p_severity else 'medium' end,
    case
      when p_status in ('allowed', 'flagged_pending_review', 'suppressed_from_leaderboards', 'resolved_allowed')
        then p_status
      else 'flagged_pending_review'
    end,
    nullif(trim(coalesce(p_reason, '')), ''),
    'admin',
    v_actor_user_id,
    now()
  )
  on conflict (xp_event_id, flag_type) do update set
    severity = excluded.severity,
    status = excluded.status,
    reason = excluded.reason,
    source = excluded.source,
    updated_at = now()
  returning * into v_flag;

  if v_flag.status = 'suppressed_from_leaderboards' then
    perform private.refresh_leaderboard_visible_totals(v_flag.season_id);
  end if;

  insert into public.leaderboard_admin_audit_log (
    event_type,
    actor_user_id,
    target_user_id,
    club_id,
    xp_event_id,
    flag_id,
    metadata
  )
  values (
    'leaderboard_abuse_flag_created',
    v_actor_user_id,
    v_event.user_id,
    v_event.club_id,
    v_event.id,
    v_flag.id,
    jsonb_build_object(
      'flag_type', v_flag.flag_type,
      'severity', v_flag.severity,
      'status', v_flag.status
    )
  );

  return jsonb_build_object(
    'id', v_flag.id,
    'xpEventId', v_flag.xp_event_id,
    'seasonId', v_flag.season_id,
    'userId', v_flag.user_id,
    'flagType', v_flag.flag_type,
    'severity', v_flag.severity,
    'status', v_flag.status,
    'reason', v_flag.reason,
    'createdAt', v_flag.created_at,
    'updatedAt', v_flag.updated_at
  );
end;
$$;

create or replace function private.resolve_leaderboard_xp_event_flag(
  p_flag_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_flag public.leaderboard_xp_event_flags%rowtype;
begin
  if not private.is_admin(v_actor_user_id) then
    raise exception 'Forbidden';
  end if;

  update public.leaderboard_xp_event_flags
  set status = case
        when p_status in ('allowed', 'flagged_pending_review', 'suppressed_from_leaderboards', 'resolved_allowed')
          then p_status
        else 'resolved_allowed'
      end,
      resolved_by = v_actor_user_id,
      resolved_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('resolution_note', nullif(trim(coalesce(p_note, '')), '')),
      updated_at = now()
  where id = p_flag_id
  returning * into v_flag;

  if v_flag.id is null then
    raise exception 'Flag not found.';
  end if;

  perform private.refresh_leaderboard_visible_totals(v_flag.season_id);

  insert into public.leaderboard_admin_audit_log (
    event_type,
    actor_user_id,
    target_user_id,
    xp_event_id,
    flag_id,
    metadata
  )
  values (
    'leaderboard_abuse_flag_resolved',
    v_actor_user_id,
    v_flag.user_id,
    v_flag.xp_event_id,
    v_flag.id,
    jsonb_build_object('status', v_flag.status)
  );

  return jsonb_build_object(
    'id', v_flag.id,
    'status', v_flag.status,
    'resolvedAt', v_flag.resolved_at,
    'updatedAt', v_flag.updated_at
  );
end;
$$;

create or replace function private.get_leaderboard_safety_audit(
  p_club_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if not private.is_admin(v_actor_user_id)
    and (p_club_id is null or not private.can_manage_club(p_club_id, v_actor_user_id)) then
    raise exception 'Forbidden';
  end if;

  return jsonb_build_object(
    'flags', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', flags.id,
        'xpEventId', flags.xp_event_id,
        'seasonId', flags.season_id,
        'userId', flags.user_id,
        'displayName', coalesce(nullif(profiles.display_name, ''), profiles.email, 'Thinkfy member'),
        'flagType', flags.flag_type,
        'severity', flags.severity,
        'status', flags.status,
        'reason', flags.reason,
        'source', flags.source,
        'createdAt', flags.created_at,
        'resolvedAt', flags.resolved_at
      ) order by flags.created_at desc), '[]'::jsonb)
      from public.leaderboard_xp_event_flags flags
      join public.xp_events events on events.id = flags.xp_event_id
      left join public.profiles profiles on profiles.id = flags.user_id
      where p_club_id is null or events.club_id = p_club_id
      limit v_limit
    ),
    'audit', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', audit.id,
        'eventType', audit.event_type,
        'actorUserId', audit.actor_user_id,
        'targetUserId', audit.target_user_id,
        'clubId', audit.club_id,
        'xpEventId', audit.xp_event_id,
        'flagId', audit.flag_id,
        'metadata', audit.metadata,
        'createdAt', audit.created_at
      ) order by audit.created_at desc), '[]'::jsonb)
      from public.leaderboard_admin_audit_log audit
      where p_club_id is null or audit.club_id = p_club_id
      limit v_limit
    )
  );
end;
$$;

create or replace function private.get_leaderboard_rollout_metrics(
  p_since timestamptz default (now() - interval '30 days')
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if not private.is_admin(v_actor_user_id) then
    raise exception 'Forbidden';
  end if;

  return jsonb_build_object(
    'since', p_since,
    'kudosSent', (
      select count(*)::integer
      from public.leaderboard_kudos kudos
      where kudos.created_at >= p_since
        and kudos.status = 'active'
    ),
    'privacyOptOuts', (
      select count(*)::integer
      from public.leaderboard_privacy_settings settings
      where settings.updated_at >= p_since
        and settings.participate_in_leaderboards = false
    ),
    'suppressedXpEvents', (
      select count(*)::integer
      from public.leaderboard_xp_event_flags flags
      where flags.created_at >= p_since
        and flags.status = 'suppressed_from_leaderboards'
    ),
    'pendingFlags', (
      select count(*)::integer
      from public.leaderboard_xp_event_flags flags
      where flags.status = 'flagged_pending_review'
    )
  );
end;
$$;

create or replace function private.get_leaderboard_page_data_v2(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_page jsonb;
  v_rows jsonb;
  v_current_user jsonb;
  v_season_id uuid;
  v_privacy record;
  v_kudos jsonb;
  v_explanation jsonb;
begin
  v_page := private.get_leaderboard_page_data(v_user_id);
  v_season_id := case
    when coalesce(v_page #>> '{season,id}', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_page #>> '{season,id}')::uuid
    else null
  end;

  select *
  into v_privacy
  from private.leaderboard_effective_privacy(v_user_id);

  select coalesce(jsonb_agg(private.leaderboard_safe_personal_row(row_json, v_user_id)), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(coalesce(v_page #> '{personal,rows}', '[]'::jsonb)) row_json;

  v_current_user := case
    when v_page #> '{personal,currentUser}' is null
      or v_page #> '{personal,currentUser}' = 'null'::jsonb
      then 'null'::jsonb
    else private.leaderboard_safe_personal_row(
      v_page #> '{personal,currentUser}',
      v_user_id
    )
  end;

  select coalesce(jsonb_object_agg(
    row_user_id::text,
    jsonb_build_object(
      'targetUserId', row_user_id,
      'viewerCanSend',
        row_user_id <> v_user_id
        and coalesce(target_privacy.allow_kudos, true)
        and not exists (
          select 1
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.sender_user_id = v_user_id
            and kudos.recipient_user_id = row_user_id
            and kudos.status = 'active'
        ),
      'viewerHasSent',
        exists (
          select 1
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.sender_user_id = v_user_id
            and kudos.recipient_user_id = row_user_id
            and kudos.status = 'active'
        )
    )
  ), '{}'::jsonb)
  into v_kudos
  from (
    select (row_json ->> 'userId')::uuid as row_user_id
    from jsonb_array_elements(coalesce(v_page #> '{personal,rows}', '[]'::jsonb)) row_json
  ) row_users
  cross join lateral private.leaderboard_effective_privacy(row_users.row_user_id) target_privacy;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', events.id,
    'category', events.xp_category,
    'label', initcap(events.xp_category),
    'seasonXp', events.season_xp,
    'lifetimeXp', events.lifetime_xp,
    'status', case when flags.status = 'suppressed_from_leaderboards' then 'suppressed' else 'counted' end,
    'reason', coalesce(flags.reason, case when (events.metadata ->> 'cap_applied')::boolean then 'Category cap applied.' else null end),
    'occurredAt', events.occurred_at
  ) order by events.occurred_at desc), '[]'::jsonb)
  into v_explanation
  from public.xp_events events
  left join public.leaderboard_xp_event_flags flags
    on flags.xp_event_id = events.id
   and flags.status = 'suppressed_from_leaderboards'
  where events.user_id = v_user_id
    and events.season_id = v_season_id
  limit 12;

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_page, '{personal,rows}', v_rows, true),
      '{personal,currentUser}',
      coalesce(v_current_user, 'null'::jsonb),
      true
    ),
    '{socialTrust}',
    jsonb_build_object(
      'privacy', jsonb_build_object(
        'userId', v_privacy.user_id,
        'displayMode', v_privacy.display_mode,
        'allowKudos', v_privacy.allow_kudos,
        'showOrganization', v_privacy.show_organization,
        'participateInLeaderboards', v_privacy.participate_in_leaderboards,
        'isDefault', v_privacy.is_default,
        'updatedAt', v_privacy.updated_at
      ),
      'kudos', jsonb_build_object(
        'receivedThisSeason', (
          select count(*)::integer
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.recipient_user_id = v_user_id
            and kudos.status = 'active'
        ),
        'sentThisSeason', (
          select count(*)::integer
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.sender_user_id = v_user_id
            and kudos.status = 'active'
        ),
        'availableKinds', jsonb_build_array('keep_going', 'great_round', 'strong_improvement'),
        'byUserId', v_kudos
      ),
      'scoreExplanation', v_explanation
    ),
    true
  );
end;
$$;

create or replace function public.get_leaderboard_page_data_v2(p_user_id uuid default auth.uid())
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leaderboard_page_data_v2(p_user_id);
$$;

create or replace function public.get_leaderboard_privacy_settings(p_user_id uuid default auth.uid())
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', settings.user_id,
    'displayMode', settings.display_mode,
    'allowKudos', settings.allow_kudos,
    'showOrganization', settings.show_organization,
    'participateInLeaderboards', settings.participate_in_leaderboards,
    'isDefault', settings.is_default,
    'updatedAt', settings.updated_at
  )
  from private.leaderboard_effective_privacy(coalesce(p_user_id, auth.uid())) settings;
$$;

create or replace function public.update_leaderboard_privacy_settings(
  p_display_mode text,
  p_allow_kudos boolean,
  p_show_organization boolean,
  p_participate_in_leaderboards boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_leaderboard_privacy_settings(
    p_display_mode,
    p_allow_kudos,
    p_show_organization,
    p_participate_in_leaderboards
  );
$$;

create or replace function public.send_leaderboard_kudos(
  p_recipient_user_id uuid,
  p_season_id uuid,
  p_kudos_kind text default 'keep_going'
)
returns table (status text, message text, kudos_id uuid)
language sql
security invoker
set search_path = ''
as $$
  select * from private.send_leaderboard_kudos(
    p_recipient_user_id,
    p_season_id,
    p_kudos_kind
  );
$$;

create or replace function public.flag_leaderboard_xp_event(
  p_xp_event_id uuid,
  p_flag_type text,
  p_reason text default null,
  p_severity text default 'medium',
  p_status text default 'flagged_pending_review'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.flag_leaderboard_xp_event(
    p_xp_event_id,
    p_flag_type,
    p_reason,
    p_severity,
    p_status
  );
$$;

create or replace function public.resolve_leaderboard_xp_event_flag(
  p_flag_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.resolve_leaderboard_xp_event_flag(p_flag_id, p_status, p_note);
$$;

create or replace function public.get_leaderboard_safety_audit(
  p_club_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leaderboard_safety_audit(p_club_id, p_limit);
$$;

create or replace function public.get_leaderboard_rollout_metrics(
  p_since timestamptz default (now() - interval '30 days')
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leaderboard_rollout_metrics(p_since);
$$;

revoke all on function private.leaderboard_effective_privacy(uuid) from public, anon, authenticated;
grant execute on function private.leaderboard_effective_privacy(uuid) to authenticated, service_role;

revoke all on function private.leaderboard_is_student(uuid) from public, anon, authenticated;
grant execute on function private.leaderboard_is_student(uuid) to authenticated, service_role;

revoke all on function private.leaderboard_safe_personal_row(jsonb, uuid) from public, anon, authenticated;
grant execute on function private.leaderboard_safe_personal_row(jsonb, uuid) to authenticated, service_role;

revoke all on function private.leaderboard_event_is_suppressed(uuid) from public, anon, authenticated;
grant execute on function private.leaderboard_event_is_suppressed(uuid) to service_role;

revoke all on function private.refresh_leaderboard_visible_totals(uuid) from public, anon, authenticated;
grant execute on function private.refresh_leaderboard_visible_totals(uuid) to service_role;

revoke all on function private.get_leaderboard_page_data_v2(uuid) from public, anon;
grant execute on function private.get_leaderboard_page_data_v2(uuid) to authenticated, service_role;

revoke all on function public.get_leaderboard_page_data_v2(uuid) from public, anon;
grant execute on function public.get_leaderboard_page_data_v2(uuid) to authenticated, service_role;

revoke all on function public.get_leaderboard_privacy_settings(uuid) from public, anon;
grant execute on function public.get_leaderboard_privacy_settings(uuid) to authenticated, service_role;

revoke all on function public.update_leaderboard_privacy_settings(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_leaderboard_privacy_settings(text, boolean, boolean, boolean) to authenticated, service_role;

revoke all on function public.send_leaderboard_kudos(uuid, uuid, text) from public, anon;
grant execute on function public.send_leaderboard_kudos(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.flag_leaderboard_xp_event(uuid, text, text, text, text) from public, anon;
grant execute on function public.flag_leaderboard_xp_event(uuid, text, text, text, text) to authenticated, service_role;

revoke all on function public.resolve_leaderboard_xp_event_flag(uuid, text, text) from public, anon;
grant execute on function public.resolve_leaderboard_xp_event_flag(uuid, text, text) to authenticated, service_role;

revoke all on function public.get_leaderboard_safety_audit(uuid, integer) from public, anon;
grant execute on function public.get_leaderboard_safety_audit(uuid, integer) to authenticated, service_role;

revoke all on function public.get_leaderboard_rollout_metrics(timestamptz) from public, anon;
grant execute on function public.get_leaderboard_rollout_metrics(timestamptz) to authenticated, service_role;
