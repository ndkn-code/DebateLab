"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BeautifulLoadingState,
  BeautifulStreamingText,
} from "@/components/beautifului";
import { ProductIcon } from "@/components/ui/product-icon";
import type { IeltsCoachResponseMetadata } from "@/lib/coach/ielts-api-contract";
import type { IeltsCoachOutput } from "@/lib/coach/ielts-contract";
import { IELTS_COACH_COPY, type CoachLocale } from "./copy";

export type IeltsCoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: IeltsCoachResponseMetadata | null;
  status: "streaming" | "complete" | "error";
  errorMessage?: string;
};

export function getIeltsEvidence(
  metadata: IeltsCoachResponseMetadata | null | undefined,
) {
  return metadata?.evidenceReferences ?? [];
}

const EVIDENCE_LABELS = {
  en: {
    learner_record: "Your learning history",
    teacher_published: "Published teacher feedback",
    approved_rubric: "Approved IELTS rubric",
    approved_exemplar: "Approved IELTS example",
  },
  vi: {
    learner_record: "Lịch sử học của bạn",
    teacher_published: "Phản hồi giáo viên đã công bố",
    approved_rubric: "Tiêu chí IELTS đã duyệt",
    approved_exemplar: "Ví dụ IELTS đã duyệt",
  },
} as const;

export function evidenceTypeLabel(
  sourceType: IeltsCoachOutput["sources"][number]["sourceType"],
  locale: CoachLocale,
) {
  return EVIDENCE_LABELS[locale][sourceType];
}

export function evidenceAuthorityLabel(
  sourceType: IeltsCoachOutput["sources"][number]["sourceType"],
  locale: CoachLocale,
) {
  if (sourceType === "teacher_published") {
    return locale === "vi" ? "Giáo viên xác nhận" : "Teacher confirmed";
  }
  if (sourceType === "learner_record") {
    return locale === "vi" ? "Dữ liệu của bạn" : "Your record";
  }
  return locale === "vi" ? "Nguồn đã duyệt" : "Approved source";
}

export function scoreAuthorityLabel(
  authority: IeltsCoachOutput["scoreAuthority"]["effective"],
  locale: CoachLocale,
) {
  if (authority === "teacher_confirmed") {
    return locale === "vi" ? "Giáo viên xác nhận" : "Teacher confirmed";
  }
  if (authority === "objective") {
    return locale === "vi"
      ? "Điểm khách quan đã kiểm tra"
      : "Verified objective score";
  }
  if (authority === "ai_provisional") {
    return locale === "vi"
      ? "Ước tính luyện tập bằng AI"
      : "AI practice estimate";
  }
  return locale === "vi" ? "Chưa đủ bằng chứng" : "Insufficient evidence";
}

function StructuredCoachResponse({
  metadata,
  locale,
}: {
  metadata: IeltsCoachResponseMetadata;
  locale: CoachLocale;
}) {
  const copy = IELTS_COACH_COPY[locale];
  const output = metadata.coach;
  const currentBand = output.bandCriterionGap.current?.band ?? null;

  return (
    <div className="mt-3 space-y-3">
      <section className="rounded-control bg-surface-container-low p-3">
        <p className="type-eyebrow text-primary">{copy.scoreSummary}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-control bg-surface p-2.5">
            <p className="type-caption text-on-surface-variant">
              {copy.currentBand}
            </p>
            <p className="type-title font-semibold text-on-surface">
              {currentBand ?? copy.notAvailable}
            </p>
          </div>
          <div className="rounded-control bg-surface p-2.5">
            <p className="type-caption text-on-surface-variant">
              {copy.targetBand}
            </p>
            <p className="type-title font-semibold text-on-surface">
              {output.bandCriterionGap.targetBand ?? copy.notAvailable}
            </p>
          </div>
          <div className="col-span-2 rounded-control bg-surface p-2.5 sm:col-span-1">
            <p className="type-caption text-on-surface-variant">
              {copy.scoreAuthority}
            </p>
            <p className="type-label font-semibold text-on-surface">
              {scoreAuthorityLabel(output.scoreAuthority.effective, locale)}
            </p>
          </div>
        </div>
      </section>

      {output.learnerEvidenceUsed.length > 0 ? (
        <details className="rounded-control border border-outline-variant bg-surface px-3 py-2.5">
          <summary className="cursor-pointer type-label font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {copy.evidenceUsedTitle} ({output.learnerEvidenceUsed.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {output.learnerEvidenceUsed.slice(0, 4).map((item) => (
              <li
                key={item.evidenceId}
                className="flex gap-2 type-body-sm text-on-surface-variant"
              >
                <ProductIcon
                  name="shieldCheck"
                  size="sm"
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span>{item.summary}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function IeltsCoachAssistantMessage({
  message,
  locale,
}: {
  message: IeltsCoachMessage;
  locale: CoachLocale;
}) {
  const copy = IELTS_COACH_COPY[locale];

  return (
    <article className="group/answer py-1">
      <div className="mb-3 flex items-center gap-2 type-label font-semibold text-on-surface">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary-container text-primary ring-1 ring-inset ring-primary/15">
          <ProductIcon name="sparkles" size="sm" weight="duotone" />
        </span>
        {copy.coachName}
      </div>
      {message.status === "streaming" && !message.content ? (
        <BeautifulLoadingState label={copy.thinking} variant="orbit" />
      ) : message.status === "error" ? (
        <p className="type-body-sm text-error" role="alert">
          {message.errorMessage ?? copy.error}
        </p>
      ) : (
        <>
          {message.content ? (
            <BeautifulStreamingText streaming={message.status === "streaming"}>
              <div className="prose prose-sm max-w-none text-on-surface prose-headings:text-on-surface prose-p:my-2 prose-p:leading-6 prose-strong:text-on-surface prose-ul:my-2 prose-li:my-1 dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </BeautifulStreamingText>
          ) : null}
          {message.metadata ? (
            <StructuredCoachResponse
              metadata={message.metadata}
              locale={locale}
            />
          ) : null}
        </>
      )}
    </article>
  );
}
