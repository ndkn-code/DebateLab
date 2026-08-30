import type {
  MaterialDocumentV1,
  MaterialContentReviewStatus,
  MaterialPlacementStatus,
  MaterialPreviewDescriptor,
  MaterialProcessingStatus,
  MaterialRightsBasis,
  MaterialRuleKind,
  MaterialTargetType,
} from "@/lib/api/class-lms/material-contracts";

export type MaterialMediaKind = "document" | "image" | "audio";

/**
 * Presentation-only projection. Server loaders must construct this from the
 * authorized LMS projection; storage paths and rights-review notes must never
 * be included.
 */
export type LearnerMaterialProjection = {
  materialId: string;
  placementId: string;
  versionId: string;
  title: string;
  description: string | null;
  mediaKind: MaterialMediaKind;
  mimeType: string;
  processingStatus: MaterialProcessingStatus;
  placementStatus: MaterialPlacementStatus;
  accessState: "available" | "locked" | "processing";
  lockReasons: string[];
  required: boolean;
  lessonTitle: string | null;
  availableAt: string | null;
  preview: MaterialPreviewDescriptor | null;
  document: MaterialDocumentV1 | null;
  renditions: Array<{
    renditionId: string;
    preview: MaterialPreviewDescriptor;
    transcript: string | null;
  }>;
};

export type TeacherMaterialPlacementSummary = {
  id: string;
  targetType: MaterialTargetType;
  targetId: string;
  targetLabel: string;
  status: MaterialPlacementStatus;
  releaseAt: string | null;
  expiresAt: string | null;
  required: boolean;
  audienceCount: number | null;
  rules: MaterialRuleKind[];
};

export type TeacherMaterialSummary = {
  materialId: string;
  versionId: string;
  title: string;
  description: string | null;
  sourceFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  processingStatus: MaterialProcessingStatus;
  contentReviewStatus: MaterialContentReviewStatus;
  rightsBasis: MaterialRightsBasis | null;
  rightsApproved: boolean | null;
  updatedAt: string;
  placements: TeacherMaterialPlacementSummary[];
  preview: MaterialPreviewDescriptor | null;
  document: MaterialDocumentV1 | null;
  renditions: LearnerMaterialProjection["renditions"];
};

export type MaterialPlacementTarget = {
  type: MaterialTargetType;
  id: string;
  label: string;
  detail: string | null;
};

export function previewUrl(
  descriptor: MaterialPreviewDescriptor | null | undefined,
): string | null {
  if (!descriptor?.viewerUrl) return null;
  try {
    const url = new URL(descriptor.viewerUrl, "https://thinkfy.invalid");
    if (url.protocol !== "https:" && url.origin !== "https://thinkfy.invalid") {
      return null;
    }
    if (
      url.origin === "https://thinkfy.invalid" &&
      !url.pathname.startsWith("/")
    ) {
      return null;
    }
    return descriptor.viewerUrl;
  } catch {
    return null;
  }
}

export function fileKind(mimeType: string): MaterialMediaKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export function isPreviewExpired(
  descriptor: MaterialPreviewDescriptor,
): boolean {
  return Date.parse(descriptor.expiresAt) <= Date.now();
}
