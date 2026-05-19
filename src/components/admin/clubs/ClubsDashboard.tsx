"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, ClipboardList, ExternalLink, Plus, Search, ShieldCheck, Users } from "@/components/ui/icons";
import { Link, useRouter } from "@/i18n/navigation";
import { PageTransition } from "@/components/shared/page-motion";
import { CreateClubDialog } from "@/components/admin/clubs/CreateClubDialog";
import { cn } from "@/lib/utils";
import type { AdminClubListRow, AdminClubsPageData, ClubQaState } from "@/lib/types/admin-clubs";

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

function Kpi({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
  tone: string;
}) {
  return (
    <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", tone)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#667795]">{label}</p>
          <p className="text-2xl font-bold leading-tight text-[#152238]">{value}</p>
          <p className="truncate text-xs text-[#667795]">{helper}</p>
        </div>
      </div>
    </section>
  );
}

function ClubCard({ club, qaState }: { club: AdminClubListRow; qaState: ClubQaState | null }) {
  const href = qaState
    ? `/dashboard/admin/clubs/${club.id}?qa=${qaState}`
    : `/dashboard/admin/clubs/${club.id}`;
  return (
    <Link
      href={href}
      className="grid gap-4 rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm transition hover:border-[#4D86F7]/40 hover:shadow-md lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_0.6fr_0.8fr_44px] lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#EAF2FF] text-[#4D86F7]">
          {club.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[#152238]">{club.name}</h2>
          <p className="truncate text-xs text-[#667795]">
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
      <Metric label="Completion" value={formatPercent(club.completionRate30d)} />
      <Metric label="Events" value={club.upcomingEventCount} />
      <Metric label="Review queue" value={club.reviewQueueCount} tone={club.reviewQueueCount > 12 ? "text-[#FF6B6B]" : "text-[#152238]"} />
      <div className="hidden justify-end lg:flex">
        <span className="rounded-full border border-[#DEE8F8] px-2.5 py-1 text-xs font-semibold text-[#4D86F7]">
          Open
        </span>
      </div>
    </Link>
  );
}

function SocialBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#DEE8F8] bg-[#F7FAFE] px-1.5 py-0.5 text-[10px] font-bold text-[#667795]">
      <ExternalLink className="h-3 w-3 text-[#4D86F7]" />
      {label}
    </span>
  );
}

function Metric({ label, value, tone = "text-[#152238]" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-[#7B8AA7]">{label}</p>
      <p className={cn("mt-1 text-sm font-bold", tone)}>{value}</p>
    </div>
  );
}

export function ClubsDashboard({ data }: { data: AdminClubsPageData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(() => searchParams.get("create") === "1");

  return (
    <PageTransition className="min-h-full bg-[#F7FAFE] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4D86F7]">Club OS</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#152238]">Clubs</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#667795]">
              Coach/admin workflow for cohorts, assignments, attendance, reviews, and normalized performance data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4D86F7] px-4 text-sm font-bold text-white shadow-sm shadow-[#4D86F7]/20 transition hover:bg-[#3E78EC]"
            >
              <Plus className="h-4 w-4" />
              Create club
            </button>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm font-semibold text-[#40516F]">
              <ShieldCheck className="h-4 w-4 text-[#34C759]" />
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
                    ? "border-[#4D86F7] bg-[#EAF2FF] text-[#1E63E9]"
                    : "border-[#DEE8F8] bg-white text-[#667795] hover:border-[#4D86F7]/50"
                )}
              >
                {state.label}
              </Link>
            ))}
          </div>
        )}

        {data.loadError && (
          <div className="mt-4 rounded-lg border border-[#FF6B6B]/30 bg-[#FFF1F1] px-4 py-3 text-sm text-[#C43D3D]">
            {data.loadError}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi icon={<Building2 className="h-5 w-5" />} label="Total clubs" value={data.kpis.totalClubs} helper={`${data.kpis.activeClubs} active`} tone="bg-[#EAF2FF] text-[#4D86F7]" />
          <Kpi icon={<Users className="h-5 w-5" />} label="Students" value={data.kpis.totalStudents} helper="Across all clubs" tone="bg-[#EAFBF0] text-[#34C759]" />
          <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Completion" value={formatPercent(data.kpis.averageCompletionRate30d)} helper="Average 30d rate" tone="bg-[#FFF7E6] text-[#F5B942]" />
          <Kpi icon={<ClipboardList className="h-5 w-5" />} label="Review queue" value={data.kpis.reviewQueueCount} helper="Open coach reviews" tone="bg-[#FFF1F1] text-[#FF6B6B]" />
          <Kpi icon={<ShieldCheck className="h-5 w-5" />} label="Data contract" value="V1" helper="Practice to performance" tone="bg-[#F1F6FD] text-[#40516F]" />
        </div>

        <div className="mt-6 rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8AA7]" />
            <input
              placeholder="Search clubs"
              className="h-11 w-full rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] pl-10 pr-3 text-sm outline-none transition focus:border-[#4D86F7] focus:ring-2 focus:ring-[#4D86F7]/15"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          {data.clubs.length ? (
            data.clubs.map((club) => <ClubCard key={club.id} club={club} qaState={data.qaState} />)
          ) : (
            <div className="rounded-lg border border-dashed border-[#C8D7EF] bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#4D86F7]">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="mt-4 text-base font-bold text-[#152238]">No clubs yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#667795]">
                Create a Vietnam club workspace with a logo, social profile, admins, members, and schedule-ready operations.
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#4D86F7] px-4 text-sm font-bold text-white shadow-sm shadow-[#4D86F7]/20"
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
