"use client";

import Image from "next/image";
import { useMemo, useState, type ComponentType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
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

const EMPTY_STATE_IMAGE = "/images/mascot/mascot-sleeping.webp";

const ACTIVITY_FILTERS: Array<{ value: ActivityFilter; labelKey: string }> = [
  { value: "all", labelKey: "filters.all" },
  { value: "practice", labelKey: "filters.practice" },
  { value: "duel", labelKey: "filters.duel" },
  { value: "learning", labelKey: "filters.learning" },
];

function activityMatchesFilter(
  item: ProfileActivityFeedItem,
  filter: ActivityFilter,
) {
  if (filter === "all") return true;
  if (filter === "learning")
    return item.kind === "lesson" || item.kind === "course";
  return item.kind === filter;
}

function getActivityMeta(kind: ProfileActivityKind): {
  icon: ComponentType<{ className?: string }>;
  tileClassName: string;
  labelKey: string;
} {
  switch (kind) {
    case "practice":
      return {
        icon: History,
        tileClassName: "bg-primary-container text-primary-dim",
        labelKey: "kinds.practice",
      };
    case "duel":
      return {
        icon: Swords,
        tileClassName: "bg-error-container text-error",
        labelKey: "kinds.duel",
      };
    case "lesson":
      return {
        icon: BookOpen,
        tileClassName: "bg-success-container text-success-dim",
        labelKey: "kinds.lesson",
      };
    case "course":
      return {
        icon: GraduationCap,
        tileClassName: "bg-surface-container text-chart-5",
        labelKey: "kinds.course",
      };
    case "level":
      return {
        icon: Sparkles,
        tileClassName: "bg-warning-container text-on-warning-container",
        labelKey: "kinds.level",
      };
    default:
      return {
        icon: Sparkles,
        tileClassName: "bg-surface-container text-on-surface-variant",
        labelKey: "kinds.activity",
      };
  }
}

function getScorePillClassName(score: number) {
  if (score >= 80) {
    return "bg-success-container text-success-dim";
  }
  if (score >= 55) {
    return "bg-primary-container text-primary-dim";
  }
  return "bg-warning-container text-on-warning-container";
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

function EmptyState({ privateState }: { privateState?: boolean }) {
  const t = useTranslations("profileSocial.activities");

  return (
    <section className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-5 py-12 text-center">
      {privateState ? (
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <ShieldCheck className="size-6" />
        </div>
      ) : (
        <Image
          src={EMPTY_STATE_IMAGE}
          alt=""
          width={130}
          height={130}
          unoptimized
          aria-hidden="true"
          className="mx-auto h-[110px] w-[110px] object-contain"
        />
      )}
      <h2 className="mt-5 text-lg font-bold text-on-surface">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
        {privateState ? t("private_body") : t("empty_body")}
      </p>
    </section>
  );
}

function ActivityCard({
  item,
  index,
}: {
  item: ProfileActivityFeedItem;
  index: number;
}) {
  const t = useTranslations("profileSocial.activities");
  const locale = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const meta = getActivityMeta(item.kind);
  const Icon = meta.icon;

  return (
    <motion.article
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay: Math.min(index * 0.035, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="grid min-h-11 gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:border-primary sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          meta.tileClassName,
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md px-2 type-caption font-semibold leading-none",
              meta.tileClassName,
            )}
          >
            {t(meta.labelKey)}
          </span>
          {item.xpEarned > 0 ? (
            <span className="inline-flex h-5 items-center rounded-md bg-warning-container px-2 type-caption font-semibold leading-none text-on-warning-container">
              +{item.xpEarned} XP
            </span>
          ) : null}
        </div>
        <h3 className="mt-1.5 line-clamp-2 type-title font-semibold leading-5 text-on-surface">
          {item.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 type-caption font-medium text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatActivityDate(item.createdAt, locale)}
          </span>
          {item.durationMinutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-4" />
              {t("minutes", { count: item.durationMinutes })}
            </span>
          ) : null}
          {item.score != null ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-md px-2 type-caption font-semibold leading-none tabular-nums",
                getScorePillClassName(item.score),
              )}
            >
              {t("score", { score: item.score })}
            </span>
          ) : null}
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control px-3 type-label font-semibold text-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("review")}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </motion.article>
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
    !data ||
    data.state === "private" ||
    data.state === "blocked" ||
    data.state === "not_found";
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
          return (
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
          );
        }
        if (left.score == null) return 1;
        if (right.score == null) return -1;
        return right.score - left.score;
      }

      const newest =
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime();
      return sort === "oldest" ? -newest : newest;
    });

    return nextItems;
  }, [data?.items, filter, query, sort]);

  if (isPrivate) {
    return <EmptyState privateState />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative w-full lg:w-[300px]">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search_placeholder")}
            className="h-8 w-full rounded-control border border-outline-variant bg-surface-container-lowest pl-10 pr-3 type-label font-medium text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary/45 focus:ring-2 focus:ring-ring"
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
                  "inline-flex h-8 items-center justify-center rounded-control border px-3 type-label font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-on-primary shadow-token-primary"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-on-surface",
                )}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        <label className="relative w-full lg:ml-auto lg:w-[200px]">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ActivitySort)}
            className="h-8 w-full appearance-none rounded-control border border-outline-variant bg-surface-container-lowest pl-3 pr-9 type-label font-semibold text-on-surface outline-none transition-colors focus:border-primary/45 focus:ring-2 focus:ring-ring"
          >
            <option value="newest">{t("sort_newest")}</option>
            <option value="oldest">{t("sort_oldest")}</option>
            <option value="highest">{t("sort_highest")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        </label>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid gap-3">
          {filteredItems.map((item, index) => (
            <ActivityCard key={item.id} item={item} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
