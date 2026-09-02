/**
 * Writing result panel (WS-2.2) plus the helpers the Speaking panel
 * (`SpeakingResultPanel.tsx`) shares. Renders the typed per-criterion bands +
 * transparency feedback the AI scorers (WS-3.1/3.2) persist, with a graceful
 * "scoring in progress" state while a response is still being marked.
 */
import type {
  CriterionScore,
  ResultsInlineCorrection,
  WritingEssayParagraph,
  WritingResult,
  WritingTaskResult,
} from "@/lib/ielts/results/types";
import { useLocale } from "next-intl";
import {
  GradingResultDetails,
  gradingPresentationFromResult,
  type GradingProcessStatus,
} from "@/components/ielts/learner/GradingResultDetails";
import { bandText } from "./format";
import {
  interpolateResultCopy as interpolate,
  useSkillFeedbackCopy as useResultCopy,
} from "./skill-feedback-copy";

export function isScored(status: string): boolean {
  return status === "scored" || status === "overridden";
}

export function CriteriaList({ criteria }: { criteria: CriterionScore[] }) {
  const copy = useResultCopy();
  return (
    <ul className="flex flex-col gap-2">
      {criteria.map((criterion) => (
        <li
          key={criterion.key}
          className="rounded-xl bg-surface-container-low px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="type-body-sm font-medium text-on-surface">
              {copy.criteria[criterion.key as keyof typeof copy.criteria] ??
                criterion.label}
            </span>
            <span className="type-body-sm font-bold text-on-surface tabular-nums">
              {bandText(criterion.band)}
            </span>
          </div>
          {criterion.rationale ? (
            <p className="mt-1 type-caption text-on-surface-variant">
              {criterion.rationale}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PendingNote({ skill }: { skill: string }) {
  const copy = useResultCopy();
  return (
    <p className="rounded-xl bg-warning-container px-3 py-2 type-body-sm text-on-warning-container">
      {copy.pending.replace("{skill}", skill)}
    </p>
  );
}

export function TeacherPublishedNote({
  note,
  locale,
}: {
  note: string | null | undefined;
  locale: string;
}) {
  if (!note) return null;
  const vietnamese = locale.toLowerCase().startsWith("vi");
  return (
    <div className="rounded-xl border border-outline-variant bg-primary-container px-3 py-2">
      <p className="type-caption font-semibold uppercase text-on-primary-container">
        {vietnamese
          ? "Phản hồi giáo viên đã công bố"
          : "Published teacher feedback"}
      </p>
      <p className="mt-1 type-body-sm text-on-primary-container">{note}</p>
    </div>
  );
}

function Corrections({ items }: { items: ResultsInlineCorrection[] }) {
  const copy = useResultCopy();
  if (items.length === 0) return null;
  return (
    <details className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        {interpolate(copy.corrections, items.length)}
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="type-body-sm">
            <span className="text-error line-through">{item.original}</span>
            {" → "}
            <span className="font-medium text-on-surface">
              {item.suggestion}
            </span>
            {item.explanation ? (
              <span className="text-on-surface-variant">
                {" "}
                — {item.explanation}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Prompt({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="rounded-xl bg-surface-container-low px-3 py-2 type-body-sm text-on-surface">
      {text}
    </p>
  );
}

export function ModelAnswer({ text }: { text: string | null }) {
  const copy = useResultCopy();
  if (!text) return null;
  return (
    <details className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        {copy.modelAnswer}
      </summary>
      <p className="mt-2 whitespace-pre-wrap type-body-sm text-on-surface-variant">
        {text}
      </p>
    </details>
  );
}

function ParagraphAnnotations({
  paragraph,
}: {
  paragraph: WritingEssayParagraph;
}) {
  const copy = useResultCopy();
  if (!paragraph.feedback && paragraph.corrections.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-surface-container-low px-3 py-2">
      {paragraph.feedback ? (
        <div>
          <p className="type-caption font-semibold uppercase text-on-surface-variant">
            {copy.paragraphFeedback}
          </p>
          <p className="mt-1 type-body-sm text-on-surface">
            {paragraph.feedback.comment}
          </p>
          {paragraph.feedback.improvements.length > 0 ? (
            <p className="mt-1 type-caption text-on-surface-variant">
              {copy.improve}: {paragraph.feedback.improvements.join("; ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {paragraph.corrections.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {paragraph.corrections.map((item, index) => (
            <li key={index} className="type-caption text-on-surface-variant">
              <span className="font-medium text-error">{item.original}</span>
              {" -> "}
              <span className="font-medium text-on-surface">
                {item.suggestion}
              </span>
              {item.explanation ? ` (${item.explanation})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EssayReview({ task }: { task: WritingTaskResult }) {
  const copy = useResultCopy();
  if (!task.essay.trim()) return null;
  return (
    <details
      open
      className="rounded-xl border border-outline-variant bg-surface px-3 py-2"
    >
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        {copy.submittedEssay}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {task.essayParagraphs.length > 0 ? (
          task.essayParagraphs.map((paragraph) => (
            <div key={paragraph.paragraph}>
              <p className="whitespace-pre-wrap type-body-sm text-on-surface">
                {paragraph.text}
              </p>
              <ParagraphAnnotations paragraph={paragraph} />
            </div>
          ))
        ) : (
          <p className="whitespace-pre-wrap type-body-sm text-on-surface">
            {task.essay}
          </p>
        )}
      </div>
    </details>
  );
}

function WritingTaskCard({ task }: { task: WritingTaskResult }) {
  const locale = useLocale();
  const copy = useResultCopy();
  const hasSubmissionReview = Boolean(task.prompt || task.essay.trim());
  const grading = gradingPresentationFromResult(task);
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title text-on-surface">
          {interpolate(copy.task, task.taskNumber)}
        </h3>
        <span className="type-body-sm text-on-surface-variant">
          {interpolate(copy.words, task.wordCount)} · {copy.band}{" "}
          <span className="font-bold text-on-surface tabular-nums">
            {bandText(task.taskBand)}
          </span>
        </span>
      </div>
      {hasSubmissionReview ? (
        <div className="mt-3 flex flex-col gap-3">
          <Prompt text={task.prompt} />
          <EssayReview task={task} />
        </div>
      ) : null}
      {grading ? (
        <div className="mt-3">
          <GradingResultDetails
            criteria={task.criteria}
            metadata={grading.metadata}
            retrySafeRunId={grading.retrySafeRunId}
            status={task.status as GradingProcessStatus}
            locale={locale}
          />
        </div>
      ) : null}
      {isScored(task.status) ? (
        <div className="mt-3 flex flex-col gap-3">
          <TeacherPublishedNote note={task.teacherFeedback} locale={locale} />
          {grading ? null : <CriteriaList criteria={task.criteria} />}
          {task.summary ? (
            <p className="type-body-sm text-on-surface">{task.summary}</p>
          ) : null}
          {task.vietnameseSummary ? (
            <p className="type-body-sm text-on-surface-variant">
              {task.vietnameseSummary}
            </p>
          ) : null}
          <Corrections items={task.inlineCorrections} />
        </div>
      ) : (
        <div className="mt-3">
          <PendingNote skill={interpolate(copy.task, task.taskNumber)} />
        </div>
      )}
      {task.modelAnswer ? (
        <div className="mt-3">
          <ModelAnswer text={task.modelAnswer} />
        </div>
      ) : null}
    </div>
  );
}

export function WritingResultPanel({ writing }: { writing: WritingResult }) {
  const copy = useResultCopy();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="type-heading-md text-on-surface">{copy.writing}</h2>
        <span className="type-body-sm text-on-surface-variant">
          {copy.band}{" "}
          <span className="font-bold text-on-surface tabular-nums">
            {bandText(writing.band)}
          </span>
        </span>
      </div>
      {writing.tasks.map((task) => (
        <WritingTaskCard key={task.questionId} task={task} />
      ))}
    </section>
  );
}
