import type { OrganizationStatus } from "@/lib/organizations/contracts";
import type { OrganizationSetupDraft } from "./OrganizationSetupWizard";

export type OrganizationSetupValidation = "valid" | "required" | "invalid";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isOptionalUuid(value: string) {
  return !value.trim() || UUID_PATTERN.test(value.trim());
}

function isOptionalHttpsUrl(value: string) {
  if (!value.trim()) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateOrganizationSetupStep(
  step: number,
  draft: OrganizationSetupDraft,
): OrganizationSetupValidation {
  if (step === 1) {
    if (draft.name.trim().length < 2) return "required";
    if (
      !isOptionalHttpsUrl(draft.logoUrl) ||
      !isOptionalHttpsUrl(draft.facebookUrl) ||
      !isOptionalHttpsUrl(draft.instagramUrl) ||
      !isOptionalHttpsUrl(draft.threadsUrl)
    )
      return "invalid";
  }
  if (step === 2 && draft.inviteEmail.trim()) {
    if (!EMAIL_PATTERN.test(draft.inviteEmail.trim())) return "invalid";
  }
  if (step === 3) {
    if (draft.classTitle.trim() && draft.classTitle.trim().length < 2)
      return "required";
    if (!isOptionalUuid(draft.teacherId)) return "invalid";
  }
  if (step === 4) {
    if (!isOptionalUuid(draft.courseId) || !isOptionalUuid(draft.materialId)) {
      return "invalid";
    }
    if ((draft.courseId.trim() || draft.materialId.trim()) && !draft.classId) {
      return "invalid";
    }
  }
  return "valid";
}

export function deriveOrganizationSetupStep(input: {
  status: OrganizationStatus;
  hasPeople: boolean;
  hasClass: boolean;
  setupVersion?: number | null;
}) {
  if (typeof input.setupVersion === "number" && input.setupVersion >= 5) return 4;
  if (typeof input.setupVersion === "number" && input.setupVersion >= 4) return 3;
  if (typeof input.setupVersion === "number" && input.setupVersion >= 3) return 2;
  if (input.status === "active" || input.hasClass) return 4;
  if (input.hasPeople) return 3;
  return 2;
}
