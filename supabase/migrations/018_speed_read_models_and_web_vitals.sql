-- Student-route read models and first-party performance summary support.
-- Functions are security-invoker and rely on auth.uid() so RLS remains the
-- authorization boundary.

create or replace function public.get_dashboard_payload()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_today date := current_date;
  v_stats_start date := current_date - 13;
  v_scored_start timestamptz := date_trunc('day', now()) - interval '29 days';
begin
  select auth.uid() into v_user_id;

  if v_user_id is null then
    return jsonb_build_object(
      'profile', null,
      'enrollments', '[]'::jsonb,
      'recent_sessions', '[]'::jsonb,
      'scored_sessions', '[]'::jsonb,
      'stats', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'profile',
      (
        select jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'avatar_url', p.avatar_url,
          'role', p.role,
          'streak_current', p.streak_current,
          'streak_longest', p.streak_longest,
          'streak_last_active_date', p.streak_last_active_date,
          'total_practice_minutes', p.total_practice_minutes,
          'total_sessions_completed', p.total_sessions_completed,
          'xp', p.xp,
          'level', p.level,
          'onboarding_completed', p.onboarding_completed,
          'preferences', p.preferences,
          'orb_balance', p.orb_balance,
          'referral_code', p.referral_code
        )
        from public.profiles p
        where p.id = v_user_id
      ),
    'enrollments',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(e) || jsonb_build_object(
              'courses',
              jsonb_build_object(
                'title', c.title,
                'category', c.category,
                'thumbnail_url', c.thumbnail_url
              )
            )
            order by e.enrolled_at desc
          )
          from public.enrollments e
          left join public.courses c on c.id = e.course_id
          where e.user_id = v_user_id
            and e.status = 'active'
        ),
        '[]'::jsonb
      ),
    'recent_sessions',
      coalesce(
        (
          select jsonb_agg(to_jsonb(s) order by s.created_at desc)
          from (
            select
              id,
              topic_title,
              topic_category as category,
              topic_difficulty,
              side,
              mode,
              ai_difficulty,
              feedback,
              total_score,
              overall_band,
              duration_seconds,
              created_at
            from public.debate_sessions
            where user_id = v_user_id
            order by created_at desc
            limit 8
          ) s
        ),
        '[]'::jsonb
      ),
    'scored_sessions',
      coalesce(
        (
          select jsonb_agg(to_jsonb(s) order by s.created_at desc)
          from (
            select
              id,
              topic_title,
              topic_category as category,
              topic_difficulty,
              side,
              mode,
              ai_difficulty,
              feedback,
              total_score,
              overall_band,
              duration_seconds,
              created_at
            from public.debate_sessions
            where user_id = v_user_id
              and total_score is not null
              and created_at >= v_scored_start
            order by created_at desc
          ) s
        ),
        '[]'::jsonb
      ),
    'stats',
      coalesce(
        (
          select jsonb_agg(to_jsonb(ds) order by ds.date)
          from (
            select date, sessions_completed, minutes_studied, xp_earned
            from public.daily_stats
            where user_id = v_user_id
              and date between v_stats_start and v_today
            order by date
          ) ds
        ),
        '[]'::jsonb
      )
  );
end;
$$;

create or replace function public.get_course_library_payload()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select auth.uid() into v_user_id;

  return jsonb_build_object(
    'courses',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'title', c.title,
              'slug', c.slug,
              'description', c.description,
              'short_description', c.short_description,
              'thumbnail_url', c.thumbnail_url,
              'category', c.category,
              'difficulty', c.difficulty,
              'estimated_hours', c.estimated_hours,
              'is_published', c.is_published,
              'visibility', c.visibility,
              'is_free', c.is_free,
              'is_archived', c.is_archived,
              'metadata', c.metadata,
              'created_at', c.created_at,
              'updated_at', c.updated_at
            )
            order by c.created_at
          )
          from public.courses c
          where c.is_published = true
        ),
        '[]'::jsonb
      ),
    'enrollments',
      case
        when v_user_id is null then '[]'::jsonb
        else coalesce(
          (
            select jsonb_agg(to_jsonb(e) order by e.enrolled_at desc)
            from public.enrollments e
            where e.user_id = v_user_id
          ),
          '[]'::jsonb
        )
      end
  );
end;
$$;

create or replace function public.get_chat_sidebar_payload()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select auth.uid() into v_user_id;

  if v_user_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object('preview', p.preview)
        order by c.updated_at desc
      )
      from (
        select id, user_id, title, context_type, context_id, created_at, updated_at
        from public.chat_conversations
        where user_id = v_user_id
        order by updated_at desc
        limit 30
      ) c
      left join lateral (
        select
          case
            when length(normalized.content) > 88
              then substring(normalized.content from 1 for 85) || '...'
            else normalized.content
          end as preview
        from (
          select trim(regexp_replace(cm.content, '\s+', ' ', 'g')) as content
          from public.chat_messages cm
          where cm.conversation_id = c.id
          order by cm.created_at desc
          limit 1
        ) normalized
      ) p on true
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.get_practice_feedback_payload(p_session_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select auth.uid() into v_user_id;

  if v_user_id is null or p_session_id is null then
    return null;
  end if;

  return (
    select to_jsonb(s)
    from (
      select
        id,
        topic_title,
        topic_category as category,
        side,
        mode,
        feedback,
        total_score,
        overall_band,
        transcript,
        duration_seconds,
        created_at
      from public.debate_sessions
      where user_id = v_user_id
        and id = p_session_id
      limit 1
    ) s
  );
end;
$$;

grant execute on function public.get_dashboard_payload() to authenticated;
grant execute on function public.get_course_library_payload() to authenticated;
grant execute on function public.get_chat_sidebar_payload() to authenticated;
grant execute on function public.get_practice_feedback_payload(uuid) to authenticated;

do $$
begin
  if to_regclass('public.debate_sessions') is not null then
    create index if not exists debate_sessions_user_created_idx
      on public.debate_sessions (user_id, created_at desc);

    create index if not exists debate_sessions_user_score_created_idx
      on public.debate_sessions (user_id, created_at desc)
      where total_score is not null;
  end if;

  if to_regclass('public.daily_stats') is not null then
    create index if not exists daily_stats_user_date_idx
      on public.daily_stats (user_id, date);
  end if;

  if to_regclass('public.chat_conversations') is not null then
    create index if not exists chat_conversations_user_updated_idx
      on public.chat_conversations (user_id, updated_at desc);
  end if;

  if to_regclass('public.chat_messages') is not null then
    create index if not exists chat_messages_conversation_created_idx
      on public.chat_messages (conversation_id, created_at desc);
  end if;

  if to_regclass('public.analytics_events') is not null then
    create index if not exists analytics_events_web_vitals_idx
      on public.analytics_events (event_name, occurred_at desc, route)
      where event_name = 'web_vital_recorded';
  end if;
end;
$$;
