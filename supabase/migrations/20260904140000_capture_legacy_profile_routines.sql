-- Capture routines that exist in production but were missing from the
-- migration chain. Each block is guarded so production remains a no-op and
-- retains its existing implementation and ACL.

DO $capture$
BEGIN
  IF to_regprocedure('public.get_skill_breakdown(uuid)') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.get_skill_breakdown(p_user_id uuid)
      RETURNS json
      LANGUAGE sql
      SECURITY DEFINER
      AS $function$
        SELECT json_build_object(
          'content', COALESCE(AVG((feedback->'content'->>'score')::numeric), 0),
          'structure', COALESCE(AVG((feedback->'structure'->>'score')::numeric), 0),
          'language', COALESCE(AVG((feedback->'language'->>'score')::numeric), 0),
          'persuasion', COALESCE(AVG((feedback->'persuasion'->>'score')::numeric), 0),
          'total_sessions', COUNT(*)
        )
        FROM debate_sessions
        WHERE user_id = p_user_id
          AND feedback IS NOT NULL;
      $function$
    $sql$;
    ALTER FUNCTION public.get_skill_breakdown(uuid) OWNER TO postgres;
    REVOKE ALL ON FUNCTION public.get_skill_breakdown(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_skill_breakdown(uuid) TO PUBLIC, anon, authenticated, service_role;
  END IF;
END
$capture$;

DO $capture$
BEGIN
  IF to_regprocedure('public.recalculate_course_progress(uuid,uuid)') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.recalculate_course_progress(p_user_id uuid, p_course_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
      DECLARE
        v_total INT;
        v_completed INT;
        v_pct DECIMAL(5,2);
      BEGIN
        SELECT COUNT(*) INTO v_total FROM lessons WHERE course_id = p_course_id AND is_published = true;
        SELECT COUNT(*) INTO v_completed FROM lesson_progress
          WHERE user_id = p_user_id AND course_id = p_course_id AND status = 'completed';

        IF v_total > 0 THEN
          v_pct := (v_completed::DECIMAL / v_total) * 100;
        ELSE
          v_pct := 0;
        END IF;

        UPDATE enrollments
        SET progress_pct = v_pct,
            status = CASE WHEN v_pct >= 100 THEN 'completed' ELSE 'active' END,
            completed_at = CASE WHEN v_pct >= 100 THEN NOW() ELSE NULL END,
            last_accessed_at = NOW()
        WHERE user_id = p_user_id AND course_id = p_course_id;
      END;
      $function$
    $sql$;
    ALTER FUNCTION public.recalculate_course_progress(uuid, uuid) OWNER TO postgres;
    REVOKE ALL ON FUNCTION public.recalculate_course_progress(uuid, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.recalculate_course_progress(uuid, uuid) TO PUBLIC, anon, authenticated, service_role;
  END IF;
END
$capture$;

DO $capture$
BEGIN
  IF to_regprocedure('public.update_streak(uuid)') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.update_streak(p_user_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
      DECLARE
        v_last_date DATE;
        v_today DATE := CURRENT_DATE;
        v_current INT;
        v_longest INT;
      BEGIN
        SELECT streak_last_active_date, streak_current, streak_longest
        INTO v_last_date, v_current, v_longest
        FROM profiles WHERE id = p_user_id;

        IF v_last_date = v_today THEN
          RETURN; -- Already active today
        ELSIF v_last_date = v_today - 1 THEN
          v_current := v_current + 1; -- Consecutive day
        ELSE
          v_current := 1; -- Streak broken, restart
        END IF;

        IF v_current > v_longest THEN
          v_longest := v_current;
        END IF;

        UPDATE profiles
        SET streak_current = v_current,
            streak_longest = v_longest,
            streak_last_active_date = v_today,
            updated_at = NOW()
        WHERE id = p_user_id;
      END;
      $function$
    $sql$;
    ALTER FUNCTION public.update_streak(uuid) OWNER TO postgres;
    REVOKE ALL ON FUNCTION public.update_streak(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.update_streak(uuid) TO PUBLIC, anon, authenticated, service_role;
  END IF;
END
$capture$;

DO $capture$
BEGIN
  IF to_regprocedure('public.upsert_daily_stats(uuid,integer,integer,integer)') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.upsert_daily_stats(
        p_user_id uuid,
        p_sessions integer DEFAULT 0,
        p_minutes integer DEFAULT 0,
        p_xp integer DEFAULT 0
      )
      RETURNS void
      LANGUAGE plpgsql
      SET search_path TO ''
      AS $function$
      begin
        insert into public.daily_stats (
          user_id,
          date,
          sessions_completed,
          practice_minutes,
          xp_earned
        )
        values (
          p_user_id,
          current_date,
          coalesce(p_sessions, 0),
          coalesce(p_minutes, 0),
          coalesce(p_xp, 0)
        )
        on conflict (user_id, date)
        do update set
          sessions_completed = public.daily_stats.sessions_completed + excluded.sessions_completed,
          practice_minutes = public.daily_stats.practice_minutes + excluded.practice_minutes,
          xp_earned = public.daily_stats.xp_earned + excluded.xp_earned;
      end;
      $function$
    $sql$;
    ALTER FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer) OWNER TO postgres;
    REVOKE ALL ON FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer) TO PUBLIC, anon, authenticated, service_role;
  END IF;
END
$capture$;

DO $capture$
BEGIN
  IF to_regprocedure('public.upsert_daily_stats(uuid,integer,integer,integer,numeric)') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.upsert_daily_stats(
        p_user_id uuid,
        p_sessions integer DEFAULT 0,
        p_minutes integer DEFAULT 0,
        p_xp integer DEFAULT 0,
        p_score numeric DEFAULT NULL::numeric
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
      BEGIN
        INSERT INTO daily_stats (user_id, date, sessions_completed, minutes_studied, xp_earned, average_score)
        VALUES (p_user_id, CURRENT_DATE, p_sessions, p_minutes, p_xp, p_score)
        ON CONFLICT (user_id, date)
        DO UPDATE SET
          sessions_completed = daily_stats.sessions_completed + p_sessions,
          minutes_studied = daily_stats.minutes_studied + p_minutes,
          xp_earned = daily_stats.xp_earned + p_xp,
          average_score = CASE
            WHEN p_score IS NOT NULL THEN
              COALESCE((daily_stats.average_score * daily_stats.sessions_completed + p_score) / (daily_stats.sessions_completed + 1), p_score)
            ELSE daily_stats.average_score
          END;
      END;
      $function$
    $sql$;
    ALTER FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer, numeric) OWNER TO postgres;
    REVOKE ALL ON FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer, numeric) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer, numeric) TO authenticated, service_role;
  END IF;
END
$capture$;
