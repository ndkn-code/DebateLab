import type { AdminClassListRow, ClassRecurrenceRule } from "@/lib/types/admin-classes";
import type { LeaderboardSafetyAuditData } from "@/lib/leaderboards/types";

export type ClubRole = "owner" | "coach" | "student";
export type ClubStatus = "draft" | "active" | "archived";
export type ClubType = "school" | "center" | "independent" | "online";
export type ClubAssignmentStatus = "draft" | "active" | "archived";
export type ClubAssignmentTrack = "debate" | "speaking" | "mun";
export type ClubAssignmentType = "practice" | "case" | "speech" | "quiz" | "attendance";
export type CoachReviewStatus = "open" | "resolved";
export type ClubQaState = "empty" | "active" | "high" | "low" | "mixed";
export type ClubInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type ClubJoinCodeStatus = "pending" | "redeemed" | "revoked" | "expired";
export type ClubInviteResultStatus = "invited" | "added" | "existing_member" | "missing_account" | "email_skipped" | "failed";
export type ClubEventType = "meeting" | "workshop" | "tournament" | "social" | "deadline" | "other";
export type ClubEventStatus = "active" | "cancelled" | "archived";

export interface AdminClubListRow {
  id: string;
  code: string;
  name: string;
  clubType: ClubType;
  city: string | null;
  country: string;
  status: ClubStatus;
  timezone: string;
  logoUrl: string | null;
  logoStoragePath: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  threadsUrl: string | null;
  classCount: number;
  studentCount: number;
  coachCount: number;
  assignmentCount: number;
  upcomingEventCount: number;
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

export interface AdminClubInvitation {
  id: string;
  clubId: string;
  email: string;
  role: ClubRole;
  status: ClubInvitationStatus;
  expiresAt: string;
  invitedBy: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClubJoinCode {
  id: string;
  clubId: string;
  status: ClubJoinCodeStatus;
  role: "student";
  expiresAt: string;
  issuedBy: string | null;
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClubRecipientInput {
  email: string;
  role: ClubRole;
}

export interface ClubRecipientResult {
  email: string;
  role: ClubRole;
  status: ClubInviteResultStatus;
  invitationId?: string | null;
  userId?: string | null;
  message?: string | null;
}

export interface CreateClubResult {
  clubId: string;
  recipients: ClubRecipientResult[];
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
  isHomework: boolean;
  submissionTextEnabled: boolean;
  submissionFilesEnabled: boolean;
  submissionMaxFiles: number;
  submissionMaxFileMb: number;
  submissionAllowedExt: string[] | null;
  submissionInstructions: string | null;
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
  invitations: AdminClubInvitation[];
  joinCodes: AdminClubJoinCode[];
  events: AdminClubEvent[];
  eventOccurrences: AdminClubEventOccurrence[];
  leaderboardSafety: LeaderboardSafetyAuditData;
  organizationJoinCodesEnabled: boolean;
  qaEnabled: boolean;
  qaState: ClubQaState | null;
  loadError: string | null;
}

export interface AdminClubEvent {
  id: string;
  clubId: string;
  classId: string | null;
  classTitle: string | null;
  title: string;
  eventType: ClubEventType;
  room: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  recurrenceRule: ClassRecurrenceRule;
  recurrenceSummary: string;
  externalCalendarUrl: string | null;
  externalProvider: string | null;
  status: ClubEventStatus;
  createdAt: string;
  updatedAt: string;
  occurrenceCount: number;
  nextOccurrenceDate: string | null;
}

export interface AdminClubEventOccurrence {
  id: string;
  eventId: string;
  clubId: string;
  classId: string | null;
  classTitle: string | null;
  title: string;
  eventType: ClubEventType;
  room: string | null;
  location: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  recurrenceSummary: string;
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
  submissionTextEnabled?: boolean;
  submissionFilesEnabled?: boolean;
  submissionMaxFiles?: number;
  submissionMaxFileMb?: number;
  submissionAllowedExt?: string[] | null;
  submissionInstructions?: string | null;
}

export interface SaveClubEventInput {
  id?: string;
  clubId: string;
  classId?: string | null;
  title: string;
  eventType?: ClubEventType;
  room?: string | null;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  timezone?: string | null;
  recurrenceRule: Partial<ClassRecurrenceRule>;
}
