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

function rawLabel(row: BandBreakdownRow): string {
  return row.rawMin === row.rawMax ? `${row.rawMin}` : `${row.rawMin}–${row.rawMax}`;
}

function BreakdownTable({ breakdown }: { breakdown: SkillBandBreakdown }) {
  return (
    <details className="rounded-2xl border border-outline-variant bg-surface-container">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
        <span className="type-title text-on-surface">{breakdown.label} band scale</span>
        <span className="type-body-sm text-on-surface-variant tabular-nums">
          {breakdown.raw}/{breakdown.rawMax} → band {bandText(breakdown.band)}
        </span>
      </summary>
      <div className="px-3 pb-3">
        <table className="w-full border-collapse type-body-sm">
          <thead>
            <tr className="text-on-surface-variant">
              <th className="px-2 py-1 text-left font-medium">Band</th>
              <th className="px-2 py-1 text-right font-medium">Raw score (/{breakdown.rawMax})</th>
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
                <td className="px-2 py-1 tabular-nums">{bandText(row.band)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{rawLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 type-caption text-on-surface-variant">
          Conversion table: {breakdown.conversionKey}
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
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-heading-md text-on-surface">How your score converts</h2>
      {breakdowns.map((breakdown) => (
        <BreakdownTable key={breakdown.skill} breakdown={breakdown} />
      ))}
    </section>
  );
}
