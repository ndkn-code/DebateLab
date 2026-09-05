import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  loadTeacherWorkspaceCapability,
  type TeacherWorkspaceCapability,
} from "./teacher-workspace-capability";
import { loadTeacherReviewQueue } from "./teacher-review-queue";

type TeacherWorkspaceDb = SupabaseClient;

export type TeacherSidebarItem = {
  key:
    | "center"
    | "calendar"
    | "classes"
    | "review_queue"
    | "assignments"
    | "gradebook"
    | "attendance"
    | "materials"
    | "announcements"
    | "organization"
    | "people"
    | "curriculum"
    | "reports";
  label: string;
  href: string;
  badge: number | null;
};

export type TeacherSidebarSummary = {
  capability: TeacherWorkspaceCapability;
  classCount: number;
  pendingReviewCount: number;
  pendingHomeworkCount: number;
  unreadNotificationCount: number;
  items: TeacherSidebarItem[];
};

function asDb(client: Awaited<ReturnType<typeof createTypedServerClient>>): TeacherWorkspaceDb {
  return client as unknown as TeacherWorkspaceDb;
}

function navigationItems(reviewCount: number, isHeadTeacher: boolean): TeacherSidebarItem[] {
  const badge = (value: number) => (value > 0 ? value : null);
  return [
    ...(process.env.CENTER_OPERATIONS_V1 === "true" ? [{key:"center",label:"Center operations",href:"/dashboard/teacher/center",badge:null}] : []),
    { key: "calendar", label: "Teaching Calendar", href: "/dashboard/teacher/calendar", badge: null },
    { key: "classes", label: "My Classes", href: "/dashboard/teacher/classes", badge: null },
    { key: "review_queue", label: "Review Queue", href: "/dashboard/teacher/review-queue", badge: badge(reviewCount) },
    { key: "assignments", label: "Assignments", href: "/dashboard/teacher/assignments", badge: null },
    { key: "gradebook", label: "Gradebook", href: "/dashboard/teacher/gradebook", badge: null },
    { key: "attendance", label: "Attendance", href: "/dashboard/teacher/attendance", badge: null },
    { key: "materials", label: "Materials", href: "/dashboard/teacher/materials", badge: null },
    { key: "announcements", label: "Announcements", href: "/dashboard/teacher/announcements", badge: null },
    ...(isHeadTeacher
      ? [
          { key: "organization", label: "Organization", href: "/dashboard/teacher/organization", badge: null },
          { key: "people", label: "People", href: "/dashboard/teacher/people", badge: null },
          { key: "curriculum", label: "Curriculum", href: "/dashboard/teacher/curriculum", badge: null },
          { key: "reports", label: "Reports", href: "/dashboard/teacher/reports", badge: null },
        ]
      : []),
  ] as TeacherSidebarItem[];
}

/**
 * Returns the complete teacher-mode navigation projection.  Counts are read
 * through RLS and are deliberately scoped to capability-approved classes.
 */
export async function loadTeacherSidebarSummary(): Promise<TeacherSidebarSummary> {
  const capability = await loadTeacherWorkspaceCapability();
  const db = asDb(await createTypedServerClient());
  const [reviewQueue, notificationResult] = await Promise.all([
    loadTeacherReviewQueue(),
    db.from("notification_inbox_items").select("id", { count: "exact", head: true })
      .eq("recipient_id", capability.userId).eq("state", "unread"),
  ]);
  if (notificationResult.error) throw new Error(`teacher sidebar notifications: ${notificationResult.error.message}`);
  const pendingReviewCount = reviewQueue.items.filter((item) => item.kind !== "homework").length;
  const pendingHomeworkCount = reviewQueue.items.filter((item) => item.kind === "homework").length;
  const unreadNotificationCount = notificationResult.count ?? 0;
  const reviewCount = pendingReviewCount + pendingHomeworkCount;

  return {
    capability,
    classCount: capability.classes.length,
    pendingReviewCount,
    pendingHomeworkCount,
    unreadNotificationCount,
    items: navigationItems(reviewCount, capability.isHeadTeacher),
  };
}

/** Pure contract helper for consumers that already have the capability/counts. */
export function buildTeacherSidebarSummary(input: {
  capability: TeacherWorkspaceCapability;
  pendingReviewCount?: number;
  pendingHomeworkCount?: number;
  unreadNotificationCount?: number;
}): TeacherSidebarSummary {
  const pendingReviewCount = input.pendingReviewCount ?? 0;
  const pendingHomeworkCount = input.pendingHomeworkCount ?? 0;
  const unreadNotificationCount = input.unreadNotificationCount ?? 0;
  return {
    capability: input.capability,
    classCount: input.capability.classes.length,
    pendingReviewCount,
    pendingHomeworkCount,
    unreadNotificationCount,
    items: navigationItems(
      pendingReviewCount + pendingHomeworkCount,
      input.capability.isHeadTeacher,
    ),
  };
}
