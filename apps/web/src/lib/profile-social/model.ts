export const PROFILE_VISIBILITIES = [
  "private",
  "connections",
  "public",
] as const;

export const PROFILE_PUBLIC_STATES = [
  "not_found",
  "blocked",
  "private",
  "limited",
  "visible",
  "self",
] as const;

export const PROFILE_CONNECTION_STATUSES = [
  "none",
  "pending_sent",
  "pending_received",
  "accepted",
  "blocked",
  "self",
] as const;

export const PROFILE_REPORT_REASONS = [
  "harassment",
  "spam",
  "impersonation",
  "inappropriate_content",
  "privacy",
  "other",
] as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
export type ProfilePublicState = (typeof PROFILE_PUBLIC_STATES)[number];
export type ProfileConnectionStatus = (typeof PROFILE_CONNECTION_STATUSES)[number];
export type ProfileReportReason = (typeof PROFILE_REPORT_REASONS)[number];

export type ProfileConnectionRowStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "removed";

export type ProfileSection =
  | "profile"
  | "analytics"
  | "activities"
  | "achievements"
  | "organization";

export interface ProfilePrivacySettings {
  userId: string;
  profileVisibility: ProfileVisibility;
  analyticsVisibility: ProfileVisibility;
  activitiesVisibility: ProfileVisibility;
  achievementsVisibility: ProfileVisibility;
  organizationVisibility: ProfileVisibility;
  allowConnectionRequests: boolean;
  searchableByHandle: boolean;
  updatedAt: string;
}

export interface PublicProfileConnection {
  status: ProfileConnectionStatus;
  viewerCanRequest: boolean;
}

export interface PublicProfileOrganizationSummary {
  type: "club" | "class";
  id: string;
  name: string;
  role: string | null;
}

export interface PublicProfileSeasonSummary {
  language: "en" | "vi";
  seasonXp: number;
  rank: number | null;
  leagueTier: string | null;
  cohortIndex: number | null;
}

export interface PublicProfileShell {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  selectedTitle: string | null;
  profileStatus: string | null;
  level: number | null;
  lifetimeXp: number | null;
  season: PublicProfileSeasonSummary | null;
  organization: PublicProfileOrganizationSummary | null;
  friendCounts: {
    friends: number;
  };
  featuredAchievements: unknown[] | null;
}

export interface PublicProfileData {
  state: ProfilePublicState;
  visibleSections?: Partial<Record<Exclude<ProfileSection, "profile">, boolean>>;
  connection: PublicProfileConnection | null;
  profile: PublicProfileShell | null;
}

export type ProfileConnectionAction =
  | "accept"
  | "decline"
  | "cancel"
  | "remove";

export type ProfileDiscoveryStatus =
  | "empty"
  | "found"
  | "not_found"
  | "blocked"
  | "rate_limited";

export type ProfileDiscoveryQueryKind = "empty" | "handle" | "friend_code" | "invalid" | "unknown";

export interface ProfileDiscoveryShellProfile {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  selectedTitle: string | null;
  profileStatus: string | null;
  organization: PublicProfileOrganizationSummary | null;
  friendCounts: {
    friends: number;
  };
  isPrivate: boolean;
}

export interface ProfileDiscoveryShell {
  state: "self" | "visible" | "private";
  connection: PublicProfileConnection;
  profile: ProfileDiscoveryShellProfile;
}

export interface ProfileDiscoveryResult {
  status: ProfileDiscoveryStatus;
  queryKind: ProfileDiscoveryQueryKind;
  result: ProfileDiscoveryShell | null;
}

export interface ProfileConnectionCenterData {
  status: "ok";
  friendCode: {
    code: string | null;
    discoveryEnabled: boolean;
  };
  incoming: ProfileDiscoveryShell[];
  outgoing: ProfileDiscoveryShell[];
  friends: ProfileDiscoveryShell[];
}

export interface ProfileDiscoverySuggestionsData {
  status: "ok";
  suggestions: ProfileDiscoveryShell[];
}

const HANDLE_PATTERN = /^[a-z0-9_.]{3,30}$/;
const FRIEND_CODE_COMPACT_PATTERN = /^DBT[A-Z0-9]{8}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isProfilePublicState(value: unknown): value is ProfilePublicState {
  return isString(value) && PROFILE_PUBLIC_STATES.includes(value as ProfilePublicState);
}

export function isProfileConnectionStatus(
  value: unknown
): value is ProfileConnectionStatus {
  return (
    isString(value) &&
    PROFILE_CONNECTION_STATUSES.includes(value as ProfileConnectionStatus)
  );
}

export function normalizeProfileHandle(value: unknown): string | null {
  if (!isString(value)) return null;
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  return HANDLE_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeProfileFriendCode(value: unknown): string | null {
  if (!isString(value)) return null;
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!FRIEND_CODE_COMPACT_PATTERN.test(compact)) return null;
  return `DBT-${compact.slice(3, 7)}-${compact.slice(7, 11)}`;
}

export function isValidProfileHandle(value: unknown): value is string {
  return normalizeProfileHandle(value) === value;
}

export function normalizeProfileVisibility(
  value: unknown,
  fallback: ProfileVisibility = "private"
): ProfileVisibility {
  if (value === "trusted") {
    return "connections";
  }

  return isString(value) && PROFILE_VISIBILITIES.includes(value as ProfileVisibility)
    ? (value as ProfileVisibility)
    : fallback;
}

export function normalizeProfileReportReason(value: unknown): ProfileReportReason {
  return isString(value) && PROFILE_REPORT_REASONS.includes(value as ProfileReportReason)
    ? (value as ProfileReportReason)
    : "other";
}

export function canViewProfileSection(input: {
  visibility: ProfileVisibility;
  isSelf?: boolean;
  isAdmin?: boolean;
  isBlocked?: boolean;
  isConnection?: boolean;
  isTrustedContext?: boolean;
}) {
  if (input.isSelf || input.isAdmin) return true;
  if (input.isBlocked) return false;

  if (input.visibility === "public") return true;
  if (input.visibility === "connections") return Boolean(input.isConnection);
  return false;
}

export function getAllowedProfileConnectionTransition(input: {
  currentStatus: ProfileConnectionRowStatus;
  action: ProfileConnectionAction;
  actorUserId: string;
  requesterUserId: string;
  recipientUserId: string;
}): ProfileConnectionRowStatus | null {
  const actorIsRequester = input.actorUserId === input.requesterUserId;
  const actorIsRecipient = input.actorUserId === input.recipientUserId;

  if (input.currentStatus === "pending" && actorIsRecipient) {
    if (input.action === "accept") return "accepted";
    if (input.action === "decline") return "declined";
  }

  if (input.currentStatus === "pending" && actorIsRequester && input.action === "cancel") {
    return "cancelled";
  }

  if (
    input.currentStatus === "accepted" &&
    (actorIsRequester || actorIsRecipient) &&
    input.action === "remove"
  ) {
    return "removed";
  }

  return null;
}

export function isPublicProfileData(value: unknown): value is PublicProfileData {
  if (!isRecord(value) || !isProfilePublicState(value.state)) return false;

  if (value.connection !== null) {
    if (!isRecord(value.connection)) return false;
    if (!isProfileConnectionStatus(value.connection.status)) return false;
    if (typeof value.connection.viewerCanRequest !== "boolean") return false;
  }

  if (value.profile === null) return true;
  if (!isRecord(value.profile)) return false;
  if (!isString(value.profile.userId)) return false;
  if (!isString(value.profile.displayName)) return false;
  if (value.profile.handle !== null && !isString(value.profile.handle)) return false;
  if (value.profile.avatarUrl !== null && !isString(value.profile.avatarUrl)) return false;
  if (
    value.profile.friendCounts !== undefined &&
    (!isRecord(value.profile.friendCounts) || !isNumber(value.profile.friendCounts.friends))
  ) {
    return false;
  }

  return true;
}

export function coercePublicProfileData(value: unknown): PublicProfileData {
  if (isPublicProfileData(value)) return value;

  return {
    state: "not_found",
    connection: null,
    profile: null,
  };
}

function coerceDiscoveryProfile(value: unknown): ProfileDiscoveryShellProfile | null {
  if (!isRecord(value) || !isString(value.userId)) return null;

  return {
    userId: value.userId,
    handle: isString(value.handle) ? value.handle : null,
    displayName: isString(value.displayName) ? value.displayName : "Private profile",
    avatarUrl: isString(value.avatarUrl) ? value.avatarUrl : null,
    selectedTitle: isString(value.selectedTitle) ? value.selectedTitle : null,
    profileStatus: isString(value.profileStatus) ? value.profileStatus : null,
    organization: isRecord(value.organization)
      ? {
          type: value.organization.type === "class" ? "class" : "club",
          id: isString(value.organization.id) ? value.organization.id : "",
          name: isString(value.organization.name) ? value.organization.name : "",
          role: isString(value.organization.role) ? value.organization.role : null,
        }
      : null,
    friendCounts:
      isRecord(value.friendCounts) && isNumber(value.friendCounts.friends)
        ? { friends: value.friendCounts.friends }
        : { friends: 0 },
    isPrivate: value.isPrivate === true,
  };
}

export function coerceProfileDiscoveryShell(value: unknown): ProfileDiscoveryShell | null {
  if (!isRecord(value) || !isRecord(value.connection)) return null;
  const status = isProfileConnectionStatus(value.connection.status)
    ? value.connection.status
    : "none";
  const profile = coerceDiscoveryProfile(value.profile);
  if (!profile) return null;

  return {
    state:
      value.state === "self" || value.state === "private" || value.state === "visible"
        ? value.state
        : "private",
    connection: {
      status,
      viewerCanRequest: value.connection.viewerCanRequest === true,
    },
    profile,
  };
}

function coerceDiscoveryShellArray(value: unknown): ProfileDiscoveryShell[] {
  return Array.isArray(value)
    ? value
        .map(coerceProfileDiscoveryShell)
        .filter((item): item is ProfileDiscoveryShell => Boolean(item))
    : [];
}

function isDiscoveryStatus(value: unknown): value is ProfileDiscoveryStatus {
  return (
    isString(value) &&
    ["empty", "found", "not_found", "blocked", "rate_limited"].includes(value)
  );
}

function isDiscoveryQueryKind(value: unknown): value is ProfileDiscoveryQueryKind {
  return (
    isString(value) &&
    ["empty", "handle", "friend_code", "invalid", "unknown"].includes(value)
  );
}

export function coerceProfileDiscoveryResult(value: unknown): ProfileDiscoveryResult {
  if (!isRecord(value)) {
    return { status: "not_found", queryKind: "unknown", result: null };
  }

  return {
    status: isDiscoveryStatus(value.status) ? value.status : "not_found",
    queryKind: isDiscoveryQueryKind(value.queryKind) ? value.queryKind : "unknown",
    result: coerceProfileDiscoveryShell(value.result),
  };
}

export function coerceProfileConnectionCenterData(value: unknown): ProfileConnectionCenterData {
  if (!isRecord(value)) {
    return {
      status: "ok",
      friendCode: { code: null, discoveryEnabled: true },
      incoming: [],
      outgoing: [],
      friends: [],
    };
  }

  const friendCode = isRecord(value.friendCode) ? value.friendCode : {};

  return {
    status: "ok",
    friendCode: {
      code: isString(friendCode.code) ? friendCode.code : null,
      discoveryEnabled: friendCode.discoveryEnabled !== false,
    },
    incoming: coerceDiscoveryShellArray(value.incoming),
    outgoing: coerceDiscoveryShellArray(value.outgoing),
    friends: coerceDiscoveryShellArray(value.friends),
  };
}

export function coerceProfileDiscoverySuggestionsData(
  value: unknown
): ProfileDiscoverySuggestionsData {
  if (!isRecord(value)) {
    return { status: "ok", suggestions: [] };
  }

  return {
    status: "ok",
    suggestions: coerceDiscoveryShellArray(value.suggestions),
  };
}
