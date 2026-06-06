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
        badgeClassName: "bg-surface-container text-primary-dim",
        iconClassName: "text-primary-dim",
        labelKey: "kinds.practice",
      };
    case "duel":
      return {
        icon: Swords,
        badgeClassName: "bg-surface-container text-on-surface-variant",
        iconClassName: "text-on-surface-variant",
        labelKey: "kinds.duel",
      };
    case "lesson":
      return {
        icon: BookOpen,
        badgeClassName: "bg-surface-container text-on-surface-variant",
        iconClassName: "text-success",
        labelKey: "kinds.lesson",
      };
    case "course":
      return {
        icon: GraduationCap,
        badgeClassName: "bg-surface-container text-primary-dim",
        iconClassName: "text-primary",
        labelKey: "kinds.course",
      };
    case "level":
      return {
        icon: Sparkles,
        badgeClassName: "bg-surface-container text-on-surface-variant",
        iconClassName: "text-on-surface-variant",
        labelKey: "kinds.level",
      };
    default:
      return {
        icon: Sparkles,
        badgeClassName: "bg-surface-container text-on-surface-variant",
        iconClassName: "text-on-surface-variant",
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
    <section className="rounded-xl border border-dashed border-outline-variant bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        {privateState ? (
          <ShieldCheck className="h-6 w-6" />
        ) : (
          <Clock3 className="h-6 w-6" />
        )}
      </div>
      <h2 className="mt-5 text-xl font-semibold text-on-surface">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
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
    <article className="grid gap-4 rounded-xl border border-outline-variant bg-white p-4 shadow-token-card sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-background">
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
            <span className="text-xs font-semibold text-on-surface-variant">
              +{item.xpEarned} XP
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-on-surface">
          {item.title}
        </h3>
        {item.subtitle ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-on-surface-variant">
            {item.subtitle}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {formatActivityDate(item.createdAt, locale)}
          </span>
          {item.durationMinutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              {t("minutes", { count: item.durationMinutes })}
            </span>
          ) : null}
          {item.score != null ? (
            <span className="font-semibold text-on-surface">
              {t("score", { score: item.score })}
            </span>
          ) : null}
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dim"
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search_placeholder")}
            className="h-10 w-full rounded-lg border border-outline-variant bg-white pl-9 pr-3 text-sm font-medium text-on-surface outline-none transition focus:border-primary"
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
                    ? "border-transparent bg-primary text-white"
                    : "border-outline-variant bg-white text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
                )}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        <label className="relative w-full lg:ml-auto lg:w-[220px]">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ActivitySort)}
            className="h-10 w-full appearance-none rounded-lg border border-outline-variant bg-white pl-9 pr-9 text-sm font-semibold text-on-surface outline-none transition focus:border-primary"
          >
            <option value="newest">{t("sort_newest")}</option>
            <option value="oldest">{t("sort_oldest")}</option>
            <option value="highest">{t("sort_highest")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
