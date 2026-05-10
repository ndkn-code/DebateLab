-- Smart popup campaigns, events, and cron audit trail.

create schema if not exists private;

create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'
  );
$$;

grant execute on function private.is_admin(uuid) to authenticated;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid,
  event_name text not null,
  feature_area text not null,
  route text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'web' check (source in ('web', 'server', 'admin', 'system')),
  created_at timestamptz not null default now()
);

alter table public.analytics_events
  drop constraint if exists analytics_events_feature_area_check;

alter table public.analytics_events
  add constraint analytics_events_feature_area_check
  check (
    feature_area in (
      'courses',
      'activities',
      'practice',
      'duels',
      'ai_feedback',
      'admin',
      'profile',
      'notifications'
    )
  );

create index if not exists idx_analytics_events_user_time
  on public.analytics_events(user_id, occurred_at desc);

create index if not exists idx_analytics_events_feature_time
  on public.analytics_events(feature_area, occurred_at desc);

create index if not exists idx_analytics_events_name_time
  on public.analytics_events(event_name, occurred_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Users can view own analytics events" on public.analytics_events;
create policy "Users can view own analytics events"
  on public.analytics_events for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can insert own analytics events" on public.analytics_events;
create policy "Users can insert own analytics events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can manage analytics events" on public.analytics_events;
create policy "Admins can manage analytics events"
  on public.analytics_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

grant select, insert on public.analytics_events to authenticated;

create table if not exists public.smart_popup_campaigns (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  surface text not null default 'dashboard' check (surface in ('dashboard', 'global')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  priority integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  cooldown_hours integer not null default 168 check (cooldown_hours >= 0),
  max_impressions_per_user integer not null default 3 check (max_impressions_per_user > 0),
  daily_cap_per_user integer not null default 1 check (daily_cap_per_user > 0),
  weekly_cap_per_user integer not null default 3 check (weekly_cap_per_user > 0),
  cta_href text not null,
  image_path text not null,
  copy_en jsonb not null default '{}'::jsonb,
  copy_vi jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_popup_user_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  segment text not null default 'active_user',
  traits jsonb not null default '{}'::jsonb,
  campaign_state jsonb not null default '{}'::jsonb,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_popup_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_key text not null references public.smart_popup_campaigns(key) on delete cascade,
  event_type text not null check (
    event_type in ('impression', 'dismissed', 'cta_clicked', 'dont_show_again')
  ),
  surface text not null default 'dashboard',
  route text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.smart_popup_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null default 'smart-popups',
  status text not null check (status in ('started', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed_users integer not null default 0,
  generated_opportunities integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_smart_popup_campaigns_active
  on public.smart_popup_campaigns(surface, status, priority);

create index if not exists idx_smart_popup_events_user_time
  on public.smart_popup_events(user_id, occurred_at desc);

create index if not exists idx_smart_popup_events_campaign_time
  on public.smart_popup_events(campaign_key, occurred_at desc);

create index if not exists idx_smart_popup_cron_runs_started
  on public.smart_popup_cron_runs(job_key, started_at desc);

alter table public.smart_popup_campaigns enable row level security;
alter table public.smart_popup_user_state enable row level security;
alter table public.smart_popup_events enable row level security;
alter table public.smart_popup_cron_runs enable row level security;

drop policy if exists "Authenticated users can view active popup campaigns" on public.smart_popup_campaigns;
create policy "Authenticated users can view active popup campaigns"
  on public.smart_popup_campaigns for select
  using (
    auth.uid() is not null
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Admins can manage popup campaigns" on public.smart_popup_campaigns;
create policy "Admins can manage popup campaigns"
  on public.smart_popup_campaigns for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own popup state" on public.smart_popup_user_state;
create policy "Users can view own popup state"
  on public.smart_popup_user_state for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage popup state" on public.smart_popup_user_state;
create policy "Admins can manage popup state"
  on public.smart_popup_user_state for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own popup events" on public.smart_popup_events;
create policy "Users can view own popup events"
  on public.smart_popup_events for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage popup events" on public.smart_popup_events;
create policy "Admins can manage popup events"
  on public.smart_popup_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view popup cron runs" on public.smart_popup_cron_runs;
create policy "Admins can view popup cron runs"
  on public.smart_popup_cron_runs for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage popup cron runs" on public.smart_popup_cron_runs;
create policy "Admins can manage popup cron runs"
  on public.smart_popup_cron_runs for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

insert into public.smart_popup_campaigns (
  key,
  surface,
  status,
  priority,
  cooldown_hours,
  max_impressions_per_user,
  daily_cap_per_user,
  weekly_cap_per_user,
  cta_href,
  image_path,
  copy_en,
  copy_vi,
  rules
)
values
  (
    'first-practice',
    'dashboard',
    'active',
    10,
    72,
    2,
    1,
    3,
    '/practice?track=speaking',
    '/images/smart-popups/first-practice.webp',
    '{
      "eyebrow": "Start strong",
      "title": "Ready for your first practice?",
      "body": "One short speech is enough to unlock real feedback and start your debate rhythm.",
      "ctaLabel": "Start practice",
      "dismissLabel": "Later",
      "dontShowLabel": "Don''t show this again",
      "alt": "Friendly DebateLab mascot holding a microphone beside a debate podium"
    }'::jsonb,
    '{
      "eyebrow": "Bắt đầu thật gọn",
      "title": "Sẵn sàng cho phiên luyện đầu tiên?",
      "body": "Chỉ một bài nói ngắn là đủ để mở feedback thật và bắt đầu nhịp luyện debate.",
      "ctaLabel": "Luyện ngay",
      "dismissLabel": "Để sau",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật DebateLab thân thiện cầm micro bên bục tranh biện"
    }'::jsonb,
    '{"segments":["first_time_user"],"maxSessions":0}'::jsonb
  ),
  (
    'resume-streak',
    'dashboard',
    'active',
    20,
    72,
    3,
    1,
    3,
    '/practice',
    '/images/smart-popups/resume-streak.webp',
    '{
      "eyebrow": "Momentum check",
      "title": "Your debate muscles miss you.",
      "body": "A quick round today keeps the habit alive and gives your next feedback point more signal.",
      "ctaLabel": "Resume practice",
      "dismissLabel": "Not now",
      "dontShowLabel": "Don''t show this again",
      "alt": "Friendly DebateLab mascot carrying a glowing streak flame badge"
    }'::jsonb,
    '{
      "eyebrow": "Giữ nhịp luyện",
      "title": "Kỹ năng debate đang chờ bạn quay lại.",
      "body": "Một vòng nhanh hôm nay giữ thói quen sống tiếp và giúp feedback tiếp theo chính xác hơn.",
      "ctaLabel": "Luyện tiếp",
      "dismissLabel": "Không phải bây giờ",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật DebateLab cầm huy hiệu streak phát sáng"
    }'::jsonb,
    '{"segments":["returning_user"],"minSessions":1,"minDaysSinceLastPractice":3}'::jsonb
  ),
  (
    'weakest-skill',
    'dashboard',
    'active',
    30,
    120,
    3,
    1,
    3,
    '/practice',
    '/images/smart-popups/weakest-skill.webp',
    '{
      "eyebrow": "Coach tip",
      "title": "Your next practice can target {weakestSkill}.",
      "body": "DebateLab found a skill area that will give you the highest return right now.",
      "ctaLabel": "Practice that skill",
      "dismissLabel": "Maybe later",
      "dontShowLabel": "Don''t show this again",
      "alt": "Friendly DebateLab coach mascot pointing at an upward skill chart"
    }'::jsonb,
    '{
      "eyebrow": "Gợi ý từ coach",
      "title": "Phiên tiếp theo có thể tập trung vào {weakestSkill}.",
      "body": "DebateLab tìm thấy một kỹ năng sẽ giúp bạn cải thiện nhanh nhất lúc này.",
      "ctaLabel": "Luyện kỹ năng này",
      "dismissLabel": "Để sau",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật coach DebateLab chỉ vào biểu đồ kỹ năng đi lên"
    }'::jsonb,
    '{"segments":["skill_focus"],"minSessions":2,"requiresWeakestSkill":true}'::jsonb
  ),
  (
    'try-courses',
    'dashboard',
    'active',
    40,
    168,
    3,
    1,
    3,
    '/courses',
    '/images/smart-popups/try-courses.webp',
    '{
      "eyebrow": "Learning path",
      "title": "Pair practice with a guided course.",
      "body": "Structured lessons turn your feedback into a clearer plan for the next round.",
      "ctaLabel": "Explore courses",
      "dismissLabel": "Later",
      "dontShowLabel": "Don''t show this again",
      "alt": "Friendly DebateLab mascot exploring floating books and lesson tiles"
    }'::jsonb,
    '{
      "eyebrow": "Lộ trình học",
      "title": "Kết hợp luyện tập với khóa học bài bản.",
      "body": "Bài học có cấu trúc sẽ biến feedback của bạn thành kế hoạch rõ hơn cho vòng tiếp theo.",
      "ctaLabel": "Xem khóa học",
      "dismissLabel": "Để sau",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật DebateLab khám phá sách và thẻ bài học bay"
    }'::jsonb,
    '{"segments":["course_discovery"],"minSessions":1,"maxCourseProgressCount":0}'::jsonb
  ),
  (
    'ask-coach',
    'dashboard',
    'active',
    50,
    168,
    3,
    1,
    3,
    '/chat?context=coach-home',
    '/images/smart-popups/ask-coach.webp',
    '{
      "eyebrow": "Ask anything",
      "title": "Stuck on a rebuttal?",
      "body": "Your AI Coach can turn a messy idea into a sharper argument before your next speech.",
      "ctaLabel": "Ask AI Coach",
      "dismissLabel": "Later",
      "dontShowLabel": "Don''t show this again",
      "alt": "Friendly DebateLab mascot beside a glowing chat bubble and notebook"
    }'::jsonb,
    '{
      "eyebrow": "Hỏi gì cũng được",
      "title": "Đang bí rebuttal?",
      "body": "AI Coach có thể biến một ý còn rối thành lập luận sắc hơn trước bài nói tiếp theo.",
      "ctaLabel": "Hỏi AI Coach",
      "dismissLabel": "Để sau",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật DebateLab bên bong bóng chat phát sáng và sổ ghi chú"
    }'::jsonb,
    '{"segments":["coach_candidate"],"minSessions":2,"maxCoachEventCount":0}'::jsonb
  )
on conflict (key) do update set
  surface = excluded.surface,
  status = excluded.status,
  priority = excluded.priority,
  cooldown_hours = excluded.cooldown_hours,
  max_impressions_per_user = excluded.max_impressions_per_user,
  daily_cap_per_user = excluded.daily_cap_per_user,
  weekly_cap_per_user = excluded.weekly_cap_per_user,
  cta_href = excluded.cta_href,
  image_path = excluded.image_path,
  copy_en = excluded.copy_en,
  copy_vi = excluded.copy_vi,
  rules = excluded.rules,
  updated_at = now();
