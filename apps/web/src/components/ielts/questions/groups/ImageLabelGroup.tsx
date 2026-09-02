"use client";

/**
 * Diagram / map / plan labelling: the image in a zoomable box with a pin at
 * every hotspot. Desktop select mode makes each pin a drop target (plus the
 * bank below); text mode and compact viewports list numbered controls under
 * the image with matching pin numbers.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, RotateCcw } from "@/components/ui/icons";
import type { IeltsGroupStimulus } from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";
import { GroupBank } from "./GroupBank";
import { GroupSlot } from "./GroupSlot";
import { slotVerdictState } from "./group-answers";
import { useGroupContext } from "./group-context";
import { NumberedBlank } from "./NumberedBlank";

const ZOOM_LEVELS = [1, 1.5, 2] as const;

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-exam-control
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface-variant transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ImageLabelGroup({
  stimulus,
}: {
  stimulus: Extract<IeltsGroupStimulus, { kind: "image" }>;
}) {
  const t = useTranslations("ielts.player.groups");
  const ctx = useGroupContext();
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIndex] ?? 1;
  const pinsAreSlots = ctx.selectMode && !ctx.compact;

  return (
    <div className="flex flex-col gap-3">
      <figure className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-1">
          <ZoomButton
            label={t("zoomOut")}
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </ZoomButton>
          <span className="min-w-10 text-center type-caption text-on-surface-variant">{zoom}×</span>
          <ZoomButton
            label={t("zoomIn")}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
          >
            <Plus className="size-4" aria-hidden="true" />
          </ZoomButton>
          <ZoomButton label={t("zoomReset")} disabled={zoomIndex === 0} onClick={() => setZoomIndex(0)}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </ZoomButton>
        </div>
        <div className="max-h-[32rem] overflow-auto rounded-lg border border-outline-variant bg-surface">
          <div className="relative" style={{ width: `${zoom * 100}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- authored diagrams are arbitrary remote assets */}
            <img src={stimulus.url} alt={stimulus.alt} className="block w-full" draggable={false} />
            {stimulus.hotspots.map((hotspot, index) => {
              const owner = ctx.slots.get(hotspot.id);
              const label = owner?.number.label ?? hotspot.label ?? String(index + 1);
              const state = owner ? slotVerdictState(ctx.verdicts, owner.questionId) : "idle";
              return (
                <span
                  key={hotspot.id}
                  id={owner && pinsAreSlots ? `mock-q-${owner.questionId}` : undefined}
                  style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 scroll-mt-24"
                >
                  {owner && pinsAreSlots ? (
                    <GroupSlot questionId={owner.questionId} number={owner.number} layout="pin" />
                  ) : (
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full type-caption font-bold shadow-sm ring-2 ring-surface",
                        state === "correct" && "bg-success text-on-success",
                        state === "incorrect" && "bg-error text-on-error",
                        state === "idle" && "bg-primary text-on-primary",
                      )}
                    >
                      {label}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        {stimulus.caption ? (
          <figcaption className="type-caption text-on-surface-variant">{stimulus.caption}</figcaption>
        ) : null}
      </figure>

      {pinsAreSlots ? (
        <GroupBank />
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {ctx.slotList.map((ref) => (
            <li key={ref.questionId} className="min-w-0">
              <NumberedBlank questionId={ref.questionId} layout="block" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
