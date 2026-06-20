"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Clock3, GraduationCap, Layers, Target } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IeltsTestCard } from "@/lib/ielts/learner/library";

const KIND_ICON = {
  full_mock: GraduationCap,
  skill_set: Layers,
  drill: Target,
} as const;

/**
 * A single published-test card for the library + home teaser (WS-5.1). Links
 * into the existing mock player, which owns attempt creation.
 */
export function TestCard({ card }: { card: IeltsTestCard }) {
  const t = useTranslations("dashboard.ielts");
  const Icon = KIND_ICON[card.kind];

  return (
    <article className="group flex h-full flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-token-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-title font-semibold text-on-surface line-clamp-2">{card.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="primary">{t(`kind_${card.kind}`)}</Badge>
            <Badge variant="secondary">{t(`module_${card.module}`)}</Badge>
            {card.durationMinutes ? (
              <span className="inline-flex items-center gap-1 type-caption font-semibold text-on-surface-variant">
                <Clock3 className="size-3.5" />
                {t("minutes", { count: card.durationMinutes })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {card.description ? (
        <p className="type-body-sm text-on-surface-variant line-clamp-2">{card.description}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5">
        {card.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-surface-container-high px-2.5 py-1 type-caption font-semibold leading-none text-on-surface-variant"
          >
            {t(`skill_${skill}`)}
          </span>
        ))}
      </div>

      <Link
        href={card.startHref}
        className={cn(buttonVariants({ variant: "primary", size: "sm" }), "w-full")}
      >
        {t("start_test")}
        <ArrowRight className="size-4" />
      </Link>
    </article>
  );
}
