import { ProductIcon } from "@/components/ui/product-icon";
import { Chip, Prose } from "../editorial";
import type { DebateReviewPanelCopy } from "../types";

const RING_SIZE = 96;
const RING_STROKE = 8;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({
  score,
  max,
  label,
}: {
  score: number;
  max: number;
  label: string;
}) {
  const progress = Math.max(0, Math.min(1, score / max));

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-surface-container-high"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="stroke-secondary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="type-heading-xl leading-none text-on-surface">
          {score}
        </span>
        <span className="type-caption text-on-surface-variant">
          {label} / {max}
        </span>
      </div>
    </div>
  );
}

/**
 * Mirrors the practice review the debate feedback surface produces: four scored
 * categories out of 100, a band name, and the single next move attached to the
 * sentence it came from.
 */
export function DebateReviewPanel({ copy }: { copy: DebateReviewPanelCopy }) {
  return (
    <div className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary text-on-primary">
            <ProductIcon name="scale" size="sm" />
          </span>
          <span className="type-label font-semibold text-on-surface">
            {copy.reviewLabel}
          </span>
        </div>
        <Chip tone="positive">{copy.band}</Chip>
      </div>

      <div className="border-l-2 border-outline pl-4">
        <p className="type-eyebrow text-on-surface-variant">
          {copy.motionLabel}
        </p>
        <Prose className="mt-2 text-on-surface">{copy.motion}</Prose>
        <p className="mt-2 type-caption text-on-surface-variant">
          {copy.speechMeta}
        </p>
      </div>

      <div className="flex items-center gap-5">
        <ScoreRing
          score={copy.score}
          max={copy.scoreMax}
          label={copy.scoreLabel}
        />
        <dl className="min-w-0 flex-1 space-y-2.5">
          {copy.categories.map((category) => (
            <div key={category.label}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="truncate type-caption text-on-surface-variant">
                  {category.label}
                </dt>
                <dd className="type-caption font-semibold tabular-nums text-on-surface">
                  {category.score}
                  <span className="text-on-surface-variant">
                    /{category.max}
                  </span>
                </dd>
              </div>
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-surface-container-high"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(category.score / category.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div
        // `border-secondary` resolves to the light literal in dark mode, so the
        // accent rule is driven straight off the runtime token instead.
        style={{ borderInlineStartColor: "var(--color-secondary)" }}
        className="rounded-[12px] border-l-2 bg-secondary-container p-4"
      >
        <div className="flex items-center gap-2">
          <ProductIcon name="target" size="sm" className="text-secondary" />
          <p className="type-eyebrow text-on-surface">{copy.nextMoveLabel}</p>
        </div>
        <Prose className="mt-2.5 text-on-surface">
          &ldquo;{copy.nextMoveQuote}&rdquo;
        </Prose>
        <p className="mt-2 type-body-sm text-on-surface-variant">
          {copy.nextMove}
        </p>
      </div>

      <p className="type-caption text-on-surface-variant">{copy.footnote}</p>
    </div>
  );
}
