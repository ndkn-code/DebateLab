/**
 * Writing & Speaking result panels (WS-2.2). Renders the typed per-criterion
 * bands + transparency feedback the AI scorers (WS-3.1/3.2) persist, with a
 * graceful "scoring in progress" state while a response is still being marked
 * (so the page integrates cleanly as those cards land). Server component.
 */
import type {
  CriterionScore,
  ResultsInlineCorrection,
  SpeakingPartResult,
  SpeakingResult,
  WritingResult,
  WritingTaskResult,
} from "@/lib/ielts/results/types";
import { bandText } from "./format";

function isScored(status: string): boolean {
  return status === "scored" || status === "overridden";
}

function CriteriaList({ criteria }: { criteria: CriterionScore[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {criteria.map((criterion) => (
        <li key={criterion.key} className="rounded-xl bg-surface-container-low px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="type-body-sm font-medium text-on-surface">{criterion.label}</span>
            <span className="type-body-sm font-bold text-on-surface tabular-nums">
              {bandText(criterion.band)}
            </span>
          </div>
          {criterion.rationale ? (
            <p className="mt-1 type-caption text-on-surface-variant">{criterion.rationale}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PendingNote({ skill }: { skill: string }) {
  return (
    <p className="rounded-xl bg-warning-container px-3 py-2 type-body-sm text-on-warning-container">
      {skill} is still being scored — this section updates automatically when
      marking finishes.
    </p>
  );
}

function Corrections({ items }: { items: ResultsInlineCorrection[] }) {
  if (items.length === 0) return null;
  return (
    <details className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        Corrections ({items.length})
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="type-body-sm">
            <span className="text-error line-through">{item.original}</span>
            {" → "}
            <span className="font-medium text-on-surface">{item.suggestion}</span>
            {item.explanation ? (
              <span className="text-on-surface-variant"> — {item.explanation}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ModelAnswer({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <details className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        Band 9 model answer
      </summary>
      <p className="mt-2 whitespace-pre-wrap type-body-sm text-on-surface-variant">{text}</p>
    </details>
  );
}

function WritingTaskCard({ task }: { task: WritingTaskResult }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title text-on-surface">Task {task.taskNumber}</h3>
        <span className="type-body-sm text-on-surface-variant">
          {task.wordCount} words · band{" "}
          <span className="font-bold text-on-surface tabular-nums">{bandText(task.taskBand)}</span>
        </span>
      </div>
      {isScored(task.status) ? (
        <div className="mt-3 flex flex-col gap-3">
          <CriteriaList criteria={task.criteria} />
          {task.summary ? (
            <p className="type-body-sm text-on-surface">{task.summary}</p>
          ) : null}
          {task.vietnameseSummary ? (
            <p className="type-body-sm text-on-surface-variant">{task.vietnameseSummary}</p>
          ) : null}
          <Corrections items={task.inlineCorrections} />
          <ModelAnswer text={task.modelAnswer} />
        </div>
      ) : (
        <div className="mt-3">
          <PendingNote skill={`Task ${task.taskNumber}`} />
        </div>
      )}
    </div>
  );
}

export function WritingResultPanel({ writing }: { writing: WritingResult }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="type-heading-md text-on-surface">Writing</h2>
        <span className="type-body-sm text-on-surface-variant">
          band <span className="font-bold text-on-surface tabular-nums">{bandText(writing.band)}</span>
        </span>
      </div>
      {writing.tasks.map((task) => (
        <WritingTaskCard key={task.questionId} task={task} />
      ))}
    </section>
  );
}

function SpeakingPartCard({ part }: { part: SpeakingPartResult }) {
  const label = part.partNumber ? `Part ${part.partNumber}` : "Speaking response";
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title text-on-surface">{label}</h3>
        <span className="type-body-sm text-on-surface-variant">
          band <span className="font-bold text-on-surface tabular-nums">{bandText(part.band)}</span>
        </span>
      </div>
      {isScored(part.status) ? (
        <div className="mt-3 flex flex-col gap-3">
          <CriteriaList criteria={part.criteria} />
          {part.summary ? (
            <p className="type-body-sm text-on-surface">{part.summary}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <PendingNote skill={label} />
        </div>
      )}
    </div>
  );
}

export function SpeakingResultPanel({ speaking }: { speaking: SpeakingResult }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="type-heading-md text-on-surface">Speaking</h2>
        <span className="type-body-sm text-on-surface-variant">
          band <span className="font-bold text-on-surface tabular-nums">{bandText(speaking.band)}</span>
        </span>
      </div>
      {speaking.parts.map((part) => (
        <SpeakingPartCard key={part.questionId} part={part} />
      ))}
    </section>
  );
}
