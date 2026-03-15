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
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_hours: number;
  is_published: boolean;
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
  created_at: string;
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

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type:
    | "debate_completed"
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
  average_score: number | null;
  xp_earned: number;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  system_prompt: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_used: number | null;
  created_at: string;
}
