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
  SpeakingPronunciationHeatmap,
  SpeakingPronunciationHeatmapPhoneme,
  SpeakingPronunciationHeatmapWord,
  SpeakingResult,
  WritingEssayParagraph,
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

function Prompt({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="rounded-xl bg-surface-container-low px-3 py-2 type-body-sm text-on-surface">
      {text}
    </p>
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

function ParagraphAnnotations({ paragraph }: { paragraph: WritingEssayParagraph }) {
  if (!paragraph.feedback && paragraph.corrections.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-surface-container-low px-3 py-2">
      {paragraph.feedback ? (
        <div>
          <p className="type-caption font-semibold uppercase text-on-surface-variant">
            Paragraph feedback
          </p>
          <p className="mt-1 type-body-sm text-on-surface">{paragraph.feedback.comment}</p>
          {paragraph.feedback.improvements.length > 0 ? (
            <p className="mt-1 type-caption text-on-surface-variant">
              Improve: {paragraph.feedback.improvements.join("; ")}
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
              <span className="font-medium text-on-surface">{item.suggestion}</span>
              {item.explanation ? ` (${item.explanation})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EssayReview({ task }: { task: WritingTaskResult }) {
  if (!task.essay.trim()) return null;
  return (
    <details open className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        Submitted essay
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
          <p className="whitespace-pre-wrap type-body-sm text-on-surface">{task.essay}</p>
        )}
      </div>
    </details>
  );
}

function WritingTaskCard({ task }: { task: WritingTaskResult }) {
  const hasSubmissionReview = Boolean(task.prompt || task.essay.trim());
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title text-on-surface">Task {task.taskNumber}</h3>
        <span className="type-body-sm text-on-surface-variant">
          {task.wordCount} words · band{" "}
          <span className="font-bold text-on-surface tabular-nums">{bandText(task.taskBand)}</span>
        </span>
      </div>
      {hasSubmissionReview ? (
        <div className="mt-3 flex flex-col gap-3">
          <Prompt text={task.prompt} />
          <EssayReview task={task} />
        </div>
      ) : null}
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
        </div>
      ) : (
        <div className="mt-3">
          <PendingNote skill={`Task ${task.taskNumber}`} />
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

function levelClass(level: "strong" | "watch" | "focus"): string {
  if (level === "strong") return "bg-success-container text-success-dim";
  if (level === "watch") return "bg-warning-container text-on-warning-container";
  return "bg-error-container text-error";
}

function HeatmapPhoneme({ item }: { item: SpeakingPronunciationHeatmapPhoneme }) {
  return (
    <span className={`rounded px-1 py-0.5 ${levelClass(item.level)}`}>
      {item.phoneme}
      <span className="ml-1 tabular-nums">{Math.round(item.accuracy)}</span>
    </span>
  );
}

function HeatmapWord({ word }: { word: SpeakingPronunciationHeatmapWord }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 type-caption ${levelClass(word.level)}`}>
          {word.word}
        </span>
        <span className="type-caption text-on-surface-variant tabular-nums">
          {Math.round(word.accuracy)}/100
        </span>
        {word.errorType !== "None" ? (
          <span className="type-caption text-on-surface-variant">{word.errorType}</span>
        ) : null}
      </div>
      {word.phonemes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5 type-caption">
          {word.phonemes.map((phoneme, index) => (
            <HeatmapPhoneme key={`${word.word}-${phoneme.phoneme}-${index}`} item={phoneme} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PronunciationHeatmap({
  heatmap,
}: {
  heatmap: SpeakingPronunciationHeatmap | null;
}) {
  if (!heatmap) {
    return (
      <p className="rounded-xl bg-surface-container-low px-3 py-2 type-body-sm text-on-surface-variant">
        Pronunciation heatmap is not available for this response yet.
      </p>
    );
  }
  return (
    <details className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        Pronunciation heatmap
      </summary>
      {heatmap.overall ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {[
            ["Accuracy", heatmap.overall.accuracy],
            ["Fluency", heatmap.overall.fluency],
            ["Completeness", heatmap.overall.completeness],
            ["Pronunciation", heatmap.overall.pronunciation],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-surface px-2 py-1">
              <p className="type-caption text-on-surface-variant">{label}</p>
              <p className="type-body-sm font-bold text-on-surface tabular-nums">
                {Math.round(Number(value))}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {heatmap.words.map((word, index) => (
          <HeatmapWord key={`${word.word}-${index}`} word={word} />
        ))}
      </div>
    </details>
  );
}

function SpeakingPartCard({ part }: { part: SpeakingPartResult }) {
  const label = part.partNumber ? `Part ${part.partNumber}` : "Speaking response";
  const hasTranscript = part.transcript.trim().length > 0;
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title text-on-surface">{label}</h3>
        <span className="type-body-sm text-on-surface-variant">
          band <span className="font-bold text-on-surface tabular-nums">{bandText(part.band)}</span>
        </span>
      </div>
      {part.prompt || hasTranscript ? (
        <div className="mt-3 flex flex-col gap-3">
          <Prompt text={part.prompt} />
          {hasTranscript ? (
            <div className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
              <p className="type-caption font-semibold uppercase text-on-surface-variant">
                Transcript
              </p>
              <p className="mt-1 whitespace-pre-wrap type-body-sm text-on-surface">
                {part.transcript}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {isScored(part.status) ? (
        <div className="mt-3 flex flex-col gap-3">
          <CriteriaList criteria={part.criteria} />
          {part.summary ? (
            <p className="type-body-sm text-on-surface">{part.summary}</p>
          ) : null}
          <PronunciationHeatmap heatmap={part.pronunciationHeatmap} />
        </div>
      ) : (
        <div className="mt-3">
          <PendingNote skill={label} />
        </div>
      )}
      {part.modelAnswer ? (
        <div className="mt-3">
          <ModelAnswer text={part.modelAnswer} />
        </div>
      ) : null}
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
