"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import {
  MOCK_HIGHLIGHT_COLORS,
  type MockHighlightColor,
} from "@/lib/stores/mockAnnotationsStore";
import { HIGHLIGHT_STYLES } from "./annotation-styles";

interface ExamAnnotationToolbarProps {
  highlightMode: boolean;
  selectedColor: MockHighlightColor;
  noteCount: number;
  compact?: boolean;
  onToggleHighlightMode: () => void;
  onSelectColor: (color: MockHighlightColor) => void;
  onOpenNotes: () => void;
}

export function ExamAnnotationToolbar({
  highlightMode,
  selectedColor,
  noteCount,
  compact = false,
  onToggleHighlightMode,
  onSelectColor,
  onOpenNotes,
}: ExamAnnotationToolbarProps) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const selectedStyle = HIGHLIGHT_STYLES[selectedColor];

  return (
    <div
      data-exam-toolbar="annotations"
      className={cn(
        "flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-token-card",
        compact && "p-0.5",
        !compact && "min-h-10",
      )}
      aria-label="Exam annotation tools"
    >
      <button
        type="button"
        onClick={onToggleHighlightMode}
        aria-pressed={highlightMode}
        aria-label={highlightMode ? "Turn highlight mode off" : "Turn highlight mode on"}
        title={highlightMode ? "Highlight mode on" : "Highlight mode off"}
        className={cn(
          "flex items-center justify-center rounded-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          compact ? "size-7" : "size-8",
          highlightMode
            ? "bg-primary text-on-primary"
            : "text-on-surface-variant hover:bg-surface-container",
        )}
      >
        <ProductIcon name="highlighter" size="sm" weight="bold" />
      </button>

      <Popover open={colorsOpen} onOpenChange={setColorsOpen}>
        <PopoverTrigger
          type="button"
          aria-label={`Highlight color: ${selectedStyle.label}`}
          className={cn(
            "flex items-center justify-center rounded-lg hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            compact ? "size-7" : "size-8",
          )}
        >
          <span className={cn("size-4 rounded-full border border-outline", selectedStyle.className)} />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto rounded-2xl p-2">
          <div className="flex gap-1" aria-label="Highlight colors">
            {MOCK_HIGHLIGHT_COLORS.map((color) => {
              const style = HIGHLIGHT_STYLES[color];
              return (
                <Button
                  key={color}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${style.label} highlight`}
                  aria-pressed={selectedColor === color}
                  onClick={() => {
                    onSelectColor(color);
                    setColorsOpen(false);
                  }}
                  className={cn(
                    "rounded-full p-1 transition-transform hover:scale-110",
                    selectedColor === color && "ring-2 ring-primary",
                  )}
                >
                  <span className={cn("size-5 rounded-full", style.className)} />
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onOpenNotes}
        aria-label={`Open exam notes${noteCount > 0 ? `, ${noteCount}` : ""}`}
        title="Exam notes"
        className={cn(
          "relative flex items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          compact ? "size-7" : "size-8",
        )}
      >
        <ProductIcon name="fileText" size="sm" weight="bold" />
        {noteCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-xs font-extrabold leading-4 text-on-secondary">
            {noteCount > 99 ? "99+" : noteCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
