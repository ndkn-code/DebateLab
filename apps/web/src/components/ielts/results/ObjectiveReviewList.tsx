/**
 * Per-section objective answer review (WS-2.2). Each skill (R/L) is a native
 * `<details>` group; every question shows the learner's answer, the correct
 * answer when wrong, and the bilingual explanation. Server component (no JS).
 */
import type {
  ObjectiveReviewItem,
  ObjectiveReviewSection,
  ResultsTextSegment,
} from "@/lib/ielts/results/types";
import { useLocale } from "next-intl";

const COPY = {
  en: {
    title: "Answer review",
    correct: "Correct",
    incorrect: "Incorrect",
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    score: "{correct}/{total} correct",
    evidence: "Answer evidence",
    noLocation: "The answer location is not tagged for this item yet.",
    listening: "Listening",
    reading: "Reading",
  },
  vi: {
    title: "Xem lại câu trả lời",
    correct: "Đúng",
    incorrect: "Chưa đúng",
    yourAnswer: "Câu trả lời của bạn",
    correctAnswer: "Đáp án đúng",
    score: "Đúng {correct}/{total}",
    evidence: "Bằng chứng cho đáp án",
    noLocation: "Chưa đánh dấu vị trí đáp án cho câu này.",
    listening: "Nghe",
    reading: "Đọc",
  },
} as const;

function useReviewCopy() {
  return COPY[useLocale() === "vi" ? "vi" : "en"];
}

function Explanation({ item }: { item: ObjectiveReviewItem }) {
  if (!item.explanationEn && !item.explanationVi) return null;
  return (
    <div className="mt-2 rounded-xl bg-surface-container-low px-3 py-2">
      {item.explanationEn ? (
        <p className="type-body-sm text-on-surface-variant">
          {item.explanationEn}
        </p>
      ) : null}
      {item.explanationVi ? (
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {item.explanationVi}
        </p>
      ) : null}
    </div>
  );
}

function SourceSegment({ segment }: { segment: ResultsTextSegment }) {
  return segment.highlighted ? (
    <mark className="rounded bg-warning-container px-1 py-0.5 text-on-warning-container">
      {segment.text}
    </mark>
  ) : (
    <>{segment.text}</>
  );
}

function SourceContext({ item }: { item: ObjectiveReviewItem }) {
  const copy = useReviewCopy();
  const context = item.sourceContext;
  if (!context) return null;
  return (
    <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption font-semibold uppercase text-on-surface-variant">
          {copy.evidence}
        </p>
        {context.title ? (
          <p className="type-caption text-on-surface-variant">
            {context.title}
          </p>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap type-body-sm text-on-surface">
        {context.segments.map((segment, index) => (
          <SourceSegment key={`${segment.text}-${index}`} segment={segment} />
        ))}
      </p>
      {!context.answerLocation ? (
        <p className="mt-1 type-caption text-on-surface-variant">
          {copy.noLocation}
        </p>
      ) : null}
    </div>
  );
}

function ReviewRow({ item }: { item: ObjectiveReviewItem }) {
  const copy = useReviewCopy();
  return (
    <li className="rounded-xl border border-outline-variant bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="type-body-sm text-on-surface">
          <span className="font-semibold">{item.number}.</span> {item.prompt}
        </p>
        <span
          className={`inline-flex min-h-5 shrink-0 items-center rounded-md px-2 type-caption ${
            item.isCorrect
              ? "bg-success-container text-success-dim"
              : "bg-error-container text-error"
          }`}
        >
          {item.isCorrect ? copy.correct : copy.incorrect}
        </span>
      </div>
      <dl className="mt-2 flex flex-col gap-1">
        <div className="flex flex-wrap gap-2 type-body-sm">
          <dt className="text-on-surface-variant">{copy.yourAnswer}:</dt>
          <dd className={item.isCorrect ? "text-on-surface" : "text-error"}>
            {item.learnerAnswer}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2 type-body-sm">
          <dt className="text-on-surface-variant">{copy.correctAnswer}:</dt>
          <dd className="font-medium text-on-surface">{item.correctAnswer}</dd>
        </div>
      </dl>
      <Explanation item={item} />
      <SourceContext item={item} />
    </li>
  );
}

function ReviewSection({
  section,
  open,
}: {
  section: ObjectiveReviewSection;
  open: boolean;
}) {
  const copy = useReviewCopy();
  return (
    <details
      open={open}
      className="rounded-xl border border-outline-variant bg-surface-container"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
        <span className="type-title text-on-surface">
          {copy[section.skill]}
        </span>
        <span className="type-body-sm text-on-surface-variant tabular-nums">
          {copy.score
            .replace("{correct}", String(section.correctCount))
            .replace("{total}", String(section.totalCount))}
        </span>
      </summary>
      <ul className="flex flex-col gap-2 px-3 pb-3">
        {section.items.map((item) => (
          <ReviewRow key={item.questionId} item={item} />
        ))}
      </ul>
    </details>
  );
}

export function ObjectiveReviewList({
  sections,
}: {
  sections: ObjectiveReviewSection[];
}) {
  const copy = useReviewCopy();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-heading-md text-on-surface">{copy.title}</h2>
      {sections.map((section, index) => (
        <ReviewSection
          key={section.skill}
          section={section}
          open={index === 0}
        />
      ))}
    </section>
  );
}
