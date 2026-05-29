export type ClubJoinCodeClaimStatus =
  | "accepted"
  | "auth_required"
  | "malformed"
  | "not_found"
  | "expired"
  | "revoked"
  | "already_redeemed"
  | "already_in_org";

export function normalizeOrganizationJoinCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function formatOrganizationJoinCode(value: string) {
  const normalized = normalizeOrganizationJoinCode(value);
  return normalized.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

export function isUsableOrganizationJoinCode(value: string) {
  return normalizeOrganizationJoinCode(value).length >= 6;
}

export function getJoinCodeClaimMessage(status: ClubJoinCodeClaimStatus) {
  switch (status) {
    case "accepted":
      return "Organization joined.";
    case "auth_required":
      return "Sign in to join an organization.";
    case "expired":
      return "That organization code has expired.";
    case "revoked":
      return "That organization code was revoked.";
    case "already_redeemed":
      return "That organization code has already been used.";
    case "already_in_org":
      return "You are already in an organization.";
    case "malformed":
      return "Enter a valid organization code.";
    case "not_found":
    default:
      return "That organization code was not found.";
  }
}
