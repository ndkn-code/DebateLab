export const CLASS_JOIN_STATUSES = [
  "ready",
  "joined",
  "already_joined",
  "invalid",
  "expired",
  "revoked",
  "exhausted",
  "archived",
  "full",
  "ineligible",
  "organization_required",
  "forbidden",
  "stale",
  "unavailable",
  "sign_in_required",
] as const;
export type ClassJoinStatus = (typeof CLASS_JOIN_STATUSES)[number];
export interface ClassJoinResult {
  status: ClassJoinStatus;
  classId?: string;
  classTitle?: string;
  organizationName?: string;
  programType?: string;
  expiresAt?: string;
}
export interface ClassInvitation {
  id: string;
  code: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  revokedAt: string | null;
}
export interface ClassInvitationResult {
  status?: ClassJoinStatus;
  invitation?: ClassInvitation | null;
}
export type ClassInvitationAction = "get" | "create" | "replace" | "revoke";
export function normalizeClassJoinCode(value: string): string {
  return value.trim().replace(/[\s-]/g, "").toLowerCase();
}
export function isClassJoinCode(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}
export function classJoinPath(code: string, locale: string): string {
  return `/${locale === "en" ? "en" : "vi"}/join-class?code=${encodeURIComponent(code)}`;
}
