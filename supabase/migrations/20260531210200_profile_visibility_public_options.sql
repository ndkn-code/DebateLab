-- Replace the student-facing "trusted context" visibility tier with the
-- simpler production choices: private, connections, and public.

update public.profile_privacy_settings
set
  profile_visibility = case when profile_visibility = 'trusted' then 'connections' else profile_visibility end,
  analytics_visibility = case when analytics_visibility = 'trusted' then 'connections' else analytics_visibility end,
  activities_visibility = case when activities_visibility = 'trusted' then 'connections' else activities_visibility end,
  achievements_visibility = case when achievements_visibility = 'trusted' then 'connections' else achievements_visibility end,
  organization_visibility = case when organization_visibility = 'trusted' then 'connections' else organization_visibility end,
  updated_at = now()
where 'trusted' in (
  profile_visibility,
  analytics_visibility,
  activities_visibility,
  achievements_visibility,
  organization_visibility
);

alter table public.profile_privacy_settings
  alter column profile_visibility set default 'connections',
  alter column analytics_visibility set default 'private',
  alter column activities_visibility set default 'connections',
  alter column achievements_visibility set default 'connections',
  alter column organization_visibility set default 'connections';

alter table public.profile_privacy_settings
  drop constraint if exists profile_privacy_settings_profile_visibility_check,
  drop constraint if exists profile_privacy_settings_analytics_visibility_check,
  drop constraint if exists profile_privacy_settings_activities_visibility_check,
  drop constraint if exists profile_privacy_settings_achievements_visibility_check,
  drop constraint if exists profile_privacy_settings_organization_visibility_check;

alter table public.profile_privacy_settings
  add constraint profile_privacy_settings_profile_visibility_check
    check (profile_visibility in ('private', 'connections', 'public')),
  add constraint profile_privacy_settings_analytics_visibility_check
    check (analytics_visibility in ('private', 'connections', 'public')),
  add constraint profile_privacy_settings_activities_visibility_check
    check (activities_visibility in ('private', 'connections', 'public')),
  add constraint profile_privacy_settings_achievements_visibility_check
    check (achievements_visibility in ('private', 'connections', 'public')),
  add constraint profile_privacy_settings_organization_visibility_check
    check (organization_visibility in ('private', 'connections', 'public'));

create or replace function private.profile_effective_privacy(p_user_id uuid)
returns table (
  user_id uuid,
  profile_visibility text,
  analytics_visibility text,
  activities_visibility text,
  achievements_visibility text,
  organization_visibility text,
  allow_connection_requests boolean,
  searchable_by_handle boolean,
  is_default boolean,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    p_user_id,
    case coalesce(settings.profile_visibility, 'connections')
      when 'trusted' then 'connections'
      else coalesce(settings.profile_visibility, 'connections')
    end,
    case coalesce(settings.analytics_visibility, 'private')
      when 'trusted' then 'connections'
      else coalesce(settings.analytics_visibility, 'private')
    end,
    case coalesce(settings.activities_visibility, 'connections')
      when 'trusted' then 'connections'
      else coalesce(settings.activities_visibility, 'connections')
    end,
    case coalesce(settings.achievements_visibility, 'connections')
      when 'trusted' then 'connections'
      else coalesce(settings.achievements_visibility, 'connections')
    end,
    case coalesce(settings.organization_visibility, 'connections')
      when 'trusted' then 'connections'
      else coalesce(settings.organization_visibility, 'connections')
    end,
    coalesce(settings.allow_connection_requests, true),
    coalesce(settings.searchable_by_handle, true),
    settings.user_id is null,
    coalesce(settings.updated_at, now())
  from (select p_user_id as user_id) seed
  left join public.profile_privacy_settings settings
    on settings.user_id = seed.user_id;
$$;

create or replace function private.profile_section_visible(
  p_viewer_user_id uuid,
  p_target_user_id uuid,
  p_section text,
  p_leaderboard_language text default 'en'
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_privacy record;
  v_visibility text;
begin
  if p_viewer_user_id is null or p_target_user_id is null then
    return false;
  end if;

  if p_viewer_user_id = p_target_user_id or private.is_admin(p_viewer_user_id) then
    return true;
  end if;

  if private.profile_is_blocked_between(p_viewer_user_id, p_target_user_id) then
    return false;
  end if;

  select *
  into v_privacy
  from private.profile_effective_privacy(p_target_user_id);

  v_visibility := case lower(coalesce(p_section, 'profile'))
    when 'analytics' then v_privacy.analytics_visibility
    when 'activities' then v_privacy.activities_visibility
    when 'achievements' then v_privacy.achievements_visibility
    when 'organization' then v_privacy.organization_visibility
    else v_privacy.profile_visibility
  end;

  if v_visibility = 'trusted' then
    v_visibility := 'connections';
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'connections' then
    return private.profile_connection_status(p_viewer_user_id, p_target_user_id) = 'accepted';
  end if;

  return false;
end;
$$;

revoke all on function private.profile_effective_privacy(uuid) from public, anon, authenticated;
grant execute on function private.profile_effective_privacy(uuid) to service_role;

revoke all on function private.profile_section_visible(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.profile_section_visible(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
