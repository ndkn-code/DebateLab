"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  Target,
  BarChart3,
  FolderOpen,
  Trash2,
  Search,
  ArrowUpDown,
  Mic2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniScoreRing } from "@/components/shared/mini-score-ring";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { storage, supabaseStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { cn } from "@/lib/utils";
import type { DebateSession } from "@/types";

type SortOption = "newest" | "oldest" | "highest" | "lowest";

const CATEGORY_FILTERS = [
  "All",
  "Education & School Life",
  "Technology & Social Media",
  "Society & Culture",
  "Environment & Sustainability",
  "Ethics & Philosophy",
  "Vietnam-Specific Issues",
] as const;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchSessions(): Promise<DebateSession[]> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    return supabaseStorage.getSessions(authData.user.id);
  }
  return storage.getSessions();
}

export default function HistoryPage() {
  const t = useTranslations("dashboard.history");
  const router = useRouter();
  const { data: sessions = [], mutate, isLoading } = useSupabaseQuery(
    "history-sessions",
    fetchSessions
  );
  const [sort, setSort] = useState<SortOption>("newest");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const CATEGORY_SHORT = useMemo<Record<string, string>>(
    () => ({
      "All": t("category_all"),
      "Education & School Life": t("category_education"),
      "Technology & Social Media": t("category_technology"),
      "Society & Culture": t("category_society"),
      "Environment & Sustainability": t("category_environment"),
      "Ethics & Philosophy": t("category_ethics"),
      "Vietnam-Specific Issues": t("category_vietnam"),
    }),
    [t]
  );

  const getTrackLabel = useCallback(
    (practiceTrack: DebateSession["practiceTrack"] | undefined) =>
      practiceTrack === "speaking" ? t("speaking") : t("debate"),
    [t]
  );

  const getModeLabel = useCallback(
    (session: DebateSession) => {
      const practiceTrack =
        session.practiceTrack ?? session.feedback?.practiceTrack ?? "debate";
      if (practiceTrack === "speaking") {
        return t("single_speech");
      }
      return session.mode === "full" ? t("full") : t("quick");
    },
    [t]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      await supabaseStorage.deleteSession(deleteId, authData.user.id);
    } else {
      storage.deleteSession(deleteId);
    }
    setDeleteId(null);
    mutate();
  }, [deleteId, mutate]);

  // Compute stats
  const stats = useMemo(() => {
    const scored = sessions.filter((s) => s.feedback);
    const scores = scored.map((s) => s.feedback!.totalScore);
    const avg =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const best = scores.length > 0 ? Math.max(...scores) : 0;

    // Most practiced category
    const catCount: Record<string, number> = {};
    sessions.forEach((s) => {
      catCount[s.topic.category] = (catCount[s.topic.category] || 0) + 1;
    });
    const topCat =
      Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "\u2014";

    return {
      total: sessions.length,
      avg,
      best,
      topCategory: CATEGORY_SHORT[topCat] ?? topCat,
    };
  }, [sessions, CATEGORY_SHORT]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = [...sessions];

    if (categoryFilter !== "All") {
      list = list.filter((s) => s.topic.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.topic.title.toLowerCase().includes(q));
    }

    switch (sort) {
      case "oldest":
        list.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        break;
      case "highest":
        list.sort(
          (a, b) =>
            (b.feedback?.totalScore ?? 0) - (a.feedback?.totalScore ?? 0)
        );
        break;
      case "lowest":
        list.sort(
          (a, b) =>
            (a.feedback?.totalScore ?? 0) - (b.feedback?.totalScore ?? 0)
        );
        break;
      default: // newest
        list.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }

    return list;
  }, [sessions, categoryFilter, search, sort]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-8 space-y-2">
            <div className="h-8 w-48 animate-pulse rounded bg-surface-container-high" />
            <div className="h-4 w-72 animate-pulse rounded bg-surface-container-high/60" />
          </div>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-outline-variant/10 bg-surface-container-low" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-outline-variant/10 bg-surface-container-low" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-on-surface">{t("page_headline")}</h1>
          <p className="mt-2 text-on-surface-variant">
            {t("page_subtitle")}
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="rounded-xl border border-outline-variant/10 bg-primary-container/30 p-4">
            <Target className="mb-2 h-5 w-5 text-primary" />
            <p className="text-2xl font-bold text-on-surface">{stats.total}</p>
            <p className="text-xs text-on-surface-variant">{t("total_sessions")}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-tertiary-container/30 p-4">
            <BarChart3 className="mb-2 h-5 w-5 text-tertiary" />
            <p className="text-2xl font-bold text-on-surface">{stats.avg}</p>
            <p className="text-xs text-on-surface-variant">{t("average_score")}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-secondary-container/30 p-4">
            <Trophy className="mb-2 h-5 w-5 text-secondary" />
            <p className="text-2xl font-bold text-on-surface">{stats.best}</p>
            <p className="text-xs text-on-surface-variant">{t("best_score")}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-[#fff9e5] p-4">
            <FolderOpen className="mb-2 h-5 w-5 text-[#b28b00]" />
            <p className="truncate text-lg font-bold text-on-surface">
              {stats.topCategory}
            </p>
            <p className="text-xs text-on-surface-variant">{t("most_practiced")}</p>
          </div>
        </motion.div>

        {/* Filter/Sort Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6 space-y-3"
        >
          {/* Search + Sort */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder={t("search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest py-2 pl-9 pr-4 text-sm text-on-surface placeholder-outline-variant outline-none transition-colors focus:border-primary/50"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full appearance-none rounded-lg border border-outline-variant/20 bg-surface-container-lowest py-2 pl-9 pr-8 text-sm text-on-surface outline-none transition-colors focus:border-primary/50 sm:w-44"
              >
                <option value="newest">{t("sort_newest")}</option>
                <option value="oldest">{t("sort_oldest")}</option>
                <option value="highest">{t("sort_highest")}</option>
                <option value="lowest">{t("sort_lowest")}</option>
              </select>
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors min-h-[44px] flex items-center",
                  categoryFilter === cat
                    ? "bg-primary/15 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                )}
              >
                {CATEGORY_SHORT[cat]}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Session List */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Mic2 className="mb-4 h-12 w-12 text-outline-variant" />
            <h3 className="text-lg font-semibold text-on-surface-variant">
              {sessions.length === 0
                ? t("empty")
                : t("no_match")}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {sessions.length === 0
                ? t("empty_subtitle")
                : t("no_match_subtitle")}
            </p>
            {sessions.length === 0 && (
              <Link href="/practice" className="mt-6">
                <Button className="gap-2 bg-primary text-white">
                  {t("start_practicing")}
                </Button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group relative"
              >
                <button
                  onClick={() => router.push(`/history/${session.id}`)}
                  className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 text-left transition-all hover:border-outline-variant/30 soft-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Score ring */}
                    <div className="shrink-0 pt-0.5">
                      {session.feedback ? (
                        <MiniScoreRing score={session.feedback.totalScore} />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-xs text-on-surface-variant">
                          N/A
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-on-surface">
                        {session.topic.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            session.side === "proposition"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          )}
                        >
                          {session.side === "proposition" ? t("for") : t("against")}
                        </span>
                        <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                          {getTrackLabel(
                            session.practiceTrack ?? session.feedback?.practiceTrack
                          )}
                        </span>
                        <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                          {getModeLabel(session)}
                        </span>
                        {session.feedback && (
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              session.feedback.totalScore >= 75
                                ? "bg-emerald-500/10 text-emerald-400"
                                : session.feedback.totalScore >= 40
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-red-500/10 text-red-400"
                            )}
                          >
                            {session.feedback.overallBand}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-on-surface-variant">
                        <span>{formatDate(session.date)}</span>
                        <span>{formatTime(session.date)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Delete button - hover reveal */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(session.id);
                  }}
                  aria-label={`Delete session: ${session.topic.title}`}
                  className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant opacity-100 transition-all hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteId !== null}
        title={t("delete_title")}
        description={t("delete_description")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
