import type { PracticeLanguage } from "@/types";

type SourceKind = "legacy" | "calico" | "truong_teen";

function stripTerminalPunctuation(value: string) {
  return value.trim().replace(/[.!?。！？]+$/u, "").trim();
}

function lowerFirstLetter(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toLocaleLowerCase("vi-VN")}${trimmed.slice(1)}`;
}

function normalizeKnownVietnameseTerms(value: string) {
  return value.replace(/\bmôn ngữ văn\b/giu, "môn Ngữ văn");
}

function isAlreadyFramedMotion(value: string) {
  return /^(chúng tôi|this house|thw|thbt)\b/i.test(value.trim());
}

export function formatMotionTitleForDisplay(
  title: string,
  options: {
    language: PracticeLanguage;
    sourceKind?: SourceKind;
  }
) {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized || options.language !== "vi" || isAlreadyFramedMotion(normalized)) {
    return normalized;
  }

  const motion = normalizeKnownVietnameseTerms(stripTerminalPunctuation(normalized));
  const shouldFrame =
    options.sourceKind === "truong_teen" ||
    options.sourceKind === "calico" ||
    options.sourceKind === "legacy";
  if (!shouldFrame) return normalized;

  const shouldMotion = motion.match(/^nên\s+(.+)$/iu);
  if (shouldMotion) {
    return `Chúng tôi ủng hộ việc ${lowerFirstLetter(shouldMotion[1])}.`;
  }

  const endMotion = motion.match(/^(.+?)\s+cần được chấm dứt$/iu);
  if (endMotion) {
    return `Chúng tôi ủng hộ việc chấm dứt ${lowerFirstLetter(endMotion[1])}.`;
  }

  const subjectShouldMotion = motion.match(/^(.+?)\s+nên\s+(.+)$/iu);
  if (subjectShouldMotion) {
    return `Chúng tôi tin rằng ${lowerFirstLetter(
      subjectShouldMotion[1]
    )} nên ${subjectShouldMotion[2]}.`;
  }

  return normalized;
}
