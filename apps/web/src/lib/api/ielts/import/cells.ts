/**
 * Variant-tolerant cell helpers for the bulk importer (WS-1.1). Fuzzy header
 * lookup + loose coercions (task/part → question type, speaker strings, visuals)
 * so small spreadsheet formatting differences don't break import. Pure.
 */
import { normalizeWhitespace, parseLeadingInt } from "../normalize";
import type { IeltsQuestionType } from "../question-schema";
import type { IeltsVisual } from "../visual";
import { IELTS_ACCENTS } from "../schema";

export type Row = Record<string, string>;
export type HeaderIndex = Array<[string, string]>;
export type Accent = (typeof IELTS_ACCENTS)[number];

export function indexRow(row: Row): HeaderIndex {
  return Object.entries(row).map(
    ([header, value]) =>
      [header.toLowerCase().replace(/\s+/g, " ").trim(), value ?? ""] as [string, string],
  );
}

/** First cell whose normalized header satisfies the predicate (trimmed). */
export function pick(index: HeaderIndex, predicate: (header: string) => boolean): string {
  for (const [header, value] of index) {
    if (predicate(header)) return value.trim();
  }
  return "";
}

/** Header matches when it contains all given substrings. */
export const has =
  (...subs: string[]) =>
  (header: string): boolean =>
    subs.every((sub) => header.includes(sub));

export function isExampleRow(idValue: string): boolean {
  return /example/i.test(idValue);
}

export function mapTaskToType(value: string): IeltsQuestionType | null {
  const v = value.toLowerCase();
  if (v.includes("task 2")) return "writing_task2_essay";
  if (v.includes("task 1") && v.includes("general")) return "writing_task1_general";
  if (v.includes("task 1")) return "writing_task1_academic";
  return null;
}

export function mapPartToType(value: string): IeltsQuestionType | null {
  const n = parseLeadingInt(value);
  if (n === 1) return "speaking_part1";
  if (n === 2) return "speaking_part2_cuecard";
  if (n === 3) return "speaking_part3";
  return null;
}

function coerceAccent(token: string | undefined): Accent {
  const t = (token ?? "").toLowerCase();
  if (t === "uk" || t === "us" || t === "aus") return t;
  return "other";
}

/** Parse "F-UK (caller), M-AUS (staff)" → speaker rows for a listening section. */
export function parseSpeakers(value: string): Array<{ name: string; accent: Accent }> {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((part) => {
      const accent = coerceAccent(part.match(/-\s*(uk|us|aus)/i)?.[1]);
      const role = part.match(/\(([^)]+)\)/)?.[1];
      const name = role
        ? normalizeWhitespace(role)
        : normalizeWhitespace(part.replace(/\([^)]*\)/g, "")) || "Speaker";
      return { name, accent };
    })
    .filter((speaker) => speaker.name.length > 0);
}

/** A free-text Task-1 "Visual/Data" cell becomes a `described` visual. */
export function describedVisual(value: string): IeltsVisual | null {
  const v = value.trim();
  return v.length > 0 ? { type: "described", description: v } : null;
}
