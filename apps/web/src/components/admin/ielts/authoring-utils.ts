/**
 * Pure helpers shared by the IELTS authoring forms (format-variety pass):
 * option-line parsing (`id | label | text`), stimulus editor state ↔ the stored
 * `GroupStimulusSchema` shape, and a JSON-safe "count members" helper. No React.
 */
import { GroupStimulusSchema, type IeltsGroupStimulusInput } from "@/lib/ielts/question-types/groups";

export interface OptionEntry {
  id: string;
  label?: string;
  text: string;
}

/**
 * One authored line → bank/item entry.
 *  - `id | label | text` → full object
 *  - `id | text`         → object without a label
 *  - `text`              → bare string (label auto-assigned by the renderer)
 */
export function parseOptionLine(line: string): OptionEntry | string {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length >= 3) {
    return { id: parts[0], label: parts[1] || undefined, text: parts.slice(2).join(" | ") };
  }
  if (parts.length === 2) return { id: parts[0], text: parts[1] };
  return parts[0];
}

export function parseOptionLines(value: string): Array<OptionEntry | string> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseOptionLine);
}

/** Matching `items` must be objects — bare lines get a positional id. */
export function toItemEntries(value: string): OptionEntry[] {
  return parseOptionLines(value).map((entry, index) =>
    typeof entry === "string" ? { id: String(index + 1), text: entry } : entry,
  );
}

function entryToLine(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const text = typeof record.text === "string" ? record.text : "";
  const label = typeof record.label === "string" ? record.label : null;
  if (!id) return text || null;
  return label === null ? `${id} | ${text}` : `${id} | ${label} | ${text}`;
}

/** Stored bank / items JSON → textarea lines (inverse of `parseOptionLines`). */
export function optionLinesFromJson(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .map(entryToLine)
    .filter((line): line is string => line !== null)
    .join("\n");
}

// ── Stimulus editor state ────────────────────────────────────────────────────

export type StimulusKind = "none" | "text" | "table" | "flowchart" | "image";
export const STIMULUS_KINDS: Array<{ id: StimulusKind; label: string }> = [
  { id: "none", label: "None" },
  { id: "text", label: "Text with blanks" },
  { id: "table", label: "Table" },
  { id: "flowchart", label: "Flow chart" },
  { id: "image", label: "Image / diagram" },
];

export interface TableCellState {
  text: string;
  gap: boolean;
  slot: string;
  label: string;
}

export interface HotspotState {
  slot: string;
  label: string;
  x: number;
  y: number;
}

/** Flat so switching kinds in the picker never loses what was typed. */
export interface StimulusState {
  kind: StimulusKind;
  heading: string;
  body: string;
  caption: string;
  headers: string[];
  rows: TableCellState[][];
  title: string;
  direction: "down" | "right";
  steps: string[];
  url: string;
  alt: string;
  hotspots: HotspotState[];
}

export function emptyCell(): TableCellState {
  return { text: "", gap: false, slot: "", label: "" };
}

export function emptyStimulusState(): StimulusState {
  return {
    kind: "none",
    heading: "",
    body: "",
    caption: "",
    headers: ["", ""],
    rows: [[emptyCell(), emptyCell()]],
    title: "",
    direction: "down",
    steps: [""],
    url: "",
    alt: "",
    hotspots: [],
  };
}

/** Stored `ielts_question_groups.stimulus` → editor state (tolerant). */
export function stimulusStateFromRow(raw: unknown): StimulusState {
  const state = emptyStimulusState();
  const parsed = GroupStimulusSchema.safeParse(raw);
  if (!parsed.success) return state;
  const s = parsed.data;
  state.kind = s.kind;
  if (s.kind === "text") {
    state.heading = s.heading ?? "";
    state.body = s.body;
  } else if (s.kind === "table") {
    state.caption = s.caption ?? "";
    state.headers = s.headers.length > 0 ? [...s.headers] : state.headers;
    state.rows = s.rows.map((row) =>
      row.map((cell) =>
        typeof cell === "string"
          ? { text: cell, gap: false, slot: "", label: "" }
          : { text: "", gap: true, slot: cell.gap, label: cell.label ?? "" },
      ),
    );
    if (state.rows.length === 0) state.rows = [state.headers.map(() => emptyCell())];
  } else if (s.kind === "flowchart") {
    state.title = s.title ?? "";
    state.direction = s.direction;
    state.steps = s.steps.map((step) => step.text);
  } else {
    state.url = s.url;
    state.alt = s.alt;
    state.caption = s.caption ?? "";
    state.hotspots = s.hotspots.map((h) => ({
      slot: (h.slot ?? h.id) as string,
      label: h.label ?? "",
      x: h.x,
      y: h.y,
    }));
  }
  return state;
}

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Editor state → the exact `stimulus` payload the group actions validate. */
export function stimulusStateToPayload(state: StimulusState): IeltsGroupStimulusInput | null {
  switch (state.kind) {
    case "none":
      return null;
    case "text":
      return { kind: "text", heading: orUndefined(state.heading), body: state.body };
    case "table":
      return {
        kind: "table",
        caption: orUndefined(state.caption),
        headers: state.headers.map((h) => h.trim()),
        rows: state.rows.map((row) =>
          row.map((cell) =>
            cell.gap ? { gap: cell.slot.trim(), label: orUndefined(cell.label) } : cell.text,
          ),
        ),
      };
    case "flowchart":
      return {
        kind: "flowchart",
        title: orUndefined(state.title),
        direction: state.direction,
        steps: state.steps.filter((text) => text.trim().length > 0).map((text) => ({ text })),
      };
    case "image":
      return {
        kind: "image",
        url: state.url.trim(),
        alt: state.alt.trim(),
        caption: orUndefined(state.caption),
        hotspots: state.hotspots.map((h) => ({
          slot: h.slot.trim(),
          label: orUndefined(h.label),
          x: h.x,
          y: h.y,
        })),
      };
  }
}

/** Next unused numeric slot id (`1`, `2`, …) given the ids already placed. */
export function nextSlotId(existing: readonly string[]): string {
  const used = new Set(existing);
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

/** Append a `__BLANK_<slot>__` marker to a text, choosing the next free slot. */
export function appendBlankMarker(text: string, existingSlots: readonly string[]): string {
  const slot = nextSlotId(existingSlots);
  const separator = text.length === 0 || /\s$/.test(text) ? "" : " ";
  return `${text}${separator}__BLANK_${slot}__`;
}

export function clampPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}
