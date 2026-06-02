-- Profile social phases 4-6: privacy-gated profile tab data plus featured
-- achievements. These functions intentionally expose JSON read models rather
-- than broadening direct SELECT policies on student-owned tables.

create table if not exists public.profile_featured_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  sort_order integer not null check (sort_order between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_id),
  unique (user_id, sort_order)
);

create index if not exists idx_profile_featured_achievements_user_order
  on public.profile_featured_achievements(user_id, sort_order);

alter table public.profile_featured_achievements enable row level security;

drop policy if exists "Users can view own featured achievements" on public.profile_featured_achievements;
create policy "Users can view own featured achievements"
  on public.profile_featured_achievements for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can insert own featured achievements" on public.profile_featured_achievements;
create policy "Users can insert own featured achievements"
  on public.profile_featured_achievements for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_achievements unlocked
      where unlocked.user_id = (select auth.uid())
        and unlocked.achievement_id = profile_featured_achievements.achievement_id
    )
  );

drop policy if exists "Users can update own featured achievements" on public.profile_featured_achievements;
create policy "Users can update own featured achievements"
  on public.profile_featured_achievements for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_achievements unlocked
      where unlocked.user_id = (select auth.uid())
        and unlocked.achievement_id = profile_featured_achievements.achievement_id
    )
  );

drop policy if exists "Users can delete own featured achievements" on public.profile_featured_achievements;
create policy "Users can delete own featured achievements"
  on public.profile_featured_achievements for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.profile_featured_achievements from public, anon, authenticated;
grant select, insert, update, delete on public.profile_featured_achievements to authenticated;
grant all on public.profile_featured_achievements to service_role;

create or replace function private.profile_normalized_language(p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(nullif(trim(coalesce(p_language, '')), ''))
    when 'vi' then 'vi'
    else 'en'
  end;
$$;

create or replace function private.profile_normalized_range(p_range text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(nullif(trim(coalesce(p_range, '')), ''))
    when '7d' then '7d'
    when '90d' then '90d'
    else '30d'
  end;
$$;

create or replace function private.profile_resolve_target(
  p_target_user_id uuid default null,
  p_handle text default null
)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_handle text := lower(regexp_replace(trim(coalesce(p_handle, '')), '^@+', ''));
begin
  if p_target_user_id is null and v_handle = '' then
    p_target_user_id := auth.uid();
  end if;

  if p_target_user_id is not null then
    select *
    into v_target
    from public.profiles
    where id = p_target_user_id
    limit 1;
  else
    select profiles.*
    into v_target
    from public.profiles profiles
    left join public.profile_privacy_settings settings
      on settings.user_id = profiles.id
    where profiles.handle = v_handle
      and coalesce(settings.searchable_by_handle, true)
    limit 1;
  end if;

  return v_target;
end;
$$;

create or replace function private.profile_achievement_progress_value(
  p_target_user_id uuid,
  p_condition_type text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_max_score integer := 0;
  v_completed_courses integer := 0;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_target_user_id
  limit 1;

  if not found then
    return 0;
  end if;

  if p_condition_type = 'score_above' then
    select coalesce(max(total_score), 0)::integer
    into v_max_score
    from public.debate_sessions
    where user_id = p_target_user_id
      and total_score is not null;

    return v_max_score;
  end if;

  if p_condition_type = 'courses_completed' then
    select count(*)::integer
    into v_completed_courses
    from public.enrollments
    where user_id = p_target_user_id
      and status = 'completed';

    return v_completed_courses;
  end if;

  return case p_condition_type
    when 'sessions_completed' then greatest(coalesce(v_profile.total_sessions_completed, 0), 0)
    when 'streak_days' then greatest(coalesce(v_profile.streak_current, 0), coalesce(v_profile.streak_longest, 0), 0)
    when 'practice_minutes' then greatest(coalesce(v_profile.total_practice_minutes, 0), 0)
    when 'level_reached' then greatest(coalesce(v_profile.level, 1), 0)
    else 0
  end;
end;
$$;

create or replace function private.profile_achievement_json(
  p_target_user_id uuid,
  p_include_locked boolean,
  p_include_progress boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with achievement_rows as (
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
      featured.sort_order as featured_order,
      private.profile_achievement_progress_value(
        p_target_user_id,
        achievements.condition_type
      ) as progress_value
    from public.achievements achievements
    left join public.user_achievements unlocked
      on unlocked.achievement_id = achievements.id
     and unlocked.user_id = p_target_user_id
    left join public.profile_featured_achievements featured
      on featured.achievement_id = achievements.id
     and featured.user_id = p_target_user_id
    where p_include_locked or unlocked.achievement_id is not null
  ),
  shaped as (
    select
      *,
      unlocked_at is not null as unlocked,
      featured_order is not null as is_featured,
      least(100, greatest(0, round(
        case
          when condition_value <= 0 then 100
          else (least(progress_value, condition_value)::numeric / condition_value::numeric) * 100
        end
      )::integer)) as progress_percent
    from achievement_rows
  ),
  fallback_featured as (
    select id
    from shaped
    where unlocked
    order by coalesce(featured_order, 999), unlocked_at desc nulls last, sort_order
    limit 4
  )
  select jsonb_build_object(
    'achievements',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', shaped.id,
          'slug', shaped.slug,
          'title', shaped.title,
          'description', shaped.description,
          'category', shaped.category,
          'icon', shaped.icon,
          'titleReward', shaped.title_reward,
          'xpReward', shaped.xp_reward,
          'conditionType', shaped.condition_type,
          'conditionValue', shaped.condition_value,
          'sortOrder', shaped.sort_order,
          'unlocked', shaped.unlocked,
          'unlockedAt', shaped.unlocked_at,
          'progressValue', case when p_include_progress then shaped.progress_value else null end,
          'progressTarget', case when p_include_progress then shaped.condition_value else null end,
          'progressPercent', case
            when p_include_progress then shaped.progress_percent
            when shaped.unlocked then 100
            else null
          end,
          'isFeatured', shaped.is_featured or shaped.id in (select id from fallback_featured)
        )
        order by shaped.unlocked desc, shaped.unlocked_at desc nulls last, shaped.sort_order
      ),
      '[]'::jsonb
    ),
    'featured',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', featured.id,
            'slug', featured.slug,
            'title', featured.title,
            'description', featured.description,
            'category', featured.category,
            'icon', featured.icon,
            'titleReward', featured.title_reward,
            'xpReward', featured.xp_reward,
            'conditionType', featured.condition_type,
            'conditionValue', featured.condition_value,
            'sortOrder', featured.sort_order,
            'unlocked', featured.unlocked,
            'unlockedAt', featured.unlocked_at,
            'progressValue', case when p_include_progress then featured.progress_value else null end,
            'progressTarget', case when p_include_progress then featured.condition_value else null end,
            'progressPercent', case
              when p_include_progress then featured.progress_percent
              when featured.unlocked then 100
              else null
            end,
            'isFeatured', true
          )
          order by coalesce(featured.featured_order, 999), featured.unlocked_at desc nulls last, featured.sort_order
        )
        from shaped featured
        where featured.unlocked
          and (featured.is_featured or featured.id in (select id from fallback_featured))
      ),
      '[]'::jsonb
    ),
    'categories',
    coalesce(
      (
        select jsonb_agg(category order by category)
        from (
          select distinct category
          from shaped
        ) categories
      ),
      '[]'::jsonb
    ),
    'unlockedCount',
    coalesce((select count(*)::integer from shaped where unlocked), 0),
    'totalCount',
    case
      when p_include_locked then coalesce((select count(*)::integer from shaped), 0)
      else coalesce((select count(*)::integer from shaped where unlocked), 0)
    end
  )
  from shaped;
$$;

create or replace function private.get_profile_achievements(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_user_id uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_language text := private.profile_normalized_language(p_leaderboard_language);
  v_visible boolean;
  v_connection_status text;
  v_payload jsonb;
  v_is_self boolean;
begin
  if v_viewer_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_target := private.profile_resolve_target(p_target_user_id, p_handle);

  if v_target.id is null then
    return jsonb_build_object('state', 'not_found', 'viewerMode', 'public', 'featured', '[]'::jsonb, 'achievements', '[]'::jsonb, 'categories', '[]'::jsonb, 'unlockedCount', 0, 'totalCount', 0, 'maxFeatured', 4);
  end if;

  v_connection_status := private.profile_connection_status(v_viewer_user_id, v_target.id);

  if v_connection_status = 'blocked' then
    return jsonb_build_object('state', 'blocked', 'viewerMode', 'public', 'featured', '[]'::jsonb, 'achievements', '[]'::jsonb, 'categories', '[]'::jsonb, 'unlockedCount', 0, 'totalCount', 0, 'maxFeatured', 4);
  end if;

  v_visible := private.profile_section_visible(v_viewer_user_id, v_target.id, 'achievements', v_language);
  v_is_self := v_viewer_user_id = v_target.id or private.is_admin(v_viewer_user_id);

  if not v_visible then
    return jsonb_build_object('state', 'private', 'viewerMode', 'public', 'featured', '[]'::jsonb, 'achievements', '[]'::jsonb, 'categories', '[]'::jsonb, 'unlockedCount', 0, 'totalCount', 0, 'maxFeatured', 4);
  end if;

  v_payload := private.profile_achievement_json(v_target.id, v_is_self, v_is_self);

  return v_payload || jsonb_build_object(
    'state', 'visible',
    'viewerMode', case when v_is_self then 'self' else 'public' end,
    'maxFeatured', 4
  );
end;
$$;

create or replace function private.get_profile_activity_feed(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_leaderboard_language text default 'en',
  p_limit integer default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_user_id uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_language text := private.profile_normalized_language(p_leaderboard_language);
  v_visible boolean;
  v_connection_status text;
  v_is_self boolean;
  v_items jsonb;
begin
  if v_viewer_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_target := private.profile_resolve_target(p_target_user_id, p_handle);

  if v_target.id is null then
    return jsonb_build_object('state', 'not_found', 'viewerMode', 'public', 'items', '[]'::jsonb);
  end if;

  v_connection_status := private.profile_connection_status(v_viewer_user_id, v_target.id);

  if v_connection_status = 'blocked' then
    return jsonb_build_object('state', 'blocked', 'viewerMode', 'public', 'items', '[]'::jsonb);
  end if;

  v_visible := private.profile_section_visible(v_viewer_user_id, v_target.id, 'activities', v_language);
  v_is_self := v_viewer_user_id = v_target.id or private.is_admin(v_viewer_user_id);

  if not v_visible then
    return jsonb_build_object('state', 'private', 'viewerMode', 'public', 'items', '[]'::jsonb);
  end if;

  with feed as (
    select
      ('practice:' || sessions.id::text) as id,
      'practice' as kind,
      sessions.topic_title as title,
      sessions.topic_category as subtitle,
      sessions.created_at as created_at,
      0 as xp_earned,
      sessions.total_score as score,
      greatest(1, round(sessions.duration_seconds::numeric / 60))::integer as duration_minutes,
      case when v_is_self then '/history/' || sessions.id::text else null end as href
    from public.debate_sessions sessions
    where sessions.user_id = v_target.id
      and (
        (v_language = 'vi' and sessions.practice_language = 'vi')
        or (v_language = 'en' and coalesce(sessions.practice_language, 'en') = 'en')
      )

    union all

    select
      ('duel:' || duels.id::text) as id,
      'duel' as kind,
      duels.topic_title as title,
      coalesce(duels.topic_category, 'Duel') as subtitle,
      coalesce(duels.completed_at, duels.created_at) as created_at,
      0 as xp_earned,
      null::integer as score,
      null::integer as duration_minutes,
      case when v_is_self then '/debates/' || duels.share_code || '/result' else null end as href
    from public.debate_duel_participants participants
    join public.debate_duels duels
      on duels.id = participants.duel_id
    where participants.user_id = v_target.id
      and duels.status = 'completed'
      and (
        (v_language = 'vi' and duels.practice_language = 'vi')
        or (v_language = 'en' and coalesce(duels.practice_language, 'en') = 'en')
      )

    union all

    select
      ('achievement:' || unlocked.id::text) as id,
      'achievement' as kind,
      achievements.title as title,
      achievements.description as subtitle,
      unlocked.unlocked_at as created_at,
      achievements.xp_reward as xp_earned,
      null::integer as score,
      null::integer as duration_minutes,
      null::text as href
    from public.user_achievements unlocked
    join public.achievements achievements
      on achievements.id = unlocked.achievement_id
    where unlocked.user_id = v_target.id

    union all

    select
      ('activity:' || logs.id::text) as id,
      case
        when logs.activity_type like '%course%' then 'course'
        when logs.activity_type like '%lesson%' then 'lesson'
        when logs.activity_type like '%level%' then 'level'
        else 'activity'
      end as kind,
      coalesce(
        logs.metadata->>'title',
        logs.metadata->>'course_title',
        logs.metadata->>'lesson_title',
        replace(logs.activity_type, '_', ' ')
      ) as title,
      replace(logs.activity_type, '_', ' ') as subtitle,
      logs.created_at as created_at,
      logs.xp_earned,
      null::integer as score,
      null::integer as duration_minutes,
      null::text as href
    from public.activity_log logs
    where logs.user_id = v_target.id
      and logs.activity_type not in ('debate_completed')
  ),
  ranked as (
    select *
    from feed
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 80), 120))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'kind', kind,
        'title', title,
        'subtitle', subtitle,
        'createdAt', created_at,
        'xpEarned', xp_earned,
        'score', score,
        'durationMinutes', duration_minutes,
        'href', href
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from ranked;

  return jsonb_build_object(
    'state', 'visible',
    'viewerMode', case when v_is_self then 'self' else 'public' end,
    'items', v_items
  );
end;
$$;

create or replace function private.get_profile_analytics_summary(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_range text default '30d',
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_user_id uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_language text := private.profile_normalized_language(p_leaderboard_language);
  v_range text := private.profile_normalized_range(p_range);
  v_days integer := case private.profile_normalized_range(p_range)
    when '7d' then 7
    when '90d' then 90
    else 30
  end;
  v_start timestamptz := now() - ((v_days - 1)::text || ' days')::interval;
  v_visible boolean;
  v_connection_status text;
  v_is_self boolean;
  v_total_minutes integer := 0;
  v_total_sessions integer := 0;
  v_average_score numeric := null;
  v_speaking_count integer := 0;
  v_debate_count integer := 0;
begin
  if v_viewer_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_target := private.profile_resolve_target(p_target_user_id, p_handle);

  if v_target.id is null then
    return jsonb_build_object('state', 'not_found', 'viewerMode', 'public');
  end if;

  v_connection_status := private.profile_connection_status(v_viewer_user_id, v_target.id);

  if v_connection_status = 'blocked' then
    return jsonb_build_object('state', 'blocked', 'viewerMode', 'public');
  end if;

  v_visible := private.profile_section_visible(v_viewer_user_id, v_target.id, 'analytics', v_language);
  v_is_self := v_viewer_user_id = v_target.id or private.is_admin(v_viewer_user_id);

  if not v_visible then
    return jsonb_build_object('state', 'private', 'viewerMode', 'public');
  end if;

  select
    count(*)::integer,
    coalesce(round(avg(nullif(total_score, 0)))::integer, null),
    count(*) filter (where coalesce(feedback->>'practiceTrack', practice_track, 'debate') = 'speaking')::integer,
    count(*) filter (where coalesce(feedback->>'practiceTrack', practice_track, 'debate') <> 'speaking')::integer,
    coalesce(sum(greatest(1, round(duration_seconds::numeric / 60))), 0)::integer
  into
    v_total_sessions,
    v_average_score,
    v_speaking_count,
    v_debate_count,
    v_total_minutes
  from public.debate_sessions
  where user_id = v_target.id
    and created_at >= v_start
    and (
      (v_language = 'vi' and practice_language = 'vi')
      or (v_language = 'en' and coalesce(practice_language, 'en') = 'en')
    );

  return jsonb_build_object(
    'state', 'visible',
    'viewerMode', case when v_is_self then 'self' else 'public' end,
    'range', v_range,
    'practiceLanguage', v_language,
    'totalPracticeMinutes', coalesce(v_total_minutes, 0),
    'totalSessions', coalesce(v_total_sessions, 0),
    'averageScore', v_average_score,
    'speakingCount', coalesce(v_speaking_count, 0),
    'debateCount', coalesce(v_debate_count, 0),
    'level', case when v_visible then v_target.level else null end,
    'lifetimeXp', case when v_visible then greatest(coalesce(v_target.xp, 0), 0) else null end
  );
end;
$$;

create or replace function private.set_profile_featured_achievements(
  p_achievement_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer_user_id uuid := auth.uid();
  v_count integer := coalesce(array_length(p_achievement_ids, 1), 0);
  v_unique_count integer;
begin
  if v_viewer_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_count > 4 then
    raise exception 'You can feature up to 4 achievements.';
  end if;

  select count(distinct achievement_id)::integer
  into v_unique_count
  from unnest(coalesce(p_achievement_ids, '{}'::uuid[])) as requested(achievement_id);

  if v_unique_count <> v_count then
    raise exception 'Featured achievements must be unique.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_achievement_ids, '{}'::uuid[])) as requested(achievement_id)
    where not exists (
      select 1
      from public.user_achievements unlocked
      where unlocked.user_id = v_viewer_user_id
        and unlocked.achievement_id = requested.achievement_id
    )
  ) then
    raise exception 'Only unlocked achievements can be featured.';
  end if;

  delete from public.profile_featured_achievements
  where user_id = v_viewer_user_id;

  insert into public.profile_featured_achievements (
    user_id,
    achievement_id,
    sort_order
  )
  select
    v_viewer_user_id,
    achievement_id,
    (row_number() over ())::integer
  from unnest(coalesce(p_achievement_ids, '{}'::uuid[])) as requested(achievement_id);

  return jsonb_build_object('status', 'ok', 'featuredCount', v_count);
end;
$$;

create or replace function public.get_profile_achievements(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_achievements(p_target_user_id, p_handle, p_leaderboard_language);
$$;

create or replace function public.get_profile_activity_feed(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_leaderboard_language text default 'en',
  p_limit integer default 80
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_activity_feed(p_target_user_id, p_handle, p_leaderboard_language, p_limit);
$$;

create or replace function public.get_profile_analytics_summary(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_range text default '30d',
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_analytics_summary(p_target_user_id, p_handle, p_range, p_leaderboard_language);
$$;

create or replace function public.set_profile_featured_achievements(
  p_achievement_ids uuid[]
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.set_profile_featured_achievements(p_achievement_ids);
$$;

revoke all on function private.profile_normalized_language(text) from public, anon, authenticated;
grant execute on function private.profile_normalized_language(text) to service_role;

revoke all on function private.profile_normalized_range(text) from public, anon, authenticated;
grant execute on function private.profile_normalized_range(text) to service_role;

revoke all on function private.profile_resolve_target(uuid, text) from public, anon, authenticated;
grant execute on function private.profile_resolve_target(uuid, text) to service_role;

revoke all on function private.profile_achievement_progress_value(uuid, text) from public, anon, authenticated;
grant execute on function private.profile_achievement_progress_value(uuid, text) to service_role;

revoke all on function private.profile_achievement_json(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function private.profile_achievement_json(uuid, boolean, boolean) to service_role;

revoke all on function private.get_profile_achievements(uuid, text, text) from public, anon;
grant execute on function private.get_profile_achievements(uuid, text, text) to authenticated, service_role;

revoke all on function private.get_profile_activity_feed(uuid, text, text, integer) from public, anon;
grant execute on function private.get_profile_activity_feed(uuid, text, text, integer) to authenticated, service_role;

revoke all on function private.get_profile_analytics_summary(uuid, text, text, text) from public, anon;
grant execute on function private.get_profile_analytics_summary(uuid, text, text, text) to authenticated, service_role;

revoke all on function private.set_profile_featured_achievements(uuid[]) from public, anon;
grant execute on function private.set_profile_featured_achievements(uuid[]) to authenticated, service_role;

revoke all on function public.get_profile_achievements(uuid, text, text) from public, anon;
grant execute on function public.get_profile_achievements(uuid, text, text) to authenticated, service_role;

revoke all on function public.get_profile_activity_feed(uuid, text, text, integer) from public, anon;
grant execute on function public.get_profile_activity_feed(uuid, text, text, integer) to authenticated, service_role;

revoke all on function public.get_profile_analytics_summary(uuid, text, text, text) from public, anon;
grant execute on function public.get_profile_analytics_summary(uuid, text, text, text) to authenticated, service_role;

revoke all on function public.set_profile_featured_achievements(uuid[]) from public, anon;
grant execute on function public.set_profile_featured_achievements(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
