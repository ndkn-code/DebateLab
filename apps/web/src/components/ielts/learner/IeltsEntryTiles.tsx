"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  GraduationCap,
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

/**
 * Entry tiles into the learner's adaptive surfaces (WS-6.2.1): the full study
 * plan (6.2.2), the Learn path (6.2.3), and the mock library. Simple nav tiles —
 * the dashboard sections above carry the adaptive substance.
 */
export function IeltsEntryTiles() {
  const t = useTranslations("dashboard.ielts");
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {TILES.map(({ href, icon: Icon, titleKey, bodyKey }) => (
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
              {t(bodyKey)}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      ))}
    </section>
  );
}
