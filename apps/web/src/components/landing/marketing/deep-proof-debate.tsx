import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { SectionHead, Shell } from "./editorial";
import { Reveal } from "./reveal";
import type { DebateProofCopy } from "./types";

function Legend({ copy }: { copy: DebateProofCopy }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <li className="flex items-center gap-2 type-caption text-on-surface-variant">
        <span
          aria-hidden="true"
          className="h-0.5 w-6 rounded-full bg-success"
        />
        {copy.legend.strength}
      </li>
      <li className="flex items-center gap-2 type-caption text-on-surface-variant">
        <span
          aria-hidden="true"
          className="h-0 w-6 rounded-full border-t-2 border-dashed border-secondary"
        />
        {copy.legend.improvement}
      </li>
    </ul>
  );
}

/**
 * The annotated transcript: the artifact a debate review actually produces.
 * Marks are numbered so the link between a line and its note survives without
 * colour, hover, or motion.
 */
export function DebateDeepProof({ copy }: { copy: DebateProofCopy }) {
  // Marker numbers are derived up front so the transcript stays a pure map and
  // each mark keeps the same number as its note in the margin column.
  const markNumbers = copy.segments.reduce<number[]>((acc, segment, index) => {
    acc[index] = segment.mark
      ? (acc[index - 1] ?? 0) + 1
      : (acc[index - 1] ?? 0);
    return acc;
  }, []);

  return (
    <section
      id="proof"
      className="border-b border-outline-variant bg-surface-container-low"
    >
      <Shell className="py-20 sm:py-24 lg:py-28">
        <SectionHead
          index="03"
          mark={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
        />

        <Reveal className="mt-14 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div className="rounded-[12px] border border-outline-variant bg-surface p-6 shadow-token-card sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-outline-variant pb-4">
                <p className="type-eyebrow text-on-surface-variant">
                  {copy.transcriptLabel}
                </p>
                <p className="type-caption text-on-surface-variant">
                  {copy.speaker}
                </p>
              </div>

              <p className="mt-6 type-prose text-on-surface">
                {copy.segments.map((segment, index) => {
                  if (!segment.mark) {
                    return <span key={index}>{segment.text}</span>;
                  }
                  return (
                    <mark
                      key={index}
                      className={cn(
                        "bg-transparent text-on-surface",
                        segment.mark === "strength"
                          ? "border-b-2 border-success"
                          : "border-b-2 border-dashed border-secondary",
                      )}
                    >
                      {segment.text}
                      <sup className="ml-0.5 type-code align-super text-on-surface-variant">
                        {markNumbers[index]}
                      </sup>
                    </mark>
                  );
                })}
              </p>

              <div className="mt-7 border-t border-outline-variant pt-4">
                <Legend copy={copy} />
              </div>
            </div>
          </div>

          <ol
            className="lg:col-span-5 lg:pt-2"
            aria-label={copy.transcriptLabel}
          >
            {copy.annotations.map((annotation, index) => (
              <li
                key={annotation.tag}
                className={cn(
                  "flex gap-4 py-5",
                  index > 0 && "border-t border-outline-variant",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border type-code",
                    annotation.severity === "strength"
                      ? "border-transparent bg-success-container text-on-surface"
                      : "border-transparent bg-secondary-container text-on-surface",
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 type-eyebrow text-on-surface-variant">
                    <ProductIcon
                      name={
                        annotation.severity === "strength"
                          ? "checkCircle"
                          : "target"
                      }
                      size="xs"
                      className={
                        annotation.severity === "strength"
                          ? "text-success"
                          : "text-secondary"
                      }
                    />
                    {annotation.tag}
                  </p>
                  <p className="mt-2 type-body-sm text-on-surface">
                    {annotation.feedback}
                  </p>
                  <p className="mt-3 type-body-sm text-on-surface-variant">
                    <span className="type-label font-semibold text-on-surface">
                      {annotation.suggestionLabel}:{" "}
                    </span>
                    {annotation.suggestion}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <p className="mt-10 type-caption text-on-surface-variant">
          {copy.footnote}
        </p>
      </Shell>
    </section>
  );
}
