-- Keep achievements in the Achievements showcase only. The Activities feed is
-- reserved for practice, duel, learning, level, and general activity events.

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
      and logs.activity_type not like '%achievement%'
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

notify pgrst, 'reload schema';
