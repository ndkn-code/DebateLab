import {
  isOrganizationRole,
  isOrganizationType,
  type OrganizationRole,
  type OrganizationType,
} from "./contracts";

/** Values accepted by the legacy `clubs.club_type` column. */
export const LEGACY_CLUB_TYPES = [
  "school",
  "center",
  "independent",
  "online",
] as const;
export type LegacyClubType = (typeof LEGACY_CLUB_TYPES)[number];

/** Values accepted by old club-membership rows while they are being read. */
export type LegacyOrganizationRole = OrganizationRole | "coach";

/**
 * A school remains a school; all other legacy club kinds are organizations of
 * the new `club` type. Unknown and empty values intentionally fall back to
 * `club` because that is the least surprising compatibility behavior for an
 * existing club row.
 */
export function organizationTypeFromLegacyClubType(value: unknown): OrganizationType {
  const normalized = normalizeToken(value);
  return normalized === "school" ? "school" : "club";
}

/** Alias with a migration-oriented name for callers reading old rows. */
export const mapLegacyClubType = organizationTypeFromLegacyClubType;
export const normalizeLegacyClubType = organizationTypeFromLegacyClubType;

/**
 * Normalize legacy membership roles into the shared role vocabulary. The old
 * `coach` role is the same permission concept as the new `teacher` role.
 */
export function normalizeOrganizationRole(
  value: unknown,
  fallback: OrganizationRole | null = null,
): OrganizationRole | null {
  const normalized = normalizeToken(value);

  if (normalized === "coach") return "teacher";
  if (isOrganizationRole(normalized)) return normalized;
  return fallback;
}

export const normalizeLegacyOrganizationRole = normalizeOrganizationRole;
export const normalizeCoachRole = normalizeOrganizationRole;

/** Narrowing helper for values arriving from legacy membership storage. */
export function isLegacyOrganizationRole(value: unknown): value is LegacyOrganizationRole {
  const normalized = normalizeToken(value);
  return normalized === "coach" || isOrganizationRole(normalized);
}

/** This is useful when a caller needs to distinguish canonical type values. */
export function isCanonicalOrganizationType(value: unknown): value is OrganizationType {
  return isOrganizationType(value);
}

function normalizeToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

