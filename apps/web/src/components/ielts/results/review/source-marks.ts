/**
 * Pure slicer that turns a part's raw `sourceText` plus the located answer
 * ranges into paragraphs of plain / marked segments. Offsets are over the raw
 * text; the UI renders segments as React children (never `innerHTML`), so
 * the passage is escaped for free. Overlapping ranges are resolved in start
 * order (a later range that starts inside an earlier one is trimmed to begin
 * where the earlier one ends), and a range that spans a paragraph boundary
 * yields one marked segment per paragraph.
 */

export interface SourceMark {
  questionId: string;
  start: number;
  end: number;
}

export type SourceSegment =
  | { kind: "text"; text: string }
  | { kind: "mark"; text: string; questionId: string; first: boolean };

export interface SourceParagraph {
  start: number;
  end: number;
  segments: SourceSegment[];
}

interface Range {
  start: number;
  end: number;
}

const BLANK_LINE = /\n[ \t\r]*\n/g;
const ANY_NEWLINE = /\n/g;

function trimRange(text: string, range: Range): Range | null {
  let { start, end } = range;
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return end > start ? { start, end } : null;
}

function splitOn(text: string, separator: RegExp): Range[] {
  const ranges: Range[] = [];
  let cursor = 0;
  separator.lastIndex = 0;
  for (const match of text.matchAll(separator)) {
    const index = match.index ?? 0;
    const trimmed = trimRange(text, { start: cursor, end: index });
    if (trimmed) ranges.push(trimmed);
    cursor = index + match[0].length;
  }
  const tail = trimRange(text, { start: cursor, end: text.length });
  if (tail) ranges.push(tail);
  return ranges;
}

/**
 * Paragraph ranges of the raw text: blank-line separated when the text has
 * blank lines, otherwise one paragraph per line. Whitespace-only paragraphs
 * are dropped; offsets stay relative to the raw text.
 */
export function paragraphRanges(text: string): Range[] {
  const byBlankLine = splitOn(text, BLANK_LINE);
  if (byBlankLine.length > 1) return byBlankLine;
  return splitOn(text, ANY_NEWLINE);
}

/** Clamp, sort, and de-overlap marks against a text of the given length. */
export function normalizeMarks(marks: readonly SourceMark[], length: number): SourceMark[] {
  const sorted = marks
    .map((mark) => ({
      questionId: mark.questionId,
      start: Math.max(0, Math.min(length, Math.floor(mark.start))),
      end: Math.max(0, Math.min(length, Math.floor(mark.end))),
    }))
    .filter((mark) => Number.isFinite(mark.start) && Number.isFinite(mark.end))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: SourceMark[] = [];
  let cursor = 0;
  for (const mark of sorted) {
    const start = Math.max(mark.start, cursor);
    if (mark.end <= start) continue;
    out.push({ questionId: mark.questionId, start, end: mark.end });
    cursor = mark.end;
  }
  return out;
}

function segmentRange(
  text: string,
  range: Range,
  marks: readonly SourceMark[],
  seen: Set<string>,
): SourceSegment[] {
  const segments: SourceSegment[] = [];
  let cursor = range.start;
  for (const mark of marks) {
    const start = Math.max(mark.start, range.start);
    const end = Math.min(mark.end, range.end);
    if (end <= start) continue;
    if (start > cursor) segments.push({ kind: "text", text: text.slice(cursor, start) });
    const first = !seen.has(mark.questionId);
    seen.add(mark.questionId);
    segments.push({ kind: "mark", text: text.slice(start, end), questionId: mark.questionId, first });
    cursor = end;
  }
  if (cursor < range.end) segments.push({ kind: "text", text: text.slice(cursor, range.end) });
  return segments;
}

/** Paragraphs of segments; `first` marks the segment that carries the anchor id. */
export function buildSourceParagraphs(
  text: string,
  marks: readonly SourceMark[],
): SourceParagraph[] {
  const normalized = normalizeMarks(marks, text.length);
  const seen = new Set<string>();
  return paragraphRanges(text).map((range) => ({
    start: range.start,
    end: range.end,
    segments: segmentRange(text, range, normalized, seen),
  }));
}

/** DOM id of the highlight for a question, shared by the pane and the jump button. */
export function sourceMarkId(questionId: string): string {
  return `ans-${questionId}`;
}
