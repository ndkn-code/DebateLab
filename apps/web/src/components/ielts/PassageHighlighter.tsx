"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Eraser, Highlighter } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildHighlightSegments,
  MOCK_HIGHLIGHT_COLORS,
  mockAnnotationKey,
  type Highlight,
  type MockHighlightColor,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";

const HIGHLIGHT_STYLES: Record<
  MockHighlightColor,
  { label: string; className: string }
> = {
  yellow: {
    label: "Yellow",
    className:
      "bg-[var(--color-warning-container)] text-[var(--color-on-warning-container)] dark:bg-[var(--color-warning)] dark:text-[var(--color-on-reward)]",
  },
  green: {
    label: "Green",
    className:
      "bg-[var(--color-success-container)] text-[var(--color-on-surface)] dark:bg-[var(--color-success)] dark:text-[var(--color-on-success)]",
  },
  blue: {
    label: "Blue",
    className:
      "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] dark:bg-[var(--color-primary-fixed-dim)] dark:text-[var(--color-on-primary)]",
  },
  purple: {
    label: "Purple",
    className:
      "bg-[var(--color-chart-5)] text-[var(--color-on-primary)] dark:bg-[var(--color-chart-5)] dark:text-[var(--color-on-primary)]",
  },
  orange: {
    label: "Orange",
    className:
      "bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)] dark:bg-[var(--color-secondary)] dark:text-[var(--color-on-secondary)]",
  },
};

const EMPTY_HIGHLIGHTS: Highlight[] = [];

function offsetInContainer(
  container: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  if (!container.contains(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(container);
  try {
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return null;
  } finally {
    range.detach();
  }
}

function getSelectionOffsets(container: HTMLElement): [number, number] | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }
  const start = offsetInContainer(container, range.startContainer, range.startOffset);
  const end = offsetInContainer(container, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  return [Math.min(start, end), Math.max(start, end)];
}

function isSelectingText(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function TooltipIconButton({
  label,
  pressed,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex size-7 items-center justify-center rounded-full text-on-surface-variant transition-transform hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ColorSwatch({
  color,
  selected,
  onSelect,
}: {
  color: MockHighlightColor;
  selected: boolean;
  onSelect: (color: MockHighlightColor) => void;
}) {
  const style = HIGHLIGHT_STYLES[color];
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`${style.label} highlight`}
      aria-pressed={selected}
      onClick={() => onSelect(color)}
      className={cn(
        "rounded-full border border-outline-variant bg-surface p-1 text-on-surface transition-transform hover:scale-105",
        selected && "ring-2 ring-primary",
      )}
    >
      <span className={cn("size-4 rounded-full", style.className)} />
    </Button>
  );
}

function HighlightToolbar({
  highlightMode,
  selectedColor,
  highlightCount,
  onToggleMode,
  onSelectColor,
  onClearAll,
}: {
  highlightMode: boolean;
  selectedColor: MockHighlightColor;
  highlightCount: number;
  onToggleMode: () => void;
  onSelectColor: (color: MockHighlightColor) => void;
  onClearAll: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedStyle = HIGHLIGHT_STYLES[selectedColor];

  return (
    <TooltipProvider>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1 shadow-token-card">
        <TooltipIconButton
          label={highlightMode ? "Disable highlighting" : "Enable highlighting"}
          pressed={highlightMode}
          onClick={onToggleMode}
          className={highlightMode ? "bg-primary text-on-primary" : undefined}
        >
          <Highlighter className="size-4" />
        </TooltipIconButton>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            type="button"
            aria-label="Highlight color"
            title="Highlight color"
            className="flex size-7 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className={cn("size-4 rounded-full", selectedStyle.className)} />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex items-center gap-1">
              {MOCK_HIGHLIGHT_COLORS.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  selected={selectedColor === color}
                  onSelect={(nextColor) => {
                    onSelectColor(nextColor);
                    setPickerOpen(false);
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <TooltipIconButton
          label="Clear passage highlights"
          disabled={highlightCount === 0}
          onClick={onClearAll}
        >
          <Eraser className="size-4" />
        </TooltipIconButton>
      </div>
    </TooltipProvider>
  );
}

export function PassageHighlighter({
  passageKey,
  title,
  body,
}: {
  passageKey: string;
  title: string;
  body: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [highlightMode, setHighlightMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState<MockHighlightColor>("yellow");

  const activeAttemptId = useMockAnnotationsStore((state) => state.activeAttemptId);
  const highlights = useMockAnnotationsStore((state) =>
    activeAttemptId
      ? (state.highlights[mockAnnotationKey(activeAttemptId, passageKey)] ?? EMPTY_HIGHLIGHTS)
      : EMPTY_HIGHLIGHTS,
  );
  const addHighlight = useMockAnnotationsStore((state) => state.addHighlight);
  const removeHighlight = useMockAnnotationsStore((state) => state.removeHighlight);
  const clearHighlights = useMockAnnotationsStore((state) => state.clearHighlights);

  const segments = useMemo(
    () => buildHighlightSegments(body, highlights),
    [body, highlights],
  );

  const applySelection = useCallback(() => {
    if (!highlightMode || !bodyRef.current) return;
    const offsets = getSelectionOffsets(bodyRef.current);
    if (!offsets) return;
    const [start, end] = offsets;
    if (body.slice(start, end).trim().length === 0) return;
    addHighlight(passageKey, start, end, selectedColor);
    window.getSelection()?.removeAllRanges();
  }, [addHighlight, body, highlightMode, passageKey, selectedColor]);

  const handleTouchEnd = useCallback(() => {
    window.setTimeout(applySelection, 80);
  }, [applySelection]);

  const handleHighlightClick = useCallback(
    (highlight: Highlight) => {
      if (isSelectingText()) return;
      removeHighlight(passageKey, highlight.id);
    },
    [passageKey, removeHighlight],
  );

  return (
    <article className="max-h-[60vh] overflow-y-auto rounded-3xl border border-outline-variant bg-surface-container p-5 text-sm leading-relaxed text-on-surface">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-bold">{title}</h3>
        <HighlightToolbar
          highlightMode={highlightMode}
          selectedColor={selectedColor}
          highlightCount={highlights.length}
          onToggleMode={() => setHighlightMode((value) => !value)}
          onSelectColor={setSelectedColor}
          onClearAll={() => clearHighlights(passageKey)}
        />
      </div>
      <div
        ref={bodyRef}
        onMouseUp={applySelection}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "whitespace-pre-wrap",
          highlightMode ? "cursor-text select-text" : "select-text",
        )}
      >
        {segments.map((segment) =>
          segment.highlight ? (
            <span
              key={`${segment.start}:${segment.end}:${segment.highlight.id}`}
              role="button"
              tabIndex={0}
              title="Remove highlight"
              data-highlight-id={segment.highlight.id}
              onClick={(event) => {
                event.stopPropagation();
                handleHighlightClick(segment.highlight!);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleHighlightClick(segment.highlight!);
              }}
              className={cn(
                "box-decoration-clone rounded px-0.5 decoration-2 transition-colors animate-in fade-in-0 duration-200",
                HIGHLIGHT_STYLES[segment.highlight.color].className,
              )}
            >
              {segment.text}
            </span>
          ) : (
            <span key={`${segment.start}:${segment.end}`}>{segment.text}</span>
          ),
        )}
      </div>
      {highlightMode ? (
        <span className="sr-only">
          Highlight mode is on. Select passage text to apply the selected color.
        </span>
      ) : null}
    </article>
  );
}
