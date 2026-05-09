-- Durable per-user API rate limits for costly or write-heavy application routes.

create table if not exists public.api_rate_limits (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope ~ '^[a-z0-9:_-]{1,80}$'),
  window_start_at timestamptz not null default now(),
  window_reset_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope)
);

alter table public.api_rate_limits enable row level security;

drop policy if exists "Users manage own api rate limits" on public.api_rate_limits;
create policy "Users manage own api rate limits"
on public.api_rate_limits
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists api_rate_limits_user_scope_idx
  on public.api_rate_limits (user_id, scope);

create index if not exists api_rate_limits_reset_idx
  on public.api_rate_limits (window_reset_at);

grant select, insert, update on public.api_rate_limits to authenticated;

do $$
begin
  if to_regclass('public.api_rate_limits_id_seq') is not null then
    grant usage, select on sequence public.api_rate_limits_id_seq to authenticated;
  end if;
end;
$$;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_count integer;
  v_reset_at timestamptz;
  v_new_count integer;
begin
  select auth.uid() into v_user_id;

  if v_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSeconds', greatest(1, coalesce(p_window_seconds, 60))
    );
  end if;

  if p_scope is null
    or p_scope !~ '^[a-z0-9:_-]{1,80}$'
    or p_limit is null
    or p_limit < 1
    or p_limit > 10000
    or p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400
  then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSeconds', 60
    );
  end if;

  v_window := make_interval(secs => p_window_seconds);

  loop
    select request_count, window_reset_at
      into v_count, v_reset_at
      from public.api_rate_limits
      where user_id = v_user_id
        and scope = p_scope
      for update;

    if not found then
      begin
        insert into public.api_rate_limits (
          user_id,
          scope,
          window_start_at,
          window_reset_at,
          request_count
        )
        values (
          v_user_id,
          p_scope,
          v_now,
          v_now + v_window,
          1
        );

        return jsonb_build_object(
          'allowed', true,
          'remaining', greatest(0, p_limit - 1),
          'resetAt', to_jsonb(v_now + v_window),
          'retryAfterSeconds', p_window_seconds
        );
      exception when unique_violation then
        -- A concurrent request created the row. Re-read it under lock.
      end;
    elsif v_reset_at <= v_now then
      update public.api_rate_limits
        set request_count = 1,
            window_start_at = v_now,
            window_reset_at = v_now + v_window,
            updated_at = v_now
        where user_id = v_user_id
          and scope = p_scope;

      return jsonb_build_object(
        'allowed', true,
        'remaining', greatest(0, p_limit - 1),
        'resetAt', to_jsonb(v_now + v_window),
        'retryAfterSeconds', p_window_seconds
      );
    elsif v_count >= p_limit then
      return jsonb_build_object(
        'allowed', false,
        'remaining', 0,
        'resetAt', to_jsonb(v_reset_at),
        'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer)
      );
    else
      v_new_count := v_count + 1;

      update public.api_rate_limits
        set request_count = v_new_count,
            updated_at = v_now
        where user_id = v_user_id
          and scope = p_scope;

      return jsonb_build_object(
        'allowed', true,
        'remaining', greatest(0, p_limit - v_new_count),
        'resetAt', to_jsonb(v_reset_at),
        'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer)
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

do $$
begin
  if to_regclass('public.lesson_progress') is not null then
    create index if not exists lesson_progress_user_lesson_idx
      on public.lesson_progress (user_id, lesson_id);

    create index if not exists lesson_progress_user_status_idx
      on public.lesson_progress (user_id, status);
  end if;

  if to_regclass('public.activity_attempts') is not null then
    create index if not exists activity_attempts_user_activity_completed_idx
      on public.activity_attempts (user_id, activity_id, completed_at);
  end if;

  if to_regclass('public.enrollments') is not null then
    create index if not exists enrollments_user_course_idx
      on public.enrollments (user_id, course_id);
  end if;

  if to_regclass('public.analytics_events') is not null then
    create index if not exists analytics_events_user_occurred_idx
      on public.analytics_events (user_id, occurred_at desc);
  end if;
end;
$$;
