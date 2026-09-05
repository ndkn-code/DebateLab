import { stripAppLocalePrefix } from "./locale-switch";

export const WORKSPACE_MODE_COOKIE = "thinkfy_workspace_mode";
export type WorkspaceMode = "learner" | "teacher" | "admin";

export function routeIsWithin(pathname: string, root: string) {
  const path = stripAppLocalePrefix(pathname).split(/[?#]/, 1)[0];
  return path === root || path.startsWith(`${root}/`);
}

export function getWorkspaceMode(pathname: string): WorkspaceMode {
  if (routeIsWithin(pathname, "/dashboard/teacher")) return "teacher";
  if (routeIsWithin(pathname, "/dashboard/admin")) return "admin";
  return "learner";
}

/** Browser history is a convenience only. Server routes still authorize every visit. */
export function safeTeacherReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  ) {
    return "/dashboard/teacher";
  }
  const normalized = new URL(value, "https://thinkfy.invalid");
  const path = stripAppLocalePrefix(normalized.pathname);
  return routeIsWithin(path, "/dashboard/teacher")
    ? `${path}${normalized.search}${normalized.hash}`
    : "/dashboard/teacher";
}

export function shouldAutoEnterTeacherWorkspace(
  canAutoEnter: boolean,
  chosenMode?: string,
) {
  return canAutoEnter && chosenMode !== "learner";
}
