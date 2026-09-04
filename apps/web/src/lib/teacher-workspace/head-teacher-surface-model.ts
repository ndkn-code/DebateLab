import type {
  HeadTeacherWorkspaceSurface,
  TeacherWorkspacePresentation,
} from "./presentation";

export interface HeadTeacherClassRow {
  id: string;
  title: string;
  programType: "ielts" | "debate" | "public_speaking";
  studentCount: number;
  nextLessonAt: string | null;
  completion: number;
  attendanceRate: number;
  pendingReviews: number;
  assignmentCount: number;
  materialCount: number;
}

export interface HeadTeacherPersonRow {
  id: string;
  name: string;
  role: "student";
  attendance: "present" | "late" | "absent" | "unmarked" | "unrecorded";
  scoredAssessments: number;
  pendingAssessments: number;
}

export interface HeadTeacherSurfaceModel {
  surface: HeadTeacherWorkspaceSurface;
  classes: HeadTeacherClassRow[];
  people: HeadTeacherPersonRow[];
  totals: {
    classes: number;
    learners: number;
    pendingReviews: number;
    assignments: number;
    materials: number;
    announcements: number;
    averageAttendance: number | null;
    averageCompletion: number | null;
  };
}

export function buildHeadTeacherSurfaceModel(
  data: TeacherWorkspacePresentation,
  surface: HeadTeacherWorkspaceSurface,
): HeadTeacherSurfaceModel {
  const classes = data.classes.map((item) => ({
    id: item.id,
    title: item.title,
    programType: item.programType,
    studentCount: item.studentCount,
    nextLessonAt: item.nextLessonAt,
    completion: item.completion,
    attendanceRate: item.attendanceRate,
    pendingReviews: item.pendingReviews,
    assignmentCount: data.assignments.filter(
      (assignment) => assignment.classId === item.id,
    ).length,
    materialCount: data.materials.filter(
      (material) => material.classId === item.id,
    ).length,
  }));
  const attendanceByStudent = new Map(
    data.attendance.students.map((item) => [item.id, item.status]),
  );
  const people: HeadTeacherPersonRow[] = data.gradebook.students.map(
    (student) => {
      const scores = Object.values(data.gradebook.scores[student.id] ?? {});
      return {
        id: student.id,
        name: student.name,
        role: "student" as const,
        attendance: attendanceByStudent.get(student.id) ?? "unrecorded",
        scoredAssessments: scores.filter((score) => typeof score === "number")
          .length,
        pendingAssessments: scores.filter((score) => typeof score !== "number")
          .length,
      };
    },
  );
  const average = (values: number[]) =>
    values.length === 0
      ? null
      : Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        );

  return {
    surface,
    classes,
    people,
    totals: {
      classes: classes.length,
      learners:
        people.length ||
        classes.reduce((sum, item) => sum + item.studentCount, 0),
      pendingReviews: data.reviews.filter(
        (item) => item.status === "needs_review",
      ).length,
      assignments: data.assignments.length,
      materials: data.materials.length,
      announcements: data.announcements.length,
      averageAttendance: average(classes.map((item) => item.attendanceRate)),
      averageCompletion: average(classes.map((item) => item.completion)),
    },
  };
}
