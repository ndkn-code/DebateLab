export function isTeacherWorkspaceAccessBoundaryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message === "Unauthorized" ||
    /\bForbidden\b/i.test(message) ||
    /\bAuth session missing\b/i.test(message)
  );
}
