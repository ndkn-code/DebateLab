"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  GraduationCap,
  ListChecks,
  type LucideIcon,
} from "@/components/ui/icons";

interface EntryTile {
  href: string;
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
}

const TILES: EntryTile[] = [
  {
    href: "/ielts/study-plan",
    icon: CalendarDays,
    titleKey: "tile_plan_title",
    bodyKey: "tile_plan_body",
  },
  {
    href: "/ielts/review",
    icon: ListChecks,
    titleKey: "tile_review_title",
    bodyKey: "tile_review_body",
  },
  {
    href: "/ielts/learn",
    icon: Brain,
    titleKey: "tile_learn_title",
    bodyKey: "tile_learn_body",
  },
  {
    href: "/ielts/tests",
    icon: GraduationCap,
    titleKey: "tile_library_title",
    bodyKey: "tile_library_body",
  },
];

function IeltsLearnUpsellTile() {
  const t = useTranslations("dashboard.ielts");

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest text-on-surface">
        <Brain className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-body font-semibold text-on-surface">
          {t("tile_learn_upsell_title")}
        </span>
        <span className="block truncate type-caption text-on-surface-variant">
          {t("tile_learn_upsell_body")}
        </span>
      </span>
    </div>
  );
}

/**
 * Entry tiles into the learner's adaptive surfaces (WS-6.2.1): study plan,
 * Review, Learn path, and mock library. Simple nav tiles — the dashboard
 * sections above carry the adaptive substance.
 */
export function IeltsEntryTiles({
  isEnrolled,
  reviewsDueCount,
}: {
  isEnrolled: boolean;
  reviewsDueCount: number;
}) {
  const t = useTranslations("dashboard.ielts");
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map(({ href, icon: Icon, titleKey, bodyKey }) => {
        if (href === "/ielts/learn" && !isEnrolled) {
          return <IeltsLearnUpsellTile key={href} />;
        }

        return (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4 transition-colors hover:border-primary hover:bg-surface-container-high"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block type-body font-semibold text-on-surface">
                {t(titleKey)}
              </span>
              <span className="block truncate type-caption text-on-surface-variant">
                {href === "/ielts/review" && reviewsDueCount > 0
                  ? t("tile_review_due", { count: reviewsDueCount })
                  : t(bodyKey)}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        );
      })}
    </section>
  );
}
