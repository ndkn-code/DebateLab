import type { AdminClassListRow } from "@/lib/types/admin-classes";

export type ClubRole = "owner" | "coach" | "student";
export type ClubStatus = "draft" | "active" | "archived";
export type ClubType = "school" | "center" | "independent" | "online";
export type ClubAssignmentStatus = "draft" | "active" | "archived";
export type ClubAssignmentTrack = "debate" | "speaking" | "mun";
export type ClubAssignmentType = "practice" | "case" | "speech" | "quiz" | "attendance";
export type CoachReviewStatus = "open" | "resolved";
export type ClubQaState = "empty" | "active" | "high" | "low" | "mixed";

export interface AdminClubListRow {
  id: string;
  code: string;
  name: string;
  clubType: ClubType;
  city: string | null;
  country: string;
  status: ClubStatus;
  timezone: string;
  classCount: number;
  studentCount: number;
  coachCount: number;
  assignmentCount: number;
  completionRate30d: number | null;
  attendanceRate30d: number | null;
  averageScore30d: number | null;
  reviewQueueCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClubsKpis {
  totalClubs: number;
  activeClubs: number;
  totalStudents: number;
  reviewQueueCount: number;
  averageCompletionRate30d: number | null;
}

export interface AdminClubsPageData {
  clubs: AdminClubListRow[];
  kpis: AdminClubsKpis;
  qaEnabled: boolean;
  qaState: ClubQaState | null;
  loadError: string | null;
}

export interface AdminClubMember {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: ClubRole;
  status: "active" | "removed";
  joinedAt: string;
}

export interface AdminClubAssignmentRow {
  id: string;
  clubId: string;
  classId: string | null;
  classTitle: string | null;
  title: string;
  description: string | null;
  assignmentType: ClubAssignmentType;
  assignedTrack: ClubAssignmentTrack;
  topicTitle: string | null;
  topicCategory: string | null;
  dueAt: string | null;
  requiredAttempts: number;
  rubricKey: string;
  rubricVersion: number;
  status: ClubAssignmentStatus;
  submissionCount: number;
  uniqueSubmitters: number;
  averageScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClubPerformanceAttempt {
  id: string;
  userId: string;
  studentName: string;
  clubId: string | null;
  classId: string | null;
  classTitle: string | null;
  assignmentId: string | null;
  assignmentTitle: string | null;
  practiceTrack: ClubAssignmentTrack;
  format: string | null;
  topicTitle: string | null;
  durationSeconds: number | null;
  wordCount: number | null;
  overallScore: number | null;
  overallBand: string | null;
  skillScores: Record<string, number>;
  occurredAt: string;
}

export interface AdminClubReviewQueueItem {
  id: string;
  attemptId: string;
  studentName: string;
  title: string;
  cohort: string | null;
  priority: "high" | "medium" | "low";
  submittedAt: string;
  status: CoachReviewStatus;
}

export interface AdminClubAtRiskStudent {
  userId: string;
  displayName: string;
  cohort: string | null;
  riskScore: number;
  completionRate: number | null;
  attendanceRate: number | null;
  averageScore: number | null;
}

export interface AdminClubSkillSummary {
  key: string;
  label: string;
  value: number;
}

export interface AdminClubTrendPoint {
  label: string;
  averageScore: number | null;
  completionRate: number | null;
}

export interface AdminClubDashboardKpis {
  completionRate: number | null;
  attendanceRate: number | null;
  averageScore: number | null;
  reviewQueueCount: number;
  studentCount: number;
  cohortCount: number;
}

export interface AdminClubDetailData {
  club: AdminClubListRow;
  kpis: AdminClubDashboardKpis;
  members: AdminClubMember[];
  cohorts: AdminClassListRow[];
  assignments: AdminClubAssignmentRow[];
  attempts: AdminClubPerformanceAttempt[];
  reviewQueue: AdminClubReviewQueueItem[];
  atRiskStudents: AdminClubAtRiskStudent[];
  weakestSkills: AdminClubSkillSummary[];
  trend: AdminClubTrendPoint[];
  qaEnabled: boolean;
  qaState: ClubQaState | null;
  loadError: string | null;
}

export interface ClubAssignmentInput {
  clubId: string;
  classId?: string | null;
  title: string;
  description?: string | null;
  assignmentType?: ClubAssignmentType;
  assignedTrack?: ClubAssignmentTrack;
  topicTitle?: string | null;
  topicCategory?: string | null;
  dueAt?: string | null;
  requiredAttempts?: number;
  rubricKey?: string;
  rubricVersion?: number;
  status?: ClubAssignmentStatus;
}
