"use client";

import {
  Activity,
  Gauge,
  Info,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type {
  PredictionErrorRow,
  PredictionQualityView,
} from "@/lib/ielts/prediction-quality/types";
import { CalibrationPlot } from "./CalibrationPlot";
import { DriftChart } from "./DriftChart";

function formatBand(value: number | null) {
  return value == null ? "—" : value.toFixed(2);
}

function formatSigned(value: number | null) {
  return value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatPercent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function formatScale(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)}×`;
}

export function PredictionQualityDashboard({
  view,
  unavailable,
}: {
  view: PredictionQualityView;
  unavailable: boolean;
}) {
  const { kpis, meta } = view;

  return (
    <div className="min-h-full bg-background px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 type-eyebrow text-primary">
              <Gauge className="h-3.5 w-3.5" />
              Prediction Quality
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-normal text-on-surface">
              Band-prediction validation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              The served{" "}
              <code className="rounded bg-surface-container px-1.5 py-0.5 text-xs">
                {kpis.model}
              </code>{" "}
              model, backtested with a no-leakage replay over every learner with at least{" "}
              {meta.minMocks} mocks: at each mock we score the forecast made from evidence dated
              strictly before it against the actual bands.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge label="Learners" value={String(kpis.learnerCount)} />
            <Badge label="Considered" value={String(meta.scenariosConsidered)} />
            <Badge label="Claimed CI" value={formatPercent(kpis.claimedLevel)} />
            {meta.modules.length > 0 && (
              <Badge label="Modules" value={meta.modules.join(", ")} />
            )}
          </div>
        </header>

        {!view.hasData ? (
          <EmptyState unavailable={unavailable} view={view} />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
              <Kpi label="Learners" value={String(kpis.learnerCount)} icon={Users} />
              <Kpi label="Boundaries" value={String(kpis.boundaryCount)} icon={Activity} />
              <Kpi label="Overall MAE" value={formatBand(kpis.mae)} icon={Target} />
              <Kpi label="Bias" value={formatSigned(kpis.bias)} icon={TrendingUp} />
              <Kpi label="Within ½ band" value={formatPercent(kpis.withinHalfBand)} icon={Gauge} />
              <Kpi
                label={`Coverage @${formatPercent(kpis.claimedLevel)}`}
                value={formatPercent(kpis.servedCoverage)}
                icon={SlidersHorizontal}
              />
              <Kpi
                label="Calibration err"
                value={formatPercent(kpis.calibrationError)}
                icon={Info}
              />
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Calibration"
                subtitle="Empirical coverage of each served interval vs the claimed level. Below the line ⇒ overconfident."
              >
                <CalibrationPlot points={view.calibration} />
              </ChartCard>
              <ChartCard
                title="Drift over time"
                subtitle="Overall MAE by month of mock. Rising ⇒ the model is degrading against reality."
              >
                <DriftChart points={view.drift} />
              </ChartCard>
            </div>

            <ErrorTable rows={view.errorRows} />

            <p className="flex items-start gap-2 text-xs text-on-surface-variant">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              On-track Brier {formatBand(kpis.onTrackBrier)} (skill score{" "}
              {formatSigned(kpis.onTrackSkillScore)} vs base rate) ·{" "}
              {kpis.skippedDiagnostic} boundaries skipped as diagnostic (model declined to predict).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorTable({ rows }: { rows: PredictionErrorRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface">
      <div className="flex flex-col gap-1 border-b border-outline-variant/10 bg-surface-container-low px-4 py-3">
        <h2 className="font-semibold text-on-surface">Per-skill error &amp; calibration</h2>
        <p className="text-xs text-on-surface-variant">
          Pooled across all scored boundaries. Recommended scale is the conformal multiplier on the
          interval half-width that would restore the claimed coverage.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-outline-variant/10">
          <thead className="bg-surface-container-low">
            <tr className="text-left type-eyebrow text-on-surface-variant">
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Boundaries</th>
              <th className="px-4 py-3">MAE</th>
              <th className="px-4 py-3">Bias</th>
              <th className="px-4 py-3">RMSE</th>
              <th className="px-4 py-3">Within ½</th>
              <th className="px-4 py-3">Coverage</th>
              <th className="px-4 py-3">Rec. scale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10 text-sm">
            {rows.map((row) => (
              <tr key={row.target} className={cn(row.target === "overall" && "bg-surface-container-low/40")}>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "text-on-surface",
                      row.target === "overall" ? "font-bold" : "font-medium",
                    )}
                  >
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{row.count}</td>
                <td className="px-4 py-3 font-semibold text-on-surface">{formatBand(row.mae)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatSigned(row.bias)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatBand(row.rmse)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatPercent(row.withinHalfBand)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatPercent(row.servedCoverage)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatScale(row.recommendedScale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState({
  unavailable,
  view,
}: {
  unavailable: boolean;
  view: PredictionQualityView;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface p-10 text-center">
      <Gauge className="mx-auto h-8 w-8 text-on-surface-variant" />
      <h2 className="mt-4 text-lg font-semibold text-on-surface">
        {unavailable ? "Service-role client not configured" : "No qualifying learners yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
        {unavailable ? (
          <>
            Set <code className="rounded bg-surface-container px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            to aggregate band-prediction accuracy across learners.
          </>
        ) : (
          <>
            Metrics populate once learners complete at least {view.meta.minMocks} mocks. Examined{" "}
            {view.meta.scenariosConsidered}{" "}
            {view.meta.scenariosConsidered === 1 ? "history" : "histories"} so far. Pre-launch the
            harness is validated on synthetic fixtures (
            <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
              prediction-quality/aggregate.test.ts
            </code>
            ); real-cohort metrics appear here as mocks accumulate.
          </>
        )}
      </p>
    </section>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="type-eyebrow text-on-surface-variant">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-2xl font-bold text-on-surface">{value}</div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface px-3 py-1.5">
      <span className="type-eyebrow text-on-surface-variant">{label}</span>
      <span className="ml-2 text-sm font-semibold text-on-surface">{value}</span>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface p-5">
      <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      <p className="mb-3 mt-1 text-xs text-on-surface-variant">{subtitle}</p>
      {children}
    </section>
  );
}
