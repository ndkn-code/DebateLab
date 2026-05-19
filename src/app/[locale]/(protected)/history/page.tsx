"use client";

import Image from "next/image";
import { useMemo, useState, type ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  Globe2,
  Mic,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Swords,
  UsersRound,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { storage, supabaseStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { cn } from "@/lib/utils";
import type { DebateSession, PracticeLanguage } from "@/types";

type SortOption = "newest" | "oldest" | "highest" | "lowest";
type FilterOption = "all" | "practice" | "duel";
type HistoryKind = "practice" | "duel";
type RecommendationTrack = "Speaking" | "Debate" | "Duel";

interface DuelHistoryItem {
  id: string;
  shareCode: string;
  topicTitle: string;
  role: "proposition" | "opposition" | null;
  winnerSide: "proposition" | "opposition" | null;
  summary: string;
  durationSeconds: number | null;
  createdAt: string;
  href: string;
}

interface HistoryData {
  sessions: DebateSession[];
  allowMockMetrics: boolean;
}

interface HistoryItem {
  id: string;
  kind: HistoryKind;
  title: string;
  tag: "Debate" | "Speaking" | "Duel";
  detail: string;
  date: string;
  durationSeconds: number | null;
  href: string;
  score: number | null;
  status: "Proficient" | "Competent" | null;
  note: "Excellent" | "Very Good" | "Good" | "Solid" | null;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  iconWrapClassName: string;
}

interface RecommendedPractice {
  tag: RecommendationTrack;
  title: string;
  body: string;
  duration: string;
  href: string;
}

const FILTERS: Array<{
  value: FilterOption;
  labelKey: string;
  icon: ComponentType<{ className?: string }> | null;
}> = [
  { value: "all", labelKey: "category_all", icon: null },
  { value: "practice", labelKey: "debate_practice", icon: Scale },
  { value: "duel", labelKey: "duel", icon: Swords },
];

const DEMO_METRICS_EMAIL = "ndkn.work@gmail.com";

async function fetchHistoryData(
  practiceLanguage: PracticeLanguage
): Promise<HistoryData> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const allowMockMetrics =
    authData.user?.email?.toLowerCase() === DEMO_METRICS_EMAIL;

  if (authData.user) {
    return {
      sessions: await supabaseStorage.getSessions(authData.user.id, {
        practiceLanguage,
      }),
      allowMockMetrics,
    };
  }

  return {
    sessions: storage
      .getSessions()
      .filter(
        (session) =>
          coercePracticeLanguage(session.practiceLanguage) === practiceLanguage
      ),
    allowMockMetrics: false,
  };
}

async function fetchDuelHistory(
  practiceLanguage: PracticeLanguage
): Promise<DuelHistoryItem[]> {
  const params = new URLSearchParams({ language: practiceLanguage });
  const response = await fetch(`/api/debate-duels/history?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as DuelHistoryItem[];
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(
  seconds: number | null,
  t: ReturnType<typeof useTranslations>
) {
  if (!seconds || seconds <= 0) {
    return t("not_recorded");
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return t("minutes_short", { count: minutes });
}

function getScoreMeta(score: number) {
  if (score >= 80) {
    return {
      stroke: "#00a66f",
      status: "Proficient" as const,
      note:
        score >= 90
          ? ("Excellent" as const)
          : ("Very Good" as const),
      badgeClassName: "bg-[#eaf8f4] text-[#00a66f]",
    };
  }

  return {
    stroke: "#1478ff",
    status: "Competent" as const,
    note: score >= 74 ? ("Good" as const) : ("Solid" as const),
    badgeClassName: "bg-[#edf5ff] text-[#1478ff]",
  };
}

function getSessionIcon(session: DebateSession) {
  const title = session.topic.title.toLowerCase();
  const category = session.topic.category.toLowerCase();

  if (session.practiceTrack === "speaking") {
    if (title.includes("agree") || category.includes("public")) {
      return {
        icon: UsersRound,
        iconClassName: "text-[#7b45f6]",
        iconWrapClassName: "bg-[#f2ecff]",
      };
    }

    return {
      icon: Mic,
      iconClassName: "text-[#1478ff]",
      iconWrapClassName: "bg-[#eaf2ff]",
    };
  }

  if (
    title.includes("climate") ||
    category.includes("environment") ||
    category.includes("sustainability")
  ) {
    return {
      icon: Globe2,
      iconClassName: "text-[#12b8a6]",
      iconWrapClassName: "bg-[#e7fbf8]",
    };
  }

  return {
    icon: Building2,
    iconClassName: "text-[#7b45f6]",
    iconWrapClassName: "bg-[#f1e9ff]",
  };
}

function getPracticeDetail(
  session: DebateSession,
  t: ReturnType<typeof useTranslations>
) {
  if (session.practiceTrack === "speaking") {
    return t("persuasive_speech");
  }

  if (session.mode === "full") {
    return t("one_v_one_debate");
  }

  const roundFocus =
    session.side === "opposition" ? t("rebuttal_focus") : t("constructive_focus");
  return `${session.topic.category || t("debate_practice")} • ${roundFocus}`;
}

function getNullableScore(rawScore: number | null | undefined) {
  return typeof rawScore === "number"
    ? Math.max(0, Math.min(100, rawScore))
    : null;
}

function hasScore(item: HistoryItem): item is HistoryItem & { score: number } {
  return item.score !== null;
}

function sessionToHistoryItem(
  session: DebateSession,
  allowMockMetrics: boolean,
  t: ReturnType<typeof useTranslations>
): HistoryItem {
  const realScore = getNullableScore(session.feedback?.totalScore);
  const score = realScore ?? (allowMockMetrics ? 76 : null);
  const scoreMeta = score === null ? null : getScoreMeta(score);
  const iconMeta = getSessionIcon(session);
  const realDuration =
    typeof session.duration === "number" && session.duration > 0
      ? session.duration
      : null;

  return {
    id: session.id,
    kind: "practice",
    title: session.topic.title,
    tag: session.practiceTrack === "speaking" ? "Speaking" : "Debate",
    detail: getPracticeDetail(session, t),
    date: session.date,
    durationSeconds:
      realDuration ?? (allowMockMetrics ? session.speechTime || 15 * 60 : null),
    href: `/history/${session.id}`,
    score,
    status: scoreMeta?.status ?? null,
    note: scoreMeta?.note ?? null,
    icon: iconMeta.icon,
    iconClassName: iconMeta.iconClassName,
    iconWrapClassName: iconMeta.iconWrapClassName,
  };
}

function duelToHistoryItem(
  duel: DuelHistoryItem,
  allowMockMetrics: boolean,
  t: ReturnType<typeof useTranslations>
): HistoryItem {
  const score = allowMockMetrics
    ? duel.winnerSide && duel.role
      ? duel.winnerSide === duel.role
        ? 88
        : 72
      : 82
    : null;
  const scoreMeta = score === null ? null : getScoreMeta(score);

  return {
    id: duel.id,
    kind: "duel",
    title: duel.topicTitle,
    tag: "Duel",
    detail: t("one_v_one_debate"),
    date: duel.createdAt,
    durationSeconds:
      duel.durationSeconds ?? (allowMockMetrics ? 21 * 60 : null),
    href: duel.href,
    score,
    status: scoreMeta?.status ?? null,
    note: scoreMeta?.note ?? null,
    icon: Swords,
    iconClassName: "text-[#ff9b00]",
    iconWrapClassName: "bg-[#fff4e2]",
  };
}

function getRecommendedPractice(
  items: HistoryItem[],
  t: ReturnType<typeof useTranslations>
): RecommendedPractice {
  if (items.length === 0) {
    return {
      tag: "Speaking",
      title: t("recommended_rebuttals_title"),
      body: t("recommended_rebuttals_body"),
      duration: t("minutes_short", { count: 15 }),
      href: "/practice?track=speaking",
    };
  }

  const recent = [...items]
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime()
    )
    .slice(0, 8);
  const speaking = recent.filter((item) => item.tag === "Speaking");
  const debate = recent.filter(
    (item) => item.tag === "Debate" || item.tag === "Duel"
  );
  const avg = (list: HistoryItem[]) => {
    const scoredItems = list.filter(hasScore);
    return scoredItems.length
      ? scoredItems.reduce((sum, item) => sum + item.score, 0) / scoredItems.length
      : null;
  };
  const weakest = [...recent]
    .filter(hasScore)
    .sort((left, right) => left.score - right.score)[0];
  const speakingAverage = avg(speaking);
  const debateAverage = avg(debate);

  if (weakest && weakest.score < 76 && weakest.tag === "Speaking") {
    return {
      tag: "Speaking",
      title: t("recommended_delivery_title"),
      body: t("recommended_delivery_body"),
      duration: t("minutes_short", { count: 12 }),
      href: "/practice?track=speaking",
    };
  }

  if (
    weakest &&
    weakest.score < 78 &&
    (weakest.detail.toLowerCase().includes("rebuttal") || weakest.tag === "Duel")
  ) {
    return {
      tag: "Speaking",
      title: t("recommended_rebuttals_title"),
      body: t("recommended_rebuttals_body"),
      duration: t("minutes_short", { count: 15 }),
      href: "/practice?track=speaking",
    };
  }

  if (
    debate.length > speaking.length + 1 ||
    (speakingAverage !== null &&
      debateAverage !== null &&
      speakingAverage < debateAverage - 4)
  ) {
    return {
      tag: "Speaking",
      title: t("recommended_rebuttals_title"),
      body: t("recommended_rebuttals_body"),
      duration: t("minutes_short", { count: 15 }),
      href: "/practice?track=speaking",
    };
  }

  if (
    weakest?.tag === "Duel" ||
    (debateAverage !== null &&
      speakingAverage !== null &&
      debateAverage < speakingAverage - 4)
  ) {
    return {
      tag: "Debate",
      title: t("recommended_case_title"),
      body: t("recommended_case_body"),
      duration: t("minutes_short", { count: 15 }),
      href: "/practice?track=debate",
    };
  }

  return {
    tag: "Debate",
    title: t("recommended_case_title"),
    body: t("recommended_case_body"),
    duration: t("minutes_short", { count: 15 }),
    href: "/practice?track=debate",
  };
}

function getTagLabel(tag: HistoryItem["tag"], t: ReturnType<typeof useTranslations>) {
  if (tag === "Speaking") return t("speaking");
  if (tag === "Duel") return t("duel");
  return t("debate");
}

function getStatusLabel(
  status: HistoryItem["status"],
  t: ReturnType<typeof useTranslations>
) {
  if (status === "Proficient") return t("status_proficient");
  if (status === "Competent") return t("status_competent");
  return t("unscored");
}

function getNoteLabel(
  note: HistoryItem["note"],
  t: ReturnType<typeof useTranslations>
) {
  if (note === "Excellent") return t("excellent");
  if (note === "Very Good") return t("very_good");
  if (note === "Good") return t("good");
  if (note === "Solid") return t("solid");
  return t("no_feedback_yet");
}

function ScoreRing({ score }: { score: number | null }) {
  const t = useTranslations("dashboard.history");
  const scoreMeta = score === null ? null : getScoreMeta(score);
  const size = 70;
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    score === null ? circumference : circumference * (1 - score / 100);

  return (
    <div className="flex w-[76px] shrink-0 flex-col items-center justify-center">
      <div className="relative flex h-[66px] w-[66px] items-center justify-center">
        <svg className="h-[66px] w-[66px] -rotate-90" viewBox="0 0 70 70">
          <circle
            cx="35"
            cy="35"
            r={radius}
            fill="none"
            stroke="#e4edf7"
            strokeWidth={strokeWidth}
          />
          {scoreMeta ? (
            <circle
              cx="35"
              cy="35"
              r={radius}
              fill="none"
              stroke={scoreMeta.stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
            />
          ) : null}
        </svg>
        <div className="absolute text-center">
          <div
            className={cn(
              "font-semibold leading-none tracking-normal text-on-surface",
              score === null ? "text-sm" : "text-lg"
            )}
          >
            {score ?? "N/A"}
          </div>
        </div>
      </div>
      <span className="mt-0.5 text-xs font-medium text-on-surface-variant">
        {t("score")}
      </span>
    </div>
  );
}

function SessionRow({
  item,
  index,
  onReview,
}: {
  item: HistoryItem;
  index: number;
  onReview: (href: string) => void;
}) {
  const t = useTranslations("dashboard.history");
  const locale = useLocale();
  const Icon = item.icon;
  const scoreMeta = item.score === null ? null : getScoreMeta(item.score);
  const StatusIcon = item.status === "Proficient" ? BadgeCheck : ShieldCheck;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      className="grid min-h-[112px] items-center gap-4 rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)] xl:grid-cols-[64px_minmax(0,1fr)_76px_124px_112px_112px]"
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-[1.25rem]",
          item.iconWrapClassName
        )}
      >
        <Icon className={cn("h-8 w-8 stroke-[2.25]", item.iconClassName)} />
      </div>

      <div className="min-w-0">
        <h2 className="line-clamp-2 text-base font-semibold leading-6 tracking-normal text-on-surface">
          {item.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold",
              item.tag === "Duel"
                ? "bg-[#fff4e2] text-[#ff9b00]"
                : item.tag === "Speaking"
                  ? "bg-[#e9f3ff] text-[#1478ff]"
                  : "bg-[#f1e9ff] text-[#8a34ff]"
            )}
          >
            {getTagLabel(item.tag, t)}
          </span>
          <span className="min-w-0 text-sm font-medium leading-5 text-on-surface-variant">
            {item.detail}
          </span>
        </div>
      </div>

      <ScoreRing score={item.score} />

      <div className="flex min-w-0 flex-col gap-2">
        <span
          className={cn(
            "inline-flex h-8 w-fit max-w-full items-center gap-1.5 truncate rounded-full px-2.5 text-xs font-semibold",
            scoreMeta?.badgeClassName ??
              "bg-surface-container text-on-surface-variant"
          )}
        >
          <StatusIcon className="h-4 w-4 shrink-0" />
          {getStatusLabel(item.status, t)}
        </span>
        <span className="pl-2 text-sm font-medium text-on-surface-variant">
          {getNoteLabel(item.note, t)}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-3 text-sm font-medium text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-primary" />
          {formatDuration(item.durationSeconds, t)}
        </span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          {formatDate(item.date, locale)}
        </span>
      </div>

      <Button
        type="button"
        onClick={() => onReview(item.href)}
        className="h-11 min-w-0 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-none hover:bg-primary-dim"
      >
        {t("review")}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </motion.article>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const t = useTranslations("dashboard.history");
  const locale = useLocale();
  const practiceLanguage = coercePracticeLanguage(locale);
  const { data: historyData, isLoading: sessionsLoading } = useSupabaseQuery(
    `history-sessions-${practiceLanguage}`,
    () => fetchHistoryData(practiceLanguage)
  );
  const { data: duelHistory = [], isLoading: duelsLoading } = useSupabaseQuery(
    `history-duels-${practiceLanguage}`,
    () => fetchDuelHistory(practiceLanguage)
  );
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [visibleCount, setVisibleCount] = useState(5);

  const historyItems = useMemo(() => {
    const sessions = historyData?.sessions ?? [];
    const allowMockMetrics = historyData?.allowMockMetrics ?? false;
    const practiceItems = sessions.map((session) =>
      sessionToHistoryItem(session, allowMockMetrics, t)
    );
    const duelItems = duelHistory.map((duel) =>
      duelToHistoryItem(duel, allowMockMetrics, t)
    );

    return [...practiceItems, ...duelItems];
  }, [historyData, duelHistory, t]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    let items = [...historyItems];

    if (activeFilter === "practice") {
      items = items.filter((item) => item.kind === "practice");
    } else if (activeFilter === "duel") {
      items = items.filter((item) => item.kind === "duel");
    }

    if (query) {
      items = items.filter((item) =>
        [
          item.title,
          getTagLabel(item.tag, t),
          item.detail,
          getStatusLabel(item.status, t),
          getNoteLabel(item.note, t),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    items.sort((left, right) => {
      const leftTime = new Date(left.date).getTime();
      const rightTime = new Date(right.date).getTime();
      const newestFirst = rightTime - leftTime;

      if (sort === "highest" || sort === "lowest") {
        if (left.score === null && right.score === null) return newestFirst;
        if (left.score === null) return 1;
        if (right.score === null) return -1;
        return sort === "highest"
          ? right.score - left.score
          : left.score - right.score;
      }

      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

    return items;
  }, [activeFilter, historyItems, search, sort, t]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const recommendedPractice = useMemo(
    () => getRecommendedPractice(historyItems, t),
    [historyItems, t]
  );
  const isLoading = sessionsLoading || duelsLoading;

  if (isLoading) {
    return <HistoryPageSkeleton />;
  }

  return (
    <PageTransition className="min-h-full bg-background text-on-surface">
      <ProductPageShell>
      <PageContainer size="standard" className="py-6">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center"
        >
          <div>
            <h1 className="text-[2rem] font-bold leading-tight text-on-surface md:text-[2.25rem]">
              {t("page_headline")}
            </h1>
            <p className="mt-3 text-sm font-medium leading-6 text-on-surface-variant sm:text-base">
              {t("page_subtitle")}
            </p>
            <p className="mt-2 text-xs font-semibold text-primary">
              {practiceLanguage === "vi"
                ? t("language_scope_vi")
                : t("language_scope_en")}
            </p>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="mb-5 mt-7"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative w-full lg:w-[320px]">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(5);
                }}
                placeholder={t("search_placeholder")}
                className="h-10 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest pl-10 pr-4 text-sm font-medium text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/75 focus:border-primary"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              {FILTERS.map((filter) => {
                const Icon = filter.icon;
                const active = activeFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setActiveFilter(filter.value);
                      setVisibleCount(5);
                    }}
                    className={cn(
                      "inline-flex h-10 min-w-[78px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-on-primary shadow-[0_12px_26px_-18px_rgba(77,134,247,0.9)]"
                        : "border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:border-primary-fixed"
                    )}
                  >
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 stroke-[2.25]",
                          active ? "text-on-primary" : "text-primary"
                        )}
                      />
                    ) : null}
                    <span>{t(filter.labelKey)}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:ml-auto lg:w-[220px]">
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortOption);
                  setVisibleCount(5);
                }}
                className="h-10 w-full appearance-none rounded-xl border border-outline-variant/60 bg-surface-container-lowest pl-10 pr-10 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary"
              >
                <option value="newest">{t("sort_newest")}</option>
                <option value="oldest">{t("sort_oldest")}</option>
                <option value="highest">{t("sort_highest")}</option>
                <option value="lowest">{t("sort_lowest")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0">
            {visibleItems.length === 0 ? (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest px-6 py-16 text-center shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-on-surface">
                  {t("empty")}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-on-surface-variant">
                  {t("empty_subtitle")}
                </p>
                <Link href="/practice" className="mt-7 inline-flex">
                  <Button className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-dim">
                    {t("start_practicing")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </motion.section>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleItems.map((item, index) => (
                  <SessionRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    index={index}
                    onReview={(href) => router.push(href)}
                  />
                ))}
              </div>
            )}

            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(filteredItems.length, count + 5)
                  )
                }
                disabled={visibleCount >= filteredItems.length}
                className="mt-5 flex h-14 w-full items-center justify-center gap-4 rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest text-sm font-semibold text-primary shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)] transition-colors hover:border-primary-fixed disabled:cursor-default disabled:opacity-75"
              >
                <ChevronDown className="h-5 w-5" />
                {t("load_more_sessions")}
              </button>
            )}
          </main>

          <aside>
            <section className="rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)] sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-tertiary-container">
                  <Star className="h-5 w-5 fill-[#895bff] text-[#895bff]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-6 text-on-surface">
                    {t("recommended_title")}
                  </h2>
                  <p className="mt-0.5 text-sm font-medium text-on-surface-variant">
                    {t("recommended_subtitle")}
                  </p>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[1.25rem] bg-surface-container px-5 py-5">
                <Image
                  src="/icons/target-goal-icon.svg"
                  alt=""
                  width={220}
                  height={170}
                  className="mx-auto h-auto max-h-[170px] w-full object-contain"
                  priority
                />
              </div>

              <span className="mt-5 inline-flex h-7 items-center rounded-lg bg-primary-container px-2.5 text-xs font-semibold text-primary">
                {getTagLabel(recommendedPractice.tag, t)}
              </span>

              <h3 className="mt-4 text-xl font-semibold leading-7 tracking-normal text-on-surface">
                {recommendedPractice.title}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
                {recommendedPractice.body}
              </p>

              <div className="mt-7 flex items-center gap-2 text-sm font-medium text-on-surface-variant">
                <Clock className="h-5 w-5 text-primary" />
                {recommendedPractice.duration}
              </div>

              <Link
                href={recommendedPractice.href}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-3 rounded-xl bg-primary text-sm font-semibold text-on-primary transition-colors hover:bg-primary-dim"
              >
                {t("start_practicing")}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </section>
          </aside>
        </div>
      </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}

function HistoryPageSkeleton() {
  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary-container" />
          <div>
            <div className="h-11 w-72 rounded-lg bg-outline-variant/60" />
            <div className="mt-3 h-5 w-full max-w-[320px] rounded bg-outline-variant/50" />
          </div>
        </div>

        <div className="mb-5 mt-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="h-10 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest lg:w-[320px]" />
            <div className="flex gap-2">
              <div className="h-10 w-[78px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest" />
              <div className="h-10 w-[98px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest" />
              <div className="h-10 w-[78px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest" />
            </div>
            <div className="h-10 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest lg:ml-auto lg:w-[220px]" />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <main className="flex flex-col gap-2.5">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="h-[112px] rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest"
              />
            ))}
            <div className="mt-2.5 h-14 rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest" />
          </main>
          <aside>
            <div className="h-[548px] rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest" />
          </aside>
        </div>
      </div>
    </div>
  );
}
