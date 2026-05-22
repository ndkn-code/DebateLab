export type AdminClassStatus = "draft" | "active" | "archived";
export type ClassMembershipRole = "student" | "teacher";
export type ClassMembershipStatus = "active" | "removed";
export type AttendanceStatus = "present" | "late" | "absent";
export type AdminClassProgram = "debate" | "ielts" | "public_speaking";
export type ClassScheduleStatus = "active" | "cancelled" | "archived";
export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
export type RecurrenceEndMode = "never" | "on_date" | "after_occurrences";
export type RecurrenceWeekday = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

export interface AdminClassListRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  programType: AdminClassProgram;
  gradeLevel: string | null;
  status: AdminClassStatus;
  startDate: string | null;
  endDate: string | null;
  meetingSchedule: string | null;
  room: string | null;
  maxStudents: number | null;
  studentCount: number;
  assignedCourseCount: number;
  attendanceRate30d: number | null;
  sessionCount30d: number;
  scheduleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClassesKpis {
  totalClasses: number;
  activeClasses: number;
  totalStudents: number;
  assignedCourses: number;
  attendanceRate30d: number | null;
  sessions30d: number;
}

export interface AdminClassesPageData {
  classes: AdminClassListRow[];
  kpis: AdminClassesKpis;
  page: number;
  pageSize: number;
  totalCount: number;
  pageCount: number;
  filters: {
    search: string;
    status: AdminClassStatus | "all";
    sort: "newest" | "oldest" | "title" | "attendance";
  };
  loadError: string | null;
}

export interface AdminClassProfileSummary {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role?: string | null;
}

export interface AdminClassRosterRow extends AdminClassProfileSummary {
  membershipId: string;
  memberRole: ClassMembershipRole;
  status: ClassMembershipStatus;
  joinedAt: string;
  attendanceRate30d: number | null;
  present30d: number;
  late30d: number;
  absent30d: number;
}

export interface AdminClassAssignedCourse {
  assignmentId: string;
  courseId: string;
  title: string;
  slug: string;
  category: string | null;
  difficulty: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  visibility: string;
  assignedAt: string;
}

export interface AdminClassAttendanceSession {
  id: string;
  classId: string;
  courseId: string;
  courseTitle: string;
  sessionDate: string;
  title: string | null;
  notes: string | null;
  present: number;
  late: number;
  absent: number;
  total: number;
  attendanceRate: number | null;
  createdAt: string;
}

export interface ClassRecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  endMode: RecurrenceEndMode;
  until: string | null;
  count: number | null;
}

export interface AdminClassSchedule {
  id: string;
  classId: string;
  classTitle: string;
  classProgramType: AdminClassProgram;
  classLevel: string | null;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  room: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  recurrenceRule: ClassRecurrenceRule;
  recurrenceSummary: string;
  status: ClassScheduleStatus;
  createdAt: string;
  updatedAt: string;
  occurrenceCount: number;
  nextOccurrenceDate: string | null;
}

export interface AdminClassScheduleOccurrence {
  id: string;
  scheduleId: string;
  classId: string;
  classTitle: string;
  classProgramType: AdminClassProgram;
  classLevel: string | null;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  room: string | null;
  location: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  recurrenceSummary: string;
}

export interface AdminClassSchedulesData {
  schedules: AdminClassSchedule[];
  occurrences: AdminClassScheduleOccurrence[];
  classes: AdminClassListRow[];
  filters: {
    rangeStart: string;
    rangeEnd: string;
    program: AdminClassProgram | "all";
    level: string;
  };
  kpis: {
    upcomingMeetings: number;
    activeSchedules: number;
    scheduledClasses: number;
    weeklyHours: number;
  };
  loadError: string | null;
}

export interface AdminClassDetailData {
  classInfo: AdminClassListRow & {
    teacherUserId: string | null;
    createdBy: string | null;
    metadata: Record<string, unknown>;
  };
  roster: AdminClassRosterRow[];
  assignedCourses: AdminClassAssignedCourse[];
  attendanceSessions: AdminClassAttendanceSession[];
  attendanceGrid: {
    sessions: AdminClassAttendanceSession[];
    students: Array<
      AdminClassRosterRow & {
        attendance: Record<string, AttendanceStatus>;
      }
    >;
  };
  schedules: AdminClassSchedule[];
  scheduleOccurrences: AdminClassScheduleOccurrence[];
  loadError: string | null;
}

export interface AttendanceInputRecord {
  userId: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface SaveAttendanceInput {
  classId: string;
  courseId: string;
  sessionDate: string;
  title?: string | null;
  notes?: string | null;
  records: AttendanceInputRecord[];
}

export interface SaveClassScheduleInput {
  id?: string;
  classId: string;
  courseId?: string | null;
  title: string;
  room?: string | null;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  timezone?: string | null;
  recurrenceRule: Partial<ClassRecurrenceRule>;
}
