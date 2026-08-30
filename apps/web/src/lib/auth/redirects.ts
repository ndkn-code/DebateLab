const ALLOWED_REDIRECT_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/courses",
  "/settings",
  "/profile",
  "/practice",
  "/chat",
  "/history",
  "/join/club",
  "/ielts",
] as const;

export function isAllowedAuthRedirect(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://") || path.includes("\\")) return false;

  return ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

export function resolveAuthRedirect(path: string | null | undefined): string {
  return path && isAllowedAuthRedirect(path) ? path : "/dashboard";
}
