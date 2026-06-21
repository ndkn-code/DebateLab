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

function Explanation({ item }: { item: ObjectiveReviewItem }) {
  if (!item.explanationEn && !item.explanationVi) return null;
  return (
    <div className="mt-2 rounded-xl bg-surface-container-low px-3 py-2">
      {item.explanationEn ? (
        <p className="type-body-sm text-on-surface-variant">{item.explanationEn}</p>
      ) : null}
      {item.explanationVi ? (
        <p className="mt-1 type-body-sm text-on-surface-variant">{item.explanationVi}</p>
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
  const context = item.sourceContext;
  if (!context) return null;
  return (
    <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption font-semibold uppercase text-on-surface-variant">
          {context.label}
        </p>
        {context.title ? (
          <p className="type-caption text-on-surface-variant">{context.title}</p>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap type-body-sm text-on-surface">
        {context.segments.map((segment, index) => (
          <SourceSegment key={`${segment.text}-${index}`} segment={segment} />
        ))}
      </p>
      {!context.answerLocation ? (
        <p className="mt-1 type-caption text-on-surface-variant">
          Answer location is not tagged for this item yet.
        </p>
      ) : null}
    </div>
  );
}

function ReviewRow({ item }: { item: ObjectiveReviewItem }) {
  return (
    <li className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="type-body-sm text-on-surface">
          <span className="font-semibold">{item.number}.</span> {item.prompt}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 type-caption ${
            item.isCorrect
              ? "bg-success-container text-success-dim"
              : "bg-error-container text-error"
          }`}
        >
          {item.isCorrect ? "Correct" : "Incorrect"}
        </span>
      </div>
      <dl className="mt-2 flex flex-col gap-1">
        <div className="flex flex-wrap gap-2 type-body-sm">
          <dt className="text-on-surface-variant">Your answer:</dt>
          <dd className={item.isCorrect ? "text-on-surface" : "text-error"}>
            {item.learnerAnswer}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2 type-body-sm">
          <dt className="text-on-surface-variant">Correct answer:</dt>
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
  return (
    <details open={open} className="rounded-2xl border border-outline-variant bg-surface-container">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
        <span className="type-title text-on-surface">{section.label}</span>
        <span className="type-body-sm text-on-surface-variant tabular-nums">
          {section.correctCount}/{section.totalCount} correct
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
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-heading-md text-on-surface">Answer review</h2>
      {sections.map((section, index) => (
        <ReviewSection key={section.skill} section={section} open={index === 0} />
      ))}
    </section>
  );
}
