import type { MockHighlightColor } from "@/lib/stores/mockAnnotationsStore";

export const HIGHLIGHT_STYLES: Record<
  MockHighlightColor,
  { label: string; className: string }
> = {
  yellow: { label: "Yellow", className: "bg-highlight-yellow text-highlight-ink" },
  green: { label: "Green", className: "bg-highlight-green text-highlight-ink" },
  blue: { label: "Blue", className: "bg-highlight-blue text-highlight-ink" },
  purple: { label: "Purple", className: "bg-highlight-purple text-highlight-ink" },
  orange: { label: "Orange", className: "bg-highlight-orange text-highlight-ink" },
};

