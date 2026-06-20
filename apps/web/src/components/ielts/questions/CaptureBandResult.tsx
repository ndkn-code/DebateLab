"use client";

/**
 * Shared presentation for the in-mock Writing/Speaking scoring states (WS-5.2):
 * a band + per-criterion breakdown card, a "scoring in progress" note, and an
 * error note. Mirrors the WS-2.2 results panels (type-* + semantic tokens) so the
 * inline preview matches the full results page.
 */
import type { ReactNode } from "react";
import { formatBand } from "@/lib/ielts/capture/capture-format";

export interface CaptureBandRow {
  key: string;
  label: string;
  band: number | null;
}

export function CaptureBandResult({
  headlineLabel,
  headlineBand,
  rows,
  summary,
  children,
}: {
  headlineLabel: string;
  headlineBand: number | null;
  rows: CaptureBandRow[];
  summary: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
          {headlineLabel}
        </span>
        <span className="type-heading-md font-bold tabular-nums text-on-surface">
          {formatBand(headlineBand)}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2"
          >
            <span className="type-body-sm text-on-surface">{row.label}</span>
            <span className="type-body-sm font-bold tabular-nums text-on-surface">
              {formatBand(row.band)}
            </span>
          </li>
        ))}
      </ul>
      {summary ? (
        <p className="type-body-sm text-on-surface-variant">{summary}</p>
      ) : null}
      {children}
    </div>
  );
}

export function CaptureScoringNote({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-warning-container px-4 py-3 text-on-warning-container"
      role="status"
      aria-live="polite"
    >
      <span
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      <span className="flex flex-col">
        <span className="type-body-sm font-medium">{title}</span>
        {hint ? <span className="type-caption opacity-80">{hint}</span> : null}
      </span>
    </div>
  );
}

export function CaptureErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-2xl bg-error-container px-4 py-3 type-body-sm text-error">
      {message}
    </p>
  );
}

export function CaptureDetails({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
      <summary className="cursor-pointer type-body-sm font-medium text-on-surface">
        {summary}
      </summary>
      <div className="mt-2 whitespace-pre-wrap type-body-sm text-on-surface-variant">
        {children}
      </div>
    </details>
  );
}
