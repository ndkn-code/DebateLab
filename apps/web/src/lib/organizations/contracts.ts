/**
 * Shared organization vocabulary.
 *
 * Keep this module free of persistence or UI dependencies so API handlers,
 * server code, and components can share the same contract.
 */

export const ORGANIZATION_TYPES = ["club", "school"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_ROLES = ["owner", "admin", "teacher", "student"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ORGANIZATION_STATUSES = ["draft", "active", "archived"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === "string" && (ORGANIZATION_TYPES as readonly string[]).includes(value);
}

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return typeof value === "string" && (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function isOrganizationStatus(value: unknown): value is OrganizationStatus {
  return typeof value === "string" && (ORGANIZATION_STATUSES as readonly string[]).includes(value);
}

