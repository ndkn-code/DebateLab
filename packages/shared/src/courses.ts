export type MobileCourseCategory =
  | "debate"
  | "public-speaking"
  | "argumentation"
  | "rhetoric"
  | "critical-thinking";

export type MobileCourseDifficulty = "beginner" | "intermediate" | "advanced";
export type MobileCourseVisibility = "public" | "premium" | "class_restricted";
export type MobileCourseEnrollmentStatus = "active" | "completed" | "paused";
export type MobileCourseLibraryStatus =
  | "in-progress"
  | "not-started"
  | "completed";
export type MobileCourseModuleAccessLevel = "free" | "locked" | "premium";
export type MobileCourseUnitKind = "lesson" | "activity";
export type MobileCourseLessonType = "article" | "video" | "practice" | "quiz";
export type MobileCourseActivityType =
  | "lesson"
  | "quiz"
  | "matching"
  | "fill_blank"
  | "drag_order"
  | "flashcard";
export type MobileCourseUnitType =
  | MobileCourseLessonType
  | MobileCourseActivityType;
export type MobileCourseActivityPhase = "learn" | "practice" | "apply";
export type MobileCourseUnitLockReason =
  | "module_locked"
  | "premium_required"
  | "course_unavailable"
  | null;

export interface MobileCourseEnrollment {
  id: string;
  courseId: string;
  status: MobileCourseEnrollmentStatus;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
}

export interface MobileCourseLibraryItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: MobileCourseCategory;
  difficulty: MobileCourseDifficulty;
  estimatedHours: number;
  moduleCount: number;
  unitCount: number;
  completedUnitCount: number;
  totalDurationMinutes: number;
  progressPercent: number;
  status: MobileCourseLibraryStatus;
  isEnrolled: boolean;
  visibility: MobileCourseVisibility;
  isFree: boolean;
  nextUnit: MobileCourseUnitSummary | null;
}

export interface MobileCourseLibraryResponse {
  items: MobileCourseLibraryItem[];
  featuredCourse: MobileCourseLibraryItem | null;
  recommendedCourse: MobileCourseLibraryItem | null;
}

export interface MobileCourseModuleSummary {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  accessLevel: MobileCourseModuleAccessLevel;
  locked: boolean;
  lockReason: MobileCourseUnitLockReason;
  units: MobileCourseUnitSummary[];
}

export interface MobileCourseUnitSummary {
  id: string;
  kind: MobileCourseUnitKind;
  type: MobileCourseUnitType;
  title: string;
  description: string | null;
  moduleId: string;
  moduleTitle: string;
  phase: MobileCourseActivityPhase;
  orderIndex: number;
  durationMinutes: number;
  completed: boolean;
  locked: boolean;
  lockReason: MobileCourseUnitLockReason;
}

export interface MobileCourseDetail extends MobileCourseLibraryItem {
  shortDescription: string | null;
  enrollment: MobileCourseEnrollment | null;
  modules: MobileCourseModuleSummary[];
  currentUnit: MobileCourseUnitSummary | null;
}

export interface MobileCourseDetailResponse {
  course: MobileCourseDetail;
}

export interface MobileQuizOption {
  id: string;
  text: string;
}

export interface MobileQuizQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false";
  options: MobileQuizOption[];
  correctAnswer: string;
  explanation: string | null;
}

export interface MobileQuizContent {
  questions: MobileQuizQuestion[];
}

export interface MobileMatchingContent {
  pairs: { id: string; left: string; right: string }[];
}

export interface MobileFillBlankContent {
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

export interface MobileDragOrderContent {
  instruction?: string;
  items: { id: string; text: string; correctOrder: number }[];
}

export interface MobileFlashcardContent {
  cards: { id: string; front: string; back: string }[];
}

export interface MobileLessonContent {
  type: "article" | "video";
  markdown: string | null;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
}

export interface MobilePracticeLessonContent {
  description: string | null;
  practiceConfig: Record<string, unknown>;
}

export type MobileCourseUnitContent =
  | { type: "lesson"; content: MobileLessonContent }
  | { type: "quiz"; content: MobileQuizContent }
  | { type: "matching"; content: MobileMatchingContent }
  | { type: "fill_blank"; content: MobileFillBlankContent }
  | { type: "drag_order"; content: MobileDragOrderContent }
  | { type: "flashcard"; content: MobileFlashcardContent }
  | { type: "practice"; content: MobilePracticeLessonContent };

export interface MobileCourseUnitDetail extends MobileCourseUnitSummary {
  course: Pick<
    MobileCourseDetail,
    "id" | "slug" | "title" | "progressPercent" | "isEnrolled"
  >;
  previousUnit: MobileCourseUnitSummary | null;
  nextUnit: MobileCourseUnitSummary | null;
  content: MobileCourseUnitContent;
}

export interface MobileCourseUnitResponse {
  unit: MobileCourseUnitDetail;
}

export interface MobileCourseEnrollResponse {
  enrollment: MobileCourseEnrollment;
  course: MobileCourseDetail;
  alreadyEnrolled: boolean;
}

export interface MobileCourseUnitStartResponse {
  attemptId: string | null;
  unit: MobileCourseUnitDetail;
  resumed: boolean;
}

export interface MobileCourseUnitCompleteRequest {
  attemptId?: string | null;
  responses?: Record<string, unknown>;
  timeSpentSeconds?: number;
}

export interface MobileCourseUnitCompleteResponse {
  unit: MobileCourseUnitDetail;
  course: MobileCourseDetail;
  score: number | null;
  maxScore: number | null;
  xpEarned: number;
  alreadyCompleted: boolean;
  nextUnit: MobileCourseUnitSummary | null;
}

export interface MobileCourseErrorResponse {
  error: string;
  code: string;
}
