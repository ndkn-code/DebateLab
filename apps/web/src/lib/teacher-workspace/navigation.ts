import type { TeacherWorkspaceNavigationItem } from "./presentation";
import { stripAppLocalePrefix } from "../locale-switch";
import { routeIsWithin } from "../workspace-navigation";

/** Adapted from Lumist ManagerSidebarConfig's ordered, permission-filtered groups. */
export const TEACHER_NAV_GROUPS = [
  {
    key: "teaching",
    items: ["calendar", "classes", "attendance", "announcements"],
  },
  { key: "assessment", items: ["review_queue", "assignments", "gradebook"] },
  { key: "preparation", items: ["materials"] },
  {
    key: "management",
    items: ["center", "organization", "people", "curriculum", "reports"],
  },
] as const;

export function teacherNavigationGroups(
  items: TeacherWorkspaceNavigationItem[],
) {
  return TEACHER_NAV_GROUPS.map((group) => ({
    key: group.key,
    items: group.items.flatMap((key) =>
      items.filter((item) => item.key === key),
    ),
  })).filter((group) => group.items.length > 0);
}

export function activeTeacherNavigationKey(
  pathname: string,
  items: TeacherWorkspaceNavigationItem[],
) {
  if (stripAppLocalePrefix(pathname) === "/dashboard/teacher")
    return items.find((item) => item.key === "calendar")?.key;
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => routeIsWithin(pathname, item.href))?.key;
}

/** Only shared workspace filters cross surfaces; page-specific filters stay on their page. */
export function teacherNavigationHref(href: string, search: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of ["organization", "demo"] as const) {
    const value = search.get(key);
    if (value && (key !== "demo" || value === "teacher")) query.set(key, value);
  }
  return `${href}${query.size ? `?${query}` : ""}`;
}

/** Recent visits are browser-local hints; intersect them with current server access. */
export function teacherClassShortcuts<T extends { id: string }>(
  classes: T[],
  recentIds: string[],
  currentId?: string,
): T[] {
  const ids = [
    ...new Set([
      ...(currentId ? [currentId] : []),
      ...recentIds,
      ...classes.map((item) => item.id),
    ]),
  ];
  const byId = new Map(classes.map((item) => [item.id, item]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])).slice(0, 3);
}
