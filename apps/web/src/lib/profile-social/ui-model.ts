import {
  isProfileConnectionStatus,
  normalizeProfileHandle,
  type ProfileConnectionStatus,
} from "@/lib/profile-social/model";

export const PROFILE_SOCIAL_TABS = [
  "analytics",
  "activities",
  "achievements",
] as const;

export type ProfileSocialTab = (typeof PROFILE_SOCIAL_TABS)[number];

export type ProfileConnectionCta =
  | "none"
  | "add"
  | "requested"
  | "respond"
  | "friends"
  | "blocked"
  | "self";

export function normalizeProfileSocialTab(value: unknown): ProfileSocialTab {
  return PROFILE_SOCIAL_TABS.includes(value as ProfileSocialTab)
    ? (value as ProfileSocialTab)
    : "analytics";
}

export function getProfileConnectionCta(input: {
  status: ProfileConnectionStatus | null | undefined;
  viewerCanRequest?: boolean;
}): ProfileConnectionCta {
  if (input.status === "self") return "self";
  if (input.status === "blocked") return "blocked";
  if (input.status === "accepted") return "friends";
  if (input.status === "pending_sent") return "requested";
  if (input.status === "pending_received") return "respond";
  if (input.viewerCanRequest && (input.status === "none" || !input.status)) {
    return "add";
  }

  return "none";
}

export function coerceProfileConnectionStatus(
  value: unknown,
  fallback: ProfileConnectionStatus = "none"
): ProfileConnectionStatus {
  return isProfileConnectionStatus(value) ? value : fallback;
}

export function normalizeSettingsHandleDraft(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/^@+/, "").toLowerCase();
  return normalizeProfileHandle(trimmed) ?? trimmed.slice(0, 30);
}

export function normalizeSettingsStatusDraft(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 140);
}
