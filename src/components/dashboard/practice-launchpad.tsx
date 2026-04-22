"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  MessageSquareText,
  Mic2,
  Scale,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRACTICE_OPTIONS = [
  {
    key: "speaking",
    href: "/practice?track=speaking",
    icon: MessageSquareText,
    accent: "bg-secondary-container/40 text-secondary",
  },
  {
    key: "debate_quick",
    href: "/practice?track=debate&mode=quick&difficulty=medium",
    icon: Mic2,
    accent: "bg-primary-container/40 text-primary",
  },
  {
    key: "debate_full",
    href: "/practice?track=debate&mode=full&difficulty=medium",
    icon: Scale,
    accent: "bg-tertiary-container/40 text-tertiary",
  },
] as const;

export function PracticeLaunchpad() {
  const t = useTranslations("dashboard.home");

  return (
    <section className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-6 soft-shadow sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {t("launchpad_eyebrow")}
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-on-surface">
            {t("launchpad_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {t("launchpad_subtitle")}
          </p>
        </div>

        <Link
          href="/practice"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("view_all")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {PRACTICE_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <Link key={option.key} href={option.href}>
              <div className="group h-full rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-4 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_20px_32px_-24px_rgba(47,79,221,0.5)]">
                <div
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl",
                    option.accent
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-on-surface">
                    {t(`launchpad_options.${option.key}.title`)}
                  </h3>
                  {option.key === "debate_full" ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t("launchpad_full_cost")}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-sm leading-6 text-on-surface-variant">
                  {t(`launchpad_options.${option.key}.description`)}
                </p>

                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {t("launchpad_open")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
