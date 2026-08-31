import type {
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
} from "./contracts";
import { normalizeOrganizationRole } from "./compatibility";

export type OrganizationLabelContext = "singular" | "plural" | "short";

const TYPE_LABELS: Record<
  OrganizationType,
  Record<OrganizationLabelContext, string>
> = {
  club: { singular: "Club", plural: "Clubs", short: "Club" },
  school: { singular: "School", plural: "Schools", short: "School" },
};

const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
};

const STATUS_LABELS: Record<OrganizationStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const ORGANIZATION_TYPE_LABELS = TYPE_LABELS;
export const ORGANIZATION_ROLE_LABELS = ROLE_LABELS;
export const ORGANIZATION_STATUS_LABELS = STATUS_LABELS;

export function getOrganizationTypeLabel(
  type: OrganizationType,
  context: OrganizationLabelContext = "singular",
): string {
  return TYPE_LABELS[type][context];
}

export function getOrganizationRoleLabel(
  value: OrganizationRole | "coach",
): string {
  const role = normalizeOrganizationRole(value);
  return role ? ROLE_LABELS[role] : "";
}

export function getOrganizationStatusLabel(status: OrganizationStatus): string {
  return STATUS_LABELS[status];
}

/** Generic copy for screens where the concrete organization kind is unknown. */
export function getOrganizationLabel(
  type: OrganizationType,
  context: OrganizationLabelContext = "singular",
): string {
  return getOrganizationTypeLabel(type, context);
}

export function getOrganizationRoleLabelForLegacy(value: unknown): string {
  const role = normalizeOrganizationRole(value);
  return role ? ROLE_LABELS[role] : "";
}
