"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Filter,
  GraduationCap,
  History,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type {
  ProfileActivityFeedData,
  ProfileActivityFeedItem,
  ProfileActivityKind,
} from "@/lib/profile-social/tab-model";

type ActivityFilter = "all" | "practice" | "duel" | "learning";
type ActivitySort = "newest" | "oldest" | "highest";

const ACTIVITY_FILTERS: Array<{ value: ActivityFilter; labelKey: string }> = [
  { value: "all", labelKey: "filters.all" },
  { value: "practice", labelKey: "filters.practice" },
  { value: "duel", labelKey: "filters.duel" },
  { value: "learning", labelKey: "filters.learning" },
];

function activityMatchesFilter(item: ProfileActivityFeedItem, filter: ActivityFilter) {
  if (filter === "all") return true;
  if (filter === "learning") return item.kind === "lesson" || item.kind === "course";
  return item.kind === filter;
}

function getActivityMeta(kind: ProfileActivityKind): {
  icon: ComponentType<{ className?: string }>;
  badgeClassName: string;
  iconClassName: string;
  labelKey: string;
} {
  switch (kind) {
    case "practice":
      return {
        icon: History,
        badgeClassName: "bg-[#F1F6FD] text-[#3E78EC]",
        iconClassName: "text-[#3E78EC]",
        labelKey: "kinds.practice",
      };
    case "duel":
      return {
        icon: Swords,
        badgeClassName: "bg-[#FFF8E6] text-[#A66A00]",
        iconClassName: "text-[#A66A00]",
        labelKey: "kinds.duel",
      };
    case "lesson":
      return {
        icon: BookOpen,
        badgeClassName: "bg-[#EAF9EF] text-[#238B45]",
        iconClassName: "text-[#34C759]",
        labelKey: "kinds.lesson",
      };
    case "course":
      return {
        icon: GraduationCap,
        badgeClassName: "bg-[#F1F6FD] text-[#3E78EC]",
        iconClassName: "text-[#4D86F7]",
        labelKey: "kinds.course",
      };
    case "level":
      return {
        icon: Sparkles,
        badgeClassName: "bg-[#F1F6FD] text-[#7B61FF]",
        iconClassName: "text-[#7B61FF]",
        labelKey: "kinds.level",
      };
    default:
      return {
        icon: Sparkles,
        badgeClassName: "bg-[#EEF2F7] text-[#415069]",
        iconClassName: "text-[#718096]",
        labelKey: "kinds.activity",
      };
  }
}

function formatActivityDate(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function EmptyState({
  privateState,
}: {
  privateState?: boolean;
}) {
  const t = useTranslations("profileSocial.activities");

  return (
    <section className="rounded-xl border border-dashed border-[#D9E5F4] bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2F7] text-[#718096]">
        {privateState ? (
          <ShieldCheck className="h-6 w-6" />
        ) : (
          <Clock3 className="h-6 w-6" />
        )}
      </div>
      <h2 className="mt-5 text-xl font-semibold text-[#0B1424]">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718096]">
        {privateState ? t("private_body") : t("empty_body")}
      </p>
    </section>
  );
}

function ActivityCard({ item }: { item: ProfileActivityFeedItem }) {
  const t = useTranslations("profileSocial.activities");
  const locale = useLocale();
  const meta = getActivityMeta(item.kind);
  const Icon = meta.icon;

  return (
    <article className="grid gap-4 rounded-xl border border-[#DEE8F8] bg-white p-4 shadow-[0_18px_44px_-42px_rgba(62,120,236,0.22)] sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F7FAFE]">
        <Icon className={cn("h-6 w-6", meta.iconClassName)} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
              meta.badgeClassName
            )}
          >
            {t(meta.labelKey)}
          </span>
          {item.xpEarned > 0 ? (
            <span className="text-xs font-semibold text-[#718096]">
              +{item.xpEarned} XP
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-[#0B1424]">
          {item.title}
        </h3>
        {item.subtitle ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#718096]">
            {item.subtitle}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-[#718096]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-[#8A96A8]" />
            {formatActivityDate(item.createdAt, locale)}
          </span>
          {item.durationMinutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-[#8A96A8]" />
              {t("minutes", { count: item.durationMinutes })}
            </span>
          ) : null}
          {item.score != null ? (
            <span className="font-semibold text-[#0B1424]">
              {t("score", { score: item.score })}
            </span>
          ) : null}
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#4D86F7] px-4 text-sm font-semibold text-white transition hover:bg-[#3E78EC]"
        >
          {t("review")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </article>
  );
}

export function ProfileActivitiesTab({
  data,
}: {
  data: ProfileActivityFeedData | null | undefined;
}) {
  const t = useTranslations("profileSocial.activities");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [sort, setSort] = useState<ActivitySort>("newest");

  const isPrivate =
    !data || data.state === "private" || data.state === "blocked" || data.state === "not_found";
  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    const nextItems = items
      .filter((item) => activityMatchesFilter(item, filter))
      .filter((item) => {
        if (!normalizedQuery) return true;
        return [item.title, item.subtitle, item.kind]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });

    nextItems.sort((left, right) => {
      if (sort === "highest") {
        if (left.score == null && right.score == null) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }
        if (left.score == null) return 1;
        if (right.score == null) return -1;
        return right.score - left.score;
      }

      const newest = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return sort === "oldest" ? -newest : newest;
    });

    return nextItems;
  }, [data?.items, filter, query, sort]);

  if (isPrivate) {
    return <EmptyState privateState />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative w-full lg:w-[320px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A96A8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search_placeholder")}
            className="h-10 w-full rounded-lg border border-[#DEE8F8] bg-white pl-9 pr-3 text-sm font-medium text-[#0B1424] outline-none transition focus:border-[#4D86F7]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {ACTIVITY_FILTERS.map((item) => {
            const active = item.value === filter;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition",
                  active
                    ? "border-transparent bg-[#4D86F7] text-white"
                    : "border-[#DEE8F8] bg-white text-[#415069] hover:border-[#D9E5F4] hover:text-[#0B1424]"
                )}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        <label className="relative w-full lg:ml-auto lg:w-[220px]">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A96A8]" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ActivitySort)}
            className="h-10 w-full appearance-none rounded-lg border border-[#DEE8F8] bg-white pl-9 pr-9 text-sm font-semibold text-[#0B1424] outline-none transition focus:border-[#4D86F7]"
          >
            <option value="newest">{t("sort_newest")}</option>
            <option value="oldest">{t("sort_oldest")}</option>
            <option value="highest">{t("sort_highest")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A96A8]" />
        </label>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <ActivityCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
