import type {
  SpeakingPronunciationHeatmap,
  SpeakingPronunciationHeatmapPhoneme,
  SpeakingPronunciationHeatmapWord,
} from "@/lib/ielts/results/types";
import { useSkillFeedbackCopy } from "./skill-feedback-copy";

function levelClass(level: "strong" | "watch" | "focus"): string {
  if (level === "strong") return "bg-success-container text-success-dim";
  if (level === "watch") {
    return "bg-warning-container text-on-warning-container";
  }
  return "bg-error-container text-error";
}

function HeatmapPhoneme({
  item,
}: {
  item: SpeakingPronunciationHeatmapPhoneme;
}) {
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
        <span
          className={`inline-flex min-h-5 items-center rounded-md px-2 type-caption ${levelClass(word.level)}`}
        >
          {word.word}
        </span>
        <span className="type-caption text-on-surface-variant tabular-nums">
          {Math.round(word.accuracy)}/100
        </span>
      </div>
      {word.phonemes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5 type-caption">
          {word.phonemes.map((phoneme, index) => (
            <HeatmapPhoneme
              key={`${word.word}-${phoneme.phoneme}-${index}`}
              item={phoneme}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PronunciationHeatmap({
  heatmap,
}: {
  heatmap: SpeakingPronunciationHeatmap | null;
}) {
  const copy = useSkillFeedbackCopy();
  if (!heatmap) {
    return (
      <p className="rounded-xl bg-surface-container-low px-3 py-2 type-body-sm text-on-surface-variant">
        {copy.heatmapUnavailable}
      </p>
    );
  }

  return (
    <details className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        {copy.heatmap}
      </summary>
      {heatmap.overall ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {[
            [copy.accuracy, heatmap.overall.accuracy],
            [copy.fluency, heatmap.overall.fluency],
            [copy.completeness, heatmap.overall.completeness],
            [copy.pronunciation, heatmap.overall.pronunciation],
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
