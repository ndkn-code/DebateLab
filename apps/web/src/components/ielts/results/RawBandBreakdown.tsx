"use client";

/**
 * Raw-score → band breakdown (WS-2.2). Per objective skill, a collapsible table
 * of the conversion that applied, with the learner's band row highlighted — so
 * the band is transparent, never a black box. Server component.
 */
import type {
  BandBreakdownRow,
  SkillBandBreakdown,
} from "@/lib/ielts/results/types";
import { bandText } from "./format";
import { useLocale } from "next-intl";

const COPY = {
  en: {
    scale: "band scale",
    band: "Band",
    raw: "Raw score",
    learner: "Your band",
    conversion: "Conversion table",
    title: "How your score converts",
    listening: "Listening",
    reading: "Reading",
  },
  vi: {
    scale: "thang band",
    band: "Band",
    raw: "Điểm thô",
    learner: "Band của bạn",
    conversion: "Bảng quy đổi",
    title: "Cách quy đổi điểm",
    listening: "Nghe",
    reading: "Đọc",
  },
} as const;

function rawLabel(row: BandBreakdownRow): string {
  return row.rawMin === row.rawMax
    ? `${row.rawMin}`
    : `${row.rawMin}–${row.rawMax}`;
}

function BreakdownTable({ breakdown }: { breakdown: SkillBandBreakdown }) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  return (
    <details className="rounded-xl border border-outline-variant bg-surface-container">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="type-title text-on-surface">
          {copy[breakdown.skill]} {copy.scale}
        </span>
        <span className="type-body-sm text-on-surface-variant tabular-nums">
          {breakdown.raw}/{breakdown.rawMax} → {copy.band}{" "}
          {bandText(breakdown.band)}
        </span>
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-80 border-collapse type-body-sm">
          <thead>
            <tr className="text-on-surface-variant">
              <th className="px-2 py-1 text-left font-medium">{copy.band}</th>
              <th className="px-2 py-1 text-right font-medium">
                {copy.raw} (/{breakdown.rawMax})
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((row) => (
              <tr
                key={row.band}
                className={
                  row.isLearnerRow
                    ? "bg-primary-container font-semibold text-on-primary-container"
                    : "text-on-surface"
                }
              >
                <td className="px-2 py-1 tabular-nums">
                  {bandText(row.band)}
                  {row.isLearnerRow ? (
                    <span className="ml-2 type-caption font-semibold">
                      ({copy.learner})
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {rawLabel(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 type-caption text-on-surface-variant">
          {copy.conversion}: {breakdown.conversionKey}
        </p>
      </div>
    </details>
  );
}

export function RawBandBreakdown({
  breakdowns,
}: {
  breakdowns: SkillBandBreakdown[];
}) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-heading-md text-on-surface">{copy.title}</h2>
      {breakdowns.map((breakdown) => (
        <BreakdownTable key={breakdown.skill} breakdown={breakdown} />
      ))}
    </section>
  );
}
