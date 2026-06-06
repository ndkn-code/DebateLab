import {
  Activity,
  AlertTriangle,
  Gauge,
  Radar,
  ShieldCheck,
  Swords,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin - Duels" };

type QueueRow = {
  status: string;
};

type DuelRow = {
  id: string;
  share_code: string;
  topic_title: string;
  status: string;
  integrity_status: string;
  rating_processed_at: string | null;
  rating_excluded_reason: string | null;
  created_at: string;
};

type RatingEventRow = {
  id: string;
  duel_id: string;
  user_id: string;
  result: string;
  rating_delta: number;
  rating_after: number;
  integrity_status: string;
  judge_confidence: number | null;
  created_at: string;
};

type IntegrityEventRow = {
  id: string;
  action_type: string;
  severity: string;
  is_suspicious: boolean;
  suspicious_reason: string | null;
  created_at: string;
  user_id: string;
};

function formatDate(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatCard({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "primary" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-warning/10 text-warning"
      : tone === "success"
        ? "bg-success/10 text-success"
        : "bg-primary/10 text-primary";

  return (
    <div className="rounded-[24px] border border-outline-variant/15 bg-surface p-5 shadow-token-card">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
        {icon}
      </div>
      <div className="mt-4 text-3xl font-bold text-on-surface">{value}</div>
      <div className="mt-1 text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

export default async function AdminDuelsPage() {
  const supabase = await createClient();
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);
  const [
    queueRes,
    duelsRes,
    ratingEventsRes,
    integrityEventsRes,
    mmrProfilesRes,
  ] = await Promise.all([
    supabase
      .from("debate_duel_matchmaking_tickets")
      .select("status")
      .gte("created_at", last24Hours.toISOString()),
    supabase
      .from("debate_duels")
      .select(
        "id, share_code, topic_title, status, integrity_status, rating_processed_at, rating_excluded_reason, created_at"
      )
      .eq("duel_kind", "matchmaking")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("duel_rating_events")
      .select(
        "id, duel_id, user_id, result, rating_delta, rating_after, integrity_status, judge_confidence, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("debate_duel_integrity_events")
      .select(
        "id, action_type, severity, is_suspicious, suspicious_reason, created_at, user_id"
      )
      .eq("is_suspicious", true)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("duel_mmr_profiles").select("user_id", { count: "exact" }),
  ]);

  const queueRows = (queueRes.data ?? []) as QueueRow[];
  const queuedCount = queueRows.filter((row) => row.status === "queued").length;
  const matchedCount = queueRows.filter((row) => row.status === "matched").length;
  const recentDuels = (duelsRes.data ?? []) as DuelRow[];
  const ratingEvents = (ratingEventsRes.data ?? []) as RatingEventRow[];
  const integrityEvents = (integrityEventsRes.data ?? []) as IntegrityEventRow[];
  const hiddenProfiles = mmrProfilesRes.count ?? 0;

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Swords className="h-4 w-4" />
            Duel monitor
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
            Matchmaking and hidden MMR
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Internal-only view for queue health, rating movement, and fair-play signals.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Radar className="h-5 w-5" />}
            label="Queued in last 24h"
            value={queuedCount}
          />
          <StatCard
            icon={<Swords className="h-5 w-5" />}
            label="Matched in last 24h"
            value={matchedCount}
            tone="success"
          />
          <StatCard
            icon={<Gauge className="h-5 w-5" />}
            label="Hidden MMR profiles"
            value={hiddenProfiles}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Suspicious recent events"
            value={integrityEvents.length}
            tone="warning"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="rounded-[28px] border border-outline-variant/15 bg-surface p-5 shadow-token-card">
            <h2 className="text-xl font-bold text-on-surface">Recent matches</h2>
            <div className="mt-5 space-y-3">
              {recentDuels.length === 0 ? (
                <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  No matchmaking duels yet.
                </div>
              ) : (
                recentDuels.map((duel) => (
                  <div
                    key={duel.id}
                    className="rounded-[20px] border border-outline-variant/12 bg-surface-container-low px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">
                          {duel.topic_title}
                        </div>
                        <div className="mt-1 text-xs text-on-surface-variant">
                          {duel.share_code} - {formatDate(duel.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {duel.status}
                        </span>
                        <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                          {duel.integrity_status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-on-surface-variant">
                      Rating:{" "}
                      {duel.rating_processed_at
                        ? duel.rating_excluded_reason
                          ? `excluded (${duel.rating_excluded_reason})`
                          : "processed"
                        : "pending"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-outline-variant/15 bg-surface p-5 shadow-token-card">
            <h2 className="text-xl font-bold text-on-surface">Rating events</h2>
            <div className="mt-5 space-y-3">
              {ratingEvents.length === 0 ? (
                <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  No hidden rating changes yet.
                </div>
              ) : (
                ratingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[20px] border border-outline-variant/12 bg-surface-container-low px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-on-surface">
                        {event.result.toUpperCase()} {event.rating_delta > 0 ? "+" : ""}
                        {event.rating_delta}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-on-surface-variant">
                      Rating after {event.rating_after} - confidence{" "}
                      {event.judge_confidence ?? "n/a"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-outline-variant/15 bg-surface p-5 shadow-token-card">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            <h2 className="text-xl font-bold text-on-surface">
              Suspicious fair-play events
            </h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {integrityEvents.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                No suspicious integrity events.
              </div>
            ) : (
              integrityEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[20px] border border-outline-variant/12 bg-surface-container-low px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface">
                      <Activity className="h-4 w-4 text-warning" />
                      {event.action_type}
                    </span>
                    <span className="rounded-full bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                      {event.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    {event.suspicious_reason || "Suspicious event logged."}
                  </p>
                  <div className="mt-3 text-xs text-on-surface-variant">
                    {formatDate(event.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
