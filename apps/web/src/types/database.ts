import type { SettingsPreferences } from "@/lib/settings";
import type { CoachMessageMetadata } from "./coach";
import type { DebateScore, PracticeLanguage, PracticeTrack } from "./feedback";
import type { AiDifficulty, DebateRound } from "./debate";
import type {
  AiQualityFairness,
  AiQualityOutputType,
  AiQualityReasonTag,
  AiQualityReviewStatus,
  AiQualityUsefulness,
} from "@/lib/ai/quality-model";

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

export interface SupportIssueReportRow {
  id: string;
  tally_event_id: string;
  tally_response_id: string | null;
  tally_submission_id: string | null;
  tally_form_id: string | null;
  tally_form_name: string | null;
  user_id: string | null;
  user_email: string | null;
  locale: string | null;
  route: string | null;
  source: string;
  issue_type: string | null;
  severity: string | null;
  title: string | null;
  description: string | null;
  expected_behavior: string | null;
  steps_to_reproduce: string | null;
  contact_permission: string | null;
  attachments: Record<string, unknown>[];
  environment: Record<string, unknown>;
  hidden_fields: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  status: "new" | "triaged" | "in_progress" | "resolved" | "closed";
  submitted_at: string | null;
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
  practice_topic_key: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key: string | null;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  side: "proposition" | "opposition";
  practice_track: "speaking" | "debate";
  practice_language: PracticeLanguage;
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
  practice_topic_key: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key: string | null;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  side: "proposition" | "opposition";
  practice_track: "speaking" | "debate";
  practice_language: PracticeLanguage;
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

export interface PracticeAttemptRow {
  id: string;
  user_id: string;
  status: "draft" | "submitted" | "analyzing" | "completed" | "failed";
  practice_track: PracticeTrack;
  practice_language: PracticeLanguage;
  topic_id: string | null;
  practice_topic_key: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key: string | null;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  side: "proposition" | "opposition";
  mode: "quick" | "full";
  prep_time: number;
  speech_time: number;
  duration_seconds: number;
  transcript: string;
  prep_notes: string | null;
  ai_difficulty: AiDifficulty | null;
  rounds: DebateRound[] | null;
  audio_storage_path: string | null;
  attempt_snapshot: Record<string, unknown>;
  input_hash: string | null;
  prompt_hash: string | null;
  prompt_bundle_key: string;
  prompt_bundle_version: number;
  rubric_key: string;
  rubric_version: number;
  model_provider: string | null;
  model_name: string | null;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  legacy_debate_session_id: string | null;
  error_code: string | null;
  error_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisJobRow {
  id: string;
  attempt_id: string;
  user_id: string;
  job_type: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  queue_topic: string;
  queue_message_id: string | null;
  idempotency_key: string;
  delivery_count: number;
  max_attempts: number;
  input_hash: string | null;
  prompt_hash: string | null;
  model_provider: string | null;
  model_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  next_retry_at: string | null;
  error_code: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
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

export interface AiQualityRun {
  id: string;
  user_id: string;
  output_type: AiQualityOutputType;
  status: "success" | "error";
  review_status: AiQualityReviewStatus;
  source_route: string | null;
  provider: string;
  requested_provider: string | null;
  model: string;
  prompt_bundle_key: string | null;
  prompt_bundle_version: number | null;
  prompt_hash: string | null;
  rubric_key: string | null;
  rubric_version: number | null;
  practice_track: PracticeTrack | null;
  practice_language: PracticeLanguage | null;
  difficulty: string | null;
  debate_format: string | null;
  side: "proposition" | "opposition" | null;
  ai_side: "proposition" | "opposition" | null;
  topic_title: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_cost_usd: number;
  fallback_used: boolean;
  error_code: string | null;
  error_message: string | null;
  winner: "user" | "ai" | "tie" | "proposition" | "opposition" | null;
  score: number | null;
  confidence: number | null;
  output_preview: string | null;
  output_text: string | null;
  input_preview: string | null;
  practice_attempt_id: string | null;
  analysis_job_id: string | null;
  debate_session_id: string | null;
  debate_duel_id: string | null;
  debate_duel_judgment_id: string | null;
  metadata: Record<string, unknown>;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiQualityRating {
  id: string;
  run_id: string;
  user_id: string;
  usefulness: AiQualityUsefulness | null;
  fairness: AiQualityFairness | null;
  reason_tags: AiQualityReasonTag[];
  comment: string | null;
  locale: PracticeLanguage | null;
  route: string | null;
  created_at: string;
  updated_at: string;
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
    | "admin_grant_cancelled"
    | "club_assignment_created"
    | "club_assignment_started"
    | "club_assignment_submitted"
    | "club_review_created"
    | "popup_impression"
    | "popup_dismissed"
    | "popup_cta_clicked"
    | "popup_dont_show_again"
    | "popup_survey_started"
    | "popup_survey_submitted"
    | "popup_survey_abandoned";
  feature_area:
    | "courses"
    | "activities"
    | "practice"
    | "duels"
    | "ai_feedback"
    | "admin"
    | "clubs"
    | "profile"
    | "notifications";
  route: string | null;
  duration_ms: number | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  source: "web" | "server" | "admin" | "system";
  created_at: string;
}

export interface SmartPopupCampaign {
  id: string;
  key: string;
  surface: "dashboard" | "global";
  status: "active" | "paused" | "archived";
  campaign_type: "feature_nudge" | "feedback_survey";
  delivery_mode: "targeted" | "send_now" | "scheduled";
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  cooldown_hours: number;
  max_impressions_per_user: number;
  daily_cap_per_user: number;
  weekly_cap_per_user: number;
  reward_credits: number;
  response_goal: number | null;
  cta_href: string;
  image_path: string;
  copy_en: Record<string, unknown>;
  copy_vi: Record<string, unknown>;
  rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartPopupUserState {
  user_id: string;
  segment: string;
  traits: Record<string, unknown>;
  campaign_state: Record<string, unknown>;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartPopupEvent {
  id: string;
  user_id: string;
  campaign_key: string;
  event_type:
    | "impression"
    | "dismissed"
    | "cta_clicked"
    | "dont_show_again"
    | "survey_started"
    | "survey_submitted"
    | "survey_abandoned";
  surface: string;
  route: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface SmartPopupSurveyVersion {
  id: string;
  campaign_key: string;
  version: number;
  questions: Record<string, unknown>[];
  thank_you_copy: Record<string, unknown>;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
}

export interface SmartPopupSurveyResponse {
  id: string;
  user_id: string;
  campaign_key: string;
  survey_version_id: string;
  impression_event_id: string | null;
  submission_key: string;
  locale: "en" | "vi";
  answers: Record<string, unknown>[];
  context: Record<string, unknown>;
  reward_credits_awarded: number;
  rewarded_at: string | null;
  submitted_at: string;
  created_at: string;
}

export interface SmartPopupCronRun {
  id: string;
  job_key: string;
  status: "started" | "success" | "error";
  started_at: string;
  finished_at: string | null;
  processed_users: number;
  generated_opportunities: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
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
  practice_topic_key: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key: string | null;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  topic_description: string | null;
  practice_language: PracticeLanguage;
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
