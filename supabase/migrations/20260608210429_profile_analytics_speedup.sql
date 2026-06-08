-- Speed up the production profile analytics entrypoint by giving the
-- signed-in user's own profile page a lightweight shell RPC. The full public
-- profile RPC remains unchanged for other users and privacy previews.

create index if not exists idx_activity_log_user_created_desc
  on public.activity_log(user_id, created_at desc);

create or replace function private.get_profile_self_shell(
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_language text := private.profile_normalized_language(p_leaderboard_language);
  v_friend_count integer := 0;
  v_season jsonb := null;
  v_organization jsonb := null;
  v_featured_achievements jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'state', 'not_found',
      'profile', null,
      'connection', null
    );
  end if;

  select count(*)::integer
  into v_friend_count
  from public.profile_connections connections
  where connections.status = 'accepted'
    and (
      connections.requester_user_id = v_user_id
      or connections.recipient_user_id = v_user_id
    );

  with active_season as (
    select seasons.id
    from public.xp_seasons seasons
    where seasons.status = 'active'
    order by seasons.starts_at desc
    limit 1
  ),
  target_total as (
    select
      totals.season_id,
      totals.leaderboard_language,
      totals.user_id,
      totals.season_xp,
      totals.last_event_at,
      cohorts.league_tier,
      cohorts.cohort_index
    from active_season
    join public.xp_season_user_totals totals
      on totals.season_id = active_season.id
     and totals.user_id = v_user_id
     and totals.leaderboard_language = v_language
    left join public.leaderboard_season_user_cohorts cohorts
      on cohorts.season_id = totals.season_id
     and cohorts.leaderboard_language = totals.leaderboard_language
     and cohorts.user_id = totals.user_id
    left join public.leaderboard_privacy_settings leaderboard_settings
      on leaderboard_settings.user_id = totals.user_id
    where coalesce(leaderboard_settings.participate_in_leaderboards, true)
      and coalesce(leaderboard_settings.display_mode, 'public_name') <> 'hidden'
    limit 1
  )
  select jsonb_build_object(
    'language', v_language,
    'seasonXp', target_total.season_xp,
    'rank', (
      select (count(*) + 1)::integer
      from public.xp_season_user_totals peer_totals
      left join public.leaderboard_season_user_cohorts peer_cohorts
        on peer_cohorts.season_id = peer_totals.season_id
       and peer_cohorts.leaderboard_language = peer_totals.leaderboard_language
       and peer_cohorts.user_id = peer_totals.user_id
      left join public.leaderboard_privacy_settings peer_settings
        on peer_settings.user_id = peer_totals.user_id
      where peer_totals.season_id = target_total.season_id
        and peer_totals.leaderboard_language = target_total.leaderboard_language
        and peer_cohorts.league_tier is not distinct from target_total.league_tier
        and peer_cohorts.cohort_index is not distinct from target_total.cohort_index
        and coalesce(peer_settings.participate_in_leaderboards, true)
        and coalesce(peer_settings.display_mode, 'public_name') <> 'hidden'
        and (
          peer_totals.season_xp > target_total.season_xp
          or (
            peer_totals.season_xp = target_total.season_xp
            and (
              (
                peer_totals.last_event_at is not null
                and target_total.last_event_at is null
              )
              or (
                peer_totals.last_event_at is not null
                and target_total.last_event_at is not null
                and peer_totals.last_event_at < target_total.last_event_at
              )
              or (
                peer_totals.last_event_at is not distinct from target_total.last_event_at
                and peer_totals.user_id < target_total.user_id
              )
            )
          )
        )
    ),
    'leagueTier', target_total.league_tier,
    'cohortIndex', target_total.cohort_index
  )
  into v_season
  from target_total;

  select jsonb_build_object(
    'type', 'club',
    'id', clubs.id,
    'name', clubs.name,
    'role', memberships.role
  )
  into v_organization
  from public.club_memberships memberships
  join public.clubs clubs
    on clubs.id = memberships.club_id
  where memberships.user_id = v_user_id
    and memberships.status = 'active'
    and clubs.status = 'active'
  order by memberships.joined_at desc
  limit 1;

  if v_organization is null then
    select jsonb_build_object(
      'type', 'class',
      'id', classes.id,
      'name', classes.title,
      'role', memberships.member_role
    )
    into v_organization
    from public.class_memberships memberships
    join public.classes classes
      on classes.id = memberships.class_id
    where memberships.user_id = v_user_id
      and memberships.status = 'active'
      and classes.status = 'active'
    order by memberships.joined_at desc
    limit 1;
  end if;

  with explicit_featured as (
    select
      achievements.id,
      achievements.slug,
      achievements.title,
      achievements.description,
      achievements.category,
      achievements.icon,
      achievements.title_reward,
      achievements.xp_reward,
      achievements.condition_type,
      achievements.condition_value,
      achievements.sort_order,
      unlocked.unlocked_at,
      featured.sort_order as featured_order
    from public.profile_featured_achievements featured
    join public.user_achievements unlocked
      on unlocked.user_id = featured.user_id
     and unlocked.achievement_id = featured.achievement_id
    join public.achievements achievements
      on achievements.id = featured.achievement_id
    where featured.user_id = v_user_id
    order by featured.sort_order
    limit 4
  ),
  fallback_featured as (
    select
      achievements.id,
      achievements.slug,
      achievements.title,
      achievements.description,
      achievements.category,
      achievements.icon,
      achievements.title_reward,
      achievements.xp_reward,
      achievements.condition_type,
      achievements.condition_value,
      achievements.sort_order,
      unlocked.unlocked_at,
      null::integer as featured_order
    from public.user_achievements unlocked
    join public.achievements achievements
      on achievements.id = unlocked.achievement_id
    where unlocked.user_id = v_user_id
      and not exists (select 1 from explicit_featured)
    order by unlocked.unlocked_at desc nulls last, achievements.sort_order
    limit 4
  ),
  combined as (
    select * from explicit_featured
    union all
    select * from fallback_featured
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', combined.id,
        'slug', combined.slug,
        'title', combined.title,
        'description', combined.description,
        'category', combined.category,
        'icon', combined.icon,
        'titleReward', combined.title_reward,
        'xpReward', combined.xp_reward,
        'conditionType', combined.condition_type,
        'conditionValue', combined.condition_value,
        'sortOrder', combined.sort_order,
        'unlocked', true,
        'unlockedAt', combined.unlocked_at,
        'progressValue', null,
        'progressTarget', null,
        'progressPercent', 100,
        'isFeatured', true
      )
      order by coalesce(combined.featured_order, 999), combined.unlocked_at desc nulls last, combined.sort_order
    ),
    '[]'::jsonb
  )
  into v_featured_achievements
  from combined;

  return jsonb_build_object(
    'state', 'self',
    'visibleSections', jsonb_build_object(
      'analytics', true,
      'activities', true,
      'achievements', true,
      'organization', true
    ),
    'connection', jsonb_build_object(
      'status', 'self',
      'viewerCanRequest', false
    ),
    'profile', jsonb_build_object(
      'userId', v_profile.id,
      'handle', v_profile.handle,
      'displayName', coalesce(nullif(v_profile.display_name, ''), 'Thinkfy debater'),
      'avatarUrl', v_profile.avatar_url,
      'selectedTitle', v_profile.selected_title,
      'profileStatus', nullif(v_profile.profile_status, ''),
      'level', v_profile.level,
      'lifetimeXp', greatest(coalesce(v_profile.xp, 0), 0),
      'season', v_season,
      'organization', v_organization,
      'friendCounts', jsonb_build_object('friends', v_friend_count),
      'featuredAchievements', v_featured_achievements
    )
  );
end;
$$;

create or replace function public.get_profile_self_shell(
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_self_shell(p_leaderboard_language);
$$;

revoke all on function private.get_profile_self_shell(text) from public, anon;
grant execute on function private.get_profile_self_shell(text) to authenticated, service_role;

revoke all on function public.get_profile_self_shell(text) from public, anon;
grant execute on function public.get_profile_self_shell(text) to authenticated, service_role;
