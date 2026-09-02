"use client";

/**
 * Hotspot authoring for image stimuli (diagram / map / plan labelling): click
 * the preview to drop a hotspot at that % position, then edit slot / label /
 * x / y in the row list below. Coordinates are 0–100 percentages of the image
 * box so they survive any render size.
 */
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "@/components/ui/icons";
import { clampPercent, nextSlotId, type HotspotState } from "./authoring-utils";

interface Props {
  url: string;
  alt: string;
  hotspots: HotspotState[];
  onChange: (next: HotspotState[]) => void;
}

function HotspotRow({
  hotspot,
  onChange,
  onRemove,
}: {
  hotspot: HotspotState;
  onChange: (next: HotspotState) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.5fr_4.5rem_4.5rem_auto] items-center gap-2">
      <Input
        value={hotspot.slot}
        onChange={(e) => onChange({ ...hotspot, slot: e.target.value })}
        placeholder="slot"
        aria-label="Hotspot slot"
      />
      <Input
        value={hotspot.label}
        onChange={(e) => onChange({ ...hotspot, label: e.target.value })}
        placeholder="label (optional)"
        aria-label="Hotspot label"
      />
      <Input
        type="number"
        value={hotspot.x}
        onChange={(e) => onChange({ ...hotspot, x: clampPercent(Number(e.target.value)) })}
        aria-label="Hotspot x %"
      />
      <Input
        type="number"
        value={hotspot.y}
        onChange={(e) => onChange({ ...hotspot, y: clampPercent(Number(e.target.value)) })}
        aria-label="Hotspot y %"
      />
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove hotspot">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function HotspotPlacer({ url, alt, hotspots, onChange }: Props) {
  function place(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
    const slot = nextSlotId(hotspots.map((h) => h.slot));
    onChange([...hotspots, { slot, label: "", x, y }]);
  }

  function update(index: number, next: HotspotState) {
    onChange(hotspots.map((h, i) => (i === index ? next : h)));
  }

  function remove(index: number) {
    onChange(hotspots.filter((_, i) => i !== index));
  }

  if (!url.trim()) {
    return (
      <p className="type-caption text-on-surface-variant">
        Upload or paste an image URL to place hotspots.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="type-caption text-on-surface-variant">
        Click the image to add a hotspot. Each hotspot&apos;s slot is the member question&apos;s
        <code className="mx-1 rounded bg-surface-container px-1 text-on-surface">slot</code>value.
      </p>
      <div
        role="presentation"
        onClick={place}
        className="relative inline-block max-w-full cursor-crosshair overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
      >
        {/* Stimulus lives in Supabase storage (no next/image remote pattern). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt || "Stimulus preview"} className="block max-h-96 max-w-full" />
        {hotspots.map((h, index) => (
          <span
            key={`${h.slot}-${index}`}
            className="pointer-events-none absolute flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-on-primary bg-primary px-1 type-caption text-on-primary shadow-sm"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            {h.slot || "?"}
          </span>
        ))}
      </div>
      {hotspots.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1.5fr_4.5rem_4.5rem_auto] gap-2 px-0.5">
            <span className="type-caption text-on-surface-variant">Slot</span>
            <span className="type-caption text-on-surface-variant">Label</span>
            <span className="type-caption text-on-surface-variant">x %</span>
            <span className="type-caption text-on-surface-variant">y %</span>
            <span />
          </div>
          {hotspots.map((h, index) => (
            <HotspotRow
              key={index}
              hotspot={h}
              onChange={(next) => update(index, next)}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
