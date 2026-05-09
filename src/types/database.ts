import type { SettingsPreferences } from "@/lib/settings";
import type { CoachMessageMetadata } from "./coach";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: "student" | "teacher" | "admin";
  streak_current: number;
  streak_longest: number;
  streak_last_active_date: string | null;
  total_practice_minutes: number;
  total_sessions_completed: number;
  xp: number;
  level: number;
  onboarding_completed: boolean;
  preferences: SettingsPreferences;
  selected_title: string | null;
  unlocked_titles: string[];
  banner_color: string;
  referral_code: string | null;
  orb_balance: number;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_hours: number;
  is_published: boolean;
  visibility: "public" | "premium" | "class_restricted";
  is_free: boolean;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  sort_order: number;
  access_level: "free" | "locked" | "premium";
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  type: "video" | "article" | "quiz" | "practice";
  content: Record<string, unknown>;
  video_url: string | null;
  duration_minutes: number;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  lesson_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "open_ended";
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  order_index: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "completed" | "paused";
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string | null;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  time_spent_seconds: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebateSessionRow {
  id: string;
  user_id: string;
  topic_id: string | null;
  topic_title: string;
  topic_category: string;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  side: "proposition" | "opposition";
  mode: "quick" | "full";
  prep_time: number;
  speech_time: number;
  transcript: string;
  prep_notes: string | null;
  ai_difficulty: "easy" | "medium" | "hard" | null;
  rounds: Record<string, unknown>[] | null;
  feedback: Record<string, unknown> | null;
  total_score: number | null;
  overall_band: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface PracticeSessionDraftRow {
  id: string;
  user_id: string;
  topic_id: string | null;
  topic_title: string;
  topic_category: string;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  side: "proposition" | "opposition";
  practice_track: "speaking" | "debate";
  mode: "quick" | "full";
  prep_time: number;
  speech_time: number;
  ai_difficulty: "easy" | "medium" | "hard" | null;
  current_phase: string;
  current_round: number;
  prep_notes: string;
  transcript: string;
  rounds: Record<string, unknown>[] | null;
  session_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type:
    | "debate_completed"
    | "course_started"
    | "lesson_completed"
    | "quiz_completed"
    | "course_enrolled"
    | "course_completed"
    | "streak_milestone"
    | "level_up";
  reference_id: string | null;
  reference_type: string | null;
  xp_earned: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  sessions_completed: number;
  practice_minutes: number;
  minutes_studied: number;
  average_score: number | null;
  xp_earned: number;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  context_type?: string | null;
  context_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: CoachMessageMetadata | null;
  tokens_used: number | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  status: "pending" | "qualified" | "credited" | "rejected";
  referrer_orbs_awarded: number;
  referee_orbs_awarded: number;
  qualified_at: string | null;
  credited_at: string | null;
  created_at: string;
}

export interface OrbTransaction {
  id: string;
  user_id: string;
  amount: number;
  type:
    | "signup_bonus"
    | "referral_reward"
    | "referral_bonus"
    | "practice_quick"
    | "practice_full"
    | "practice_speaking"
    | "practice_debate"
    | "duel_entry"
    | "admin_grant";
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface Activity {
  id: string;
  module_id: string;
  activity_type:
    | "lesson"
    | "quiz"
    | "matching"
    | "fill_blank"
    | "drag_order"
    | "flashcard";
  title: string;
  description: string | null;
  phase: "learn" | "practice" | "apply";
  order_index: number;
  duration_minutes: number;
  is_archived: boolean;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivityAttempt {
  id: string;
  user_id: string;
  activity_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  max_score: number | null;
  is_passed: boolean | null;
  attempt_number: number;
  time_spent_seconds: number;
  responses: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: "free" | "premium" | "enterprise";
  status: "active" | "trial" | "cancelled" | "expired" | "past_due" | "pending";
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureUsage {
  id: string;
  user_id: string;
  feature_name: string;
  period_start: string;
  period_end: string;
  used_count: number;
  limit_count: number | null;
  last_used_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiUsage {
  id: string;
  user_id: string | null;
  service: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  input_unit: string | null;
  output_unit: string | null;
  duration_ms: number | null;
  estimated_cost_usd: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string;
  session_id: string | null;
  event_name:
    | "page_view"
    | "page_leave"
    | "course_started"
    | "module_viewed"
    | "activity_started"
    | "activity_completed"
    | "practice_completed"
    | "duel_completed"
    | "ai_feedback_requested"
    | "ai_feedback_completed"
    | "web_vital_recorded"
    | "admin_grant_created"
    | "admin_grant_cancelled";
  feature_area:
    | "courses"
    | "activities"
    | "practice"
    | "duels"
    | "ai_feedback"
    | "admin"
    | "profile";
  route: string | null;
  duration_ms: number | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  source: "web" | "server" | "admin" | "system";
  created_at: string;
}

export interface AiInsightsCache {
  id: string;
  cache_key: string;
  scope: string;
  target_user_id: string | null;
  range_key: string | null;
  model: string | null;
  prompt_hash: string | null;
  insights: Record<string, unknown>;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebateDuelRow {
  id: string;
  share_code: string;
  creator_id: string;
  topic_title: string;
  topic_category: string;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  topic_description: string | null;
  prep_time_seconds: number;
  opening_time_seconds: number;
  rebuttal_time_seconds: number;
  entry_cost: number;
  side_assignment_mode: "random" | "choose";
  creator_side_preference: "proposition" | "opposition" | null;
  status:
    | "lobby"
    | "in_progress"
    | "judging"
    | "completed"
    | "expired"
    | "cancelled";
  current_phase:
    | "lobby"
    | "prep"
    | "proposition-opening"
    | "opposition-opening"
    | "rebuttal-prep"
    | "proposition-rebuttal"
    | "opposition-rebuttal"
    | "judging"
    | "completed";
  phase_started_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}
