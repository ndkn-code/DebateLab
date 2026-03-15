-- ============================================================
-- DebateLab Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  streak_current integer not null default 0,
  streak_longest integer not null default 0,
  streak_last_active_date date,
  total_practice_minutes integer not null default 0,
  total_sessions_completed integer not null default 0,
  xp integer not null default 0,
  level integer not null default 1,
  onboarding_completed boolean not null default false,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. COURSES
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  thumbnail_url text,
  category text not null default '',
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_hours numeric not null default 0,
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;
create policy "Anyone can view published courses" on public.courses for select using (is_published = true);

-- 3. COURSE MODULES
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.course_modules enable row level security;
create policy "Anyone can view course modules" on public.course_modules for select using (true);

-- 4. LESSONS
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  slug text not null,
  type text not null check (type in ('video', 'article', 'quiz', 'practice')),
  content jsonb not null default '{}',
  video_url text,
  duration_minutes integer not null default 5,
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons enable row level security;
create policy "Anyone can view published lessons" on public.lessons for select using (is_published = true);

-- 5. QUIZ QUESTIONS
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'multiple_choice' check (question_type in ('multiple_choice', 'true_false', 'open_ended')),
  options jsonb,
  correct_answer text not null,
  explanation text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quiz_questions enable row level security;
create policy "Anyone can view quiz questions" on public.quiz_questions for select using (true);

-- 6. ENROLLMENTS
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  progress_percent integer not null default 0,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, course_id)
);

alter table public.enrollments enable row level security;
create policy "Users can view own enrollments" on public.enrollments for select using (auth.uid() = user_id);
create policy "Users can insert own enrollments" on public.enrollments for insert with check (auth.uid() = user_id);
create policy "Users can update own enrollments" on public.enrollments for update using (auth.uid() = user_id);

-- 7. LESSON PROGRESS
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  score integer,
  time_spent_seconds integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;
create policy "Users can view own progress" on public.lesson_progress for select using (auth.uid() = user_id);
create policy "Users can insert own progress" on public.lesson_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on public.lesson_progress for update using (auth.uid() = user_id);

-- 8. DEBATE SESSIONS
create table if not exists public.debate_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid,
  topic_title text not null,
  topic_category text not null,
  topic_difficulty text not null default 'beginner',
  side text not null check (side in ('proposition', 'opposition')),
  mode text not null check (mode in ('quick', 'full')),
  prep_time integer not null default 0,
  speech_time integer not null default 0,
  transcript text not null default '',
  prep_notes text,
  ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard')),
  rounds jsonb,
  feedback jsonb,
  total_score integer,
  overall_band text,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.debate_sessions enable row level security;
create policy "Users can view own sessions" on public.debate_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.debate_sessions for insert with check (auth.uid() = user_id);
create policy "Users can delete own sessions" on public.debate_sessions for delete using (auth.uid() = user_id);

-- 9. ACTIVITY LOGS
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  reference_id uuid,
  reference_type text,
  xp_earned integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;
create policy "Users can view own logs" on public.activity_log for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on public.activity_log for insert with check (auth.uid() = user_id);

-- 10. DAILY STATS
create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sessions_completed integer not null default 0,
  practice_minutes integer not null default 0,
  average_score integer,
  xp_earned integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_stats enable row level security;
create policy "Users can view own stats" on public.daily_stats for select using (auth.uid() = user_id);
create policy "Users can insert own stats" on public.daily_stats for insert with check (auth.uid() = user_id);
create policy "Users can update own stats" on public.daily_stats for update using (auth.uid() = user_id);

-- 11. CHAT CONVERSATIONS
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  model text not null default '',
  system_prompt text,
  message_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;
create policy "Users can view own conversations" on public.chat_conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations" on public.chat_conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on public.chat_conversations for update using (auth.uid() = user_id);
create policy "Users can delete own conversations" on public.chat_conversations for delete using (auth.uid() = user_id);

-- 12. CHAT MESSAGES
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_used integer,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
create policy "Users can view own messages" on public.chat_messages for select
  using (conversation_id in (select id from public.chat_conversations where user_id = auth.uid()));
create policy "Users can insert own messages" on public.chat_messages for insert
  with check (conversation_id in (select id from public.chat_conversations where user_id = auth.uid()));
create policy "Users can delete own messages" on public.chat_messages for delete
  using (conversation_id in (select id from public.chat_conversations where user_id = auth.uid()));

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_enrollments_user on public.enrollments(user_id);
create index if not exists idx_lesson_progress_user on public.lesson_progress(user_id);
create index if not exists idx_debate_sessions_user on public.debate_sessions(user_id, created_at desc);
create index if not exists idx_activity_log_user on public.activity_log(user_id, created_at desc);
create index if not exists idx_daily_stats_user_date on public.daily_stats(user_id, date);
create index if not exists idx_chat_conversations_user on public.chat_conversations(user_id, last_message_at desc);
create index if not exists idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at);
create index if not exists idx_course_modules_course on public.course_modules(course_id, order_index);
create index if not exists idx_lessons_module on public.lessons(module_id, order_index);
