export type AdminClassStatus = "draft" | "active" | "archived";
export type ClassMembershipRole = "student" | "teacher";
export type ClassMembershipStatus = "active" | "removed";
export type AttendanceStatus = "present" | "late" | "absent";

export interface AdminClassListRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
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
