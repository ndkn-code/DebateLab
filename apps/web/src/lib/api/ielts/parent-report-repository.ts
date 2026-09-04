import "server-only";
import { allRows, text, type Db } from "./parent-report-query";
import { attendanceForStudent } from "./parent-report-attendance";
import { historyForStudent } from "./parent-report-history";
export { selectParentAttendanceSessions } from "./parent-report-attendance";

import {
  requireClassManager,
  type ClassManagerClient,
} from "@/lib/api/class-manager-access";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS,
} from "@/lib/api/class-lms/teacher-workspace-capability";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  loadIeltsClassGradebook,
  type IeltsGradebookRow,
} from "./gradebook-repository";
import { normalizeParentBandReport } from "@/lib/ielts/parent-report/model";
import {
  ParentReportInputSchema,
  reportPeriod,
} from "@/lib/ielts/parent-report/request";
import type {
  ParentBandReport,
  ParentReportInput,
  ParentReportRoster,
} from "@/lib/ielts/parent-report/contract";

export interface ParentReportRepositoryDependencies {
  createClient: () => Promise<ClassManagerClient>;
  authorize: typeof requireClassManager;
  createTrustedClient: () => Db;
  loadGradebook: typeof loadIeltsClassGradebook;
}

const runtime: ParentReportRepositoryDependencies = {
  createClient: createTypedServerClient,
  authorize: requireClassManager,
  createTrustedClient: () => createTypedAdminClient() as unknown as Db,
  loadGradebook: loadIeltsClassGradebook,
};

/** Exhaustion is a contract: no successful partial roster at a corrupt cursor. */
export async function collectParentReportRoster(
  loadPage: (
    cursor: string | null,
  ) => Promise<{ rows: IeltsGradebookRow[]; nextCursor: string | null }>,
) {
  const rows = new Map<string, IeltsGradebookRow>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const result = await loadPage(cursor);
    for (const row of result.rows) rows.set(row.userId, row);
    cursor = result.nextCursor;
    if (!cursor) return [...rows.values()];
    if (cursors.has(cursor))
      throw new Error("Parent report roster cursor did not advance");
    cursors.add(cursor);
  }
  throw new Error("Parent report roster limit exceeded");
}

async function authorizedContext(
  classId: string,
  deps: ParentReportRepositoryDependencies,
) {
  const signed = await deps.createClient();
  const manager = await deps.authorize(signed, classId);
  if (!manager.clubId)
    throw new Error("Class is not attached to an organization");
  const db = signed as unknown as Db;
  const [classes, clubs, flags] = await Promise.all([
    allRows(db, "classes", "id, club_id, title, program_type", (q) =>
      q.eq("id", classId).eq("club_id", manager.clubId),
    ),
    allRows(db, "clubs", "id, name, timezone", (q) =>
      q.eq("id", manager.clubId),
    ),
    allRows(
      db,
      "lms_pilot_flags",
      "id, club_id, class_id, feature_key, enabled",
      (q) =>
        q
          .eq("club_id", manager.clubId)
          .in("feature_key", [...TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS]),
    ),
  ]);
  if (classes[0]?.program_type !== "ielts" || !clubs[0])
    throw new Error("IELTS class not available");
  if (
    !resolveTeacherWorkspaceClassFeature({
      flags,
      organizationId: manager.clubId,
      classId,
      programType: "ielts",
    })
  )
    throw new Error("IELTS class workspace is not enabled");
  return {
    db,
    manager,
    classId,
    clubId: manager.clubId,
    className: text(classes[0].title),
    centreName: text(clubs[0].name),
    timeZone: text(clubs[0].timezone) || "Asia/Ho_Chi_Minh",
  };
}

type Context = Awaited<ReturnType<typeof authorizedContext>>;

async function rosterRows(
  context: Context,
  trusted: Db,
  deps: ParentReportRepositoryDependencies,
) {
  return collectParentReportRoster((cursor) =>
    deps.loadGradebook(
      context.db,
      { classId: context.classId, clubId: context.clubId, cursor, limit: 100 },
      trusted,
    ),
  );
}

/** Dependency seam supports authorization tests without touching production. */
export function createParentReportRepository(
  deps: ParentReportRepositoryDependencies,
) {
  return {
    async loadRoster(classId: string): Promise<ParentReportRoster> {
      const context = await authorizedContext(classId, deps);
      // Manager authorization and capability validation precede all trusted reads.
      const trusted = deps.createTrustedClient();
      const rows = await rosterRows(context, trusted, deps);
      return {
        classId,
        className: context.className,
        timeZone: context.timeZone,
        students: rows.map((row) => ({
          id: row.userId,
          name: row.displayName,
        })),
      };
    },
    async loadReport(
      input: ParentReportInput,
      now = new Date(),
    ): Promise<ParentBandReport> {
      const parsed = ParentReportInputSchema.parse(input);
      const context = await authorizedContext(parsed.classId, deps);
      reportPeriod(parsed.month, now, context.timeZone);
      const memberships = await allRows(
        context.db,
        "class_memberships",
        "id, user_id, joined_at, removed_at, status",
        (q) =>
          q
            .eq("class_id", parsed.classId)
            .eq("member_role", "student")
            .eq("user_id", parsed.studentId),
      );
      if (!memberships.length) throw new Error("Student is outside this class");
      // Only now can a trusted client read this student's class-linked history.
      const trusted = deps.createTrustedClient();
      const [rows, history, attendance] = await Promise.all([
        rosterRows(context, trusted, deps),
        historyForStudent(
          trusted,
          context,
          parsed.studentId,
          parsed.month,
          now,
        ),
        attendanceForStudent(
          trusted,
          context,
          parsed.studentId,
          memberships[0],
          parsed.month,
          now,
        ),
      ]);
      const student = rows.find((row) => row.userId === parsed.studentId);
      if (!student) throw new Error("Student is outside the class roster");
      return normalizeParentBandReport(
        {
          period: { month: parsed.month, timeZone: context.timeZone },
          context: {
            classId: context.classId,
            clubId: context.clubId,
            studentId: parsed.studentId,
            studentName: student.displayName,
            className: context.className,
            centreName: context.centreName,
          },
          ...history,
          attendance,
          generatedAt: now.toISOString(),
        },
        now,
      );
    },
  };
}

export const loadParentReportRoster = (classId: string) =>
  createParentReportRepository(runtime).loadRoster(classId);
export const loadParentBandReport = (input: ParentReportInput, now?: Date) =>
  createParentReportRepository(runtime).loadReport(input, now);
