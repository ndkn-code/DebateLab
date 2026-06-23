"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "@/components/ui/icons";
import { Link, useRouter } from "@/i18n/navigation";
import { PageTransition } from "@/components/shared/page-motion";
import { CreateClubDialog } from "@/components/admin/clubs/CreateClubDialog";
import { ChartCard, ChartEmpty, StatCard } from "@/components/data-viz";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "@/components/charts";
import { cn } from "@/lib/utils";
import type {
  AdminClubListRow,
  AdminClubsPageData,
  ClubQaState,
} from "@/lib/types/admin-clubs";

const QA_STATES: Array<{ key: ClubQaState; label: string }> = [
  { key: "empty", label: "Empty" },
  { key: "active", label: "Active" },
  { key: "high", label: "High" },
  { key: "low", label: "Low completion" },
  { key: "mixed", label: "Mixed" },
];

function formatPercent(value: number | null) {
  return value == null ? "-" : `${value}%`;
}

function ClubCard({
  club,
  qaState,
}: {
  club: AdminClubListRow;
  qaState: ClubQaState | null;
}) {
  const href = qaState
    ? `/dashboard/admin/clubs/${club.id}?qa=${qaState}`
    : `/dashboard/admin/clubs/${club.id}`;
  return (
    <Link
      href={href}
      className="grid gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_0.6fr_0.8fr_44px] lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container text-primary">
          {club.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.logoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-on-surface">
            {club.name}
          </h2>
          <p className="truncate text-xs text-on-surface-variant">
            {club.code} · {club.city ?? "Vietnam"} · {club.timezone}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {club.facebookUrl && <SocialBadge label="Facebook" />}
            {club.instagramUrl && <SocialBadge label="Instagram" />}
            {club.threadsUrl && <SocialBadge label="Threads" />}
          </div>
        </div>
      </div>
      <Metric label="Cohorts" value={club.classCount} />
      <Metric label="Students" value={club.studentCount} />
      <Metric
        label="Completion"
        value={formatPercent(club.completionRate30d)}
      />
      <Metric label="Events" value={club.upcomingEventCount} />
      <Metric
        label="Review queue"
        value={club.reviewQueueCount}
        tone={
          club.reviewQueueCount > 12
            ? "text-on-surface-variant"
            : "text-on-surface"
        }
      />
      <div className="hidden justify-end lg:flex">
        <span className="rounded-full border border-outline-variant px-2.5 py-1 text-xs font-semibold text-primary">
          Open
        </span>
      </div>
    </Link>
  );
}

function SocialBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-background px-1.5 py-0.5 type-caption font-bold text-on-surface-variant">
      <ExternalLink className="h-3 w-3 text-primary" />
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  tone = "text-on-surface",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div>
      <p className="type-caption font-semibold uppercase text-on-surface-variant">
        {label}
      </p>
      <p className={cn("mt-1 text-sm font-bold", tone)}>{value}</p>
    </div>
  );
}

export function ClubsDashboard({ data }: { data: AdminClubsPageData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(
    () => searchParams.get("create") === "1",
  );
  const clubChartData = useMemo(
    () =>
      data.clubs.slice(0, 8).map((club) => ({
        club: club.name,
        attendance: club.attendanceRate30d ?? 0,
        completion: club.completionRate30d ?? 0,
      })),
    [data.clubs],
  );

  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="type-eyebrow text-primary">Club OS</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">
              Clubs
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              Coach/admin workflow for cohorts, assignments, attendance,
              reviews, and normalized performance data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary shadow-sm shadow-token-card/20 transition hover:bg-primary-dim"
            >
              <Plus className="h-4 w-4" />
              Create club
            </button>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface-variant">
              <ShieldCheck className="h-4 w-4 text-success" />
              {data.qaEnabled ? "QA/QC pipeline active" : "Data contract V1"}
            </div>
          </div>
        </div>

        {data.qaEnabled && (
          <div className="mt-5 flex flex-wrap gap-2">
            {QA_STATES.map((state) => (
              <Link
                key={state.key}
                href={`/dashboard/admin/clubs?qa=${state.key}`}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-bold transition",
                  data.qaState === state.key
                    ? "border-primary bg-surface-container text-on-surface-variant"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/50",
                )}
              >
                {state.label}
              </Link>
            ))}
          </div>
        )}

        {data.loadError && (
          <div className="mt-4 rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            {data.loadError}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<Building2 className="h-5 w-5" />}
            label="Total clubs"
            value={data.kpis.totalClubs}
            delta={data.kpis.activeClubs}
            deltaSuffix=" active"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Students"
            value={data.kpis.totalStudents}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Completion"
            value={data.kpis.averageCompletionRate30d ?? 0}
            format={() => formatPercent(data.kpis.averageCompletionRate30d)}
            spark={clubChartData.map((club) => club.completion)}
            sparkTone={4}
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Review queue"
            value={data.kpis.reviewQueueCount}
            invertDelta
          />
          <StatCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Data contract"
            value={1}
            format={() => "V1"}
          />
        </div>

        <ChartCard
          className="mt-6"
          title="Club attendance and completion"
          eyebrow="B2B progress"
          subtitle="30-day attendance and assignment completion across the first eight clubs."
        >
          {clubChartData.length ? (
            <div className="h-72">
              <BarChart
                data={clubChartData}
                xDataKey="club"
                margin={{ left: 28, right: 24, bottom: 72 }}
              >
                <Grid horizontal />
                <Bar
                  dataKey="attendance"
                  fill="var(--chart-line-primary)"
                  lineCap="round"
                />
                <Bar
                  dataKey="completion"
                  fill="var(--chart-line-secondary)"
                  lineCap="round"
                />
                <BarXAxis />
                <ChartTooltip />
              </BarChart>
            </div>
          ) : (
            <ChartEmpty
              title="No club metrics yet"
              description="Attendance and completion appear when clubs have activity."
            />
          )}
        </ChartCard>

        <div className="mt-6 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              placeholder="Search clubs"
              className="h-11 w-full rounded-lg border border-outline-variant bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          {data.clubs.length ? (
            data.clubs.map((club) => (
              <ClubCard key={club.id} club={club} qaState={data.qaState} />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="mt-4 text-base font-bold text-on-surface">
                No clubs yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
                Create a Vietnam club workspace with a logo, social profile,
                admins, members, and schedule-ready operations.
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary shadow-sm shadow-token-card/20"
              >
                <Plus className="h-4 w-4" />
                Create club
              </button>
            </div>
          )}
        </div>
      </div>
      <CreateClubDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(clubId) => {
          setCreateOpen(false);
          router.push(`/dashboard/admin/clubs/${clubId}`);
          router.refresh();
        }}
      />
    </PageTransition>
  );
}
