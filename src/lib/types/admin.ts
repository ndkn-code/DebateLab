// Admin Panel Types — Phase 1

export type ActivityType = 'quiz' | 'matching' | 'fill_blank' | 'drag_order' | 'flashcard' | 'lesson';
export type ActivityPhase = 'learn' | 'practice' | 'apply';
export type CourseVisibility = 'public' | 'premium' | 'class_restricted';
export type ModuleAccessLevel = 'free' | 'locked' | 'premium';

export interface AdminCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  category: string;
  difficulty: string;
  estimated_hours: number | null;
  visibility: CourseVisibility;
  is_published: boolean;
  is_free: boolean;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  modules?: AdminCourseModule[];
  enrollment_count?: number;
}

export interface AdminCourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  access_level: ModuleAccessLevel;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  activities?: Activity[];
}

export interface Activity {
  id: string;
  module_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  phase: ActivityPhase;
  order_index: number;
  duration_minutes: number;
  is_archived: boolean;
  content: ActivityContent;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Activity content types
export type ActivityContent =
  | QuizContent
  | MatchingContent
  | FillBlankContent
  | DragOrderContent
  | FlashcardContent
  | LessonContent;

export interface QuizContent {
  questions: {
    id: string;
    question: string;
    type: 'multiple_choice' | 'true_false';
    options: { id: string; text: string }[];
    correctAnswer: string;
    explanation: string;
  }[];
}

export interface MatchingContent {
  pairs: {
    id: string;
    left: string;
    right: string;
  }[];
}

export interface FillBlankContent {
  passages: {
    id: string;
    text: string;
    blanks: {
      id: string;
      answer: string;
      acceptedAnswers?: string[];
      caseSensitive: boolean;
    }[];
  }[];
}

export interface DragOrderContent {
  items: {
    id: string;
    text: string;
    correctOrder: number;
  }[];
  instruction?: string;
}

export interface FlashcardContent {
  cards: {
    id: string;
    front: string;
    back: string;
  }[];
}

export interface LessonContent {
  type: 'article' | 'video';
  body?: string;
  video_url?: string;
  video_duration_seconds?: number;
}

export interface CourseAccessRule {
  id: string;
  course_id: string;
  rule_type: 'individual_user' | 'user_group';
  target_id: string;
  created_by: string | null;
  created_at: string;
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
  time_spent_seconds: number | null;
  responses: Record<string, unknown> | null;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_start: string;
  last_seen_at: string;
  session_end: string | null;
  geo_country: string | null;
  geo_city: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface AnalyticsOverview {
  total_users: number;
  user_growth_pct: number;
  online_users: number;
  total_courses: number;
  total_enrollments: number;
  user_growth: { date: string; count: number }[];
  session_trend: { date: string; count: number }[];
  geo_distribution: { country: string; city?: string; lat: number; lon: number; count: number }[];
  popular_courses: { course_id: string; title: string; enrollment_count: number }[];
  api_usage: { service: string; total_calls: number; total_cost: number }[];
}

export interface ProfileSummary {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
}
