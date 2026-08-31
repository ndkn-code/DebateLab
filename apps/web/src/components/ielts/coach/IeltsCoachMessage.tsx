"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { ProductIcon } from "@/components/ui/product-icon";
import type { CoachMessageMetadata } from "@/types";
import { IELTS_COACH_COPY, type CoachLocale } from "./copy";

export type IeltsCoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: CoachMessageMetadata | null;
  status: "streaming" | "complete" | "error";
};

export function getIeltsEvidence(
  metadata: CoachMessageMetadata | null | undefined,
) {
  if (!metadata?.coachCorpusEvidence?.length) return [];
  const collection = metadata.coachCorpusCollection?.toLowerCase() ?? "";
  return metadata.coachCorpusEvidence.filter((item) => {
    const itemType = item.itemType.toLowerCase();
    const locator = item.sourceLocator?.toLowerCase() ?? "";
    return (
      collection.includes("ielts") ||
      itemType.includes("ielts") ||
      locator.includes("ielts")
    );
  });
}

const EVIDENCE_LABELS = {
  en: {
    band_descriptor: "Band descriptor",
    rubric_manifest: "Scoring rubric",
    learner_context: "Your learning history",
    writing_exemplar: "Writing example",
    speaking_exemplar: "Speaking example",
    default: "IELTS reference",
  },
  vi: {
    band_descriptor: "Mô tả band",
    rubric_manifest: "Tiêu chí chấm điểm",
    learner_context: "Lịch sử học của bạn",
    writing_exemplar: "Bài mẫu Viết",
    speaking_exemplar: "Bài mẫu Nói",
    default: "Tài liệu IELTS",
  },
} as const;

const AUTHORITY_LABELS = {
  en: {
    official: "Official source",
    examiner_authored: "Examiner-authored",
    qualified_adjudicator: "Qualified reviewer",
    coaching_only: "Coaching reference",
    default: "Reviewed reference",
  },
  vi: {
    official: "Nguồn chính thức",
    examiner_authored: "Do giám khảo biên soạn",
    qualified_adjudicator: "Người đánh giá đủ chuyên môn",
    coaching_only: "Tài liệu hướng dẫn",
    default: "Tài liệu đã được xem xét",
  },
} as const;

export function evidenceTypeLabel(itemType: string, locale: CoachLocale) {
  const labels = EVIDENCE_LABELS[locale];
  return labels[itemType as keyof typeof labels] ?? labels.default;
}

export function evidenceAuthorityLabel(
  authorityTier: string | null | undefined,
  locale: CoachLocale,
) {
  const labels = AUTHORITY_LABELS[locale];
  return authorityTier
    ? (labels[authorityTier as keyof typeof labels] ?? labels.default)
    : labels.default;
}

export function IeltsCoachAssistantMessage({
  message,
  locale,
}: {
  message: IeltsCoachMessage;
  locale: CoachLocale;
}) {
  const copy = IELTS_COACH_COPY[locale];
  const evidence = getIeltsEvidence(message.metadata);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (message.status !== "streaming") return undefined;
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [message.status]);

  return (
    <article className="rounded-xl border border-outline-variant bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 type-label font-semibold text-on-surface">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary-container text-primary">
          <ProductIcon name="sparkles" size="sm" weight="duotone" />
        </span>
        IELTS AI Coach
      </div>
      {message.status === "streaming" && !message.content ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 type-label text-on-surface-variant"
          role="status"
        >
          <ProductIcon
            name="sparkles"
            size="sm"
            className="animate-pulse text-primary motion-reduce:animate-none"
          />
          {copy.thinking}
          <span aria-hidden="true" className="ml-auto tabular-nums">
            {elapsedSeconds}s
          </span>
        </div>
      ) : message.status === "error" ? (
        <p className="type-body-sm text-error" role="alert">
          {copy.error}
        </p>
      ) : (
        <div className="prose prose-sm max-w-none text-on-surface prose-headings:text-on-surface prose-p:my-2 prose-p:leading-6 prose-strong:text-on-surface prose-ul:my-2 prose-li:my-1 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      {evidence.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {evidence.slice(0, 2).map((item) => (
            <div
              key={`${item.sourceId}-${item.version}`}
              className="rounded-[10px] border border-outline-variant bg-surface-container-low p-3"
            >
              <div className="flex items-center gap-2 type-label font-semibold text-on-surface">
                <ProductIcon name="book" size="sm" className="text-primary" />
                {evidenceTypeLabel(item.itemType, locale)}
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 type-caption text-on-surface-variant">
                <dt>{copy.sourceAuthority}</dt>
                <dd className="text-right font-medium text-on-surface">
                  {evidenceAuthorityLabel(item.authorityTier, locale)}
                </dd>
                <dt>{copy.sourceVersion}</dt>
                <dd className="text-right font-medium text-on-surface">
                  {item.version}
                </dd>
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
