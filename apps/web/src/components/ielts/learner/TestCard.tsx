"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Clock3,
  GraduationCap,
  Layers,
  Target,
} from "@/components/ui/icons";
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
export function TestCard({
  card,
  compact = false,
}: {
  card: IeltsTestCard;
  compact?: boolean;
}) {
  const t = useTranslations("dashboard.ielts");
  const Icon = KIND_ICON[card.kind];

  return (
    <article
      className={cn(
        "group flex h-full flex-col rounded-xl border border-outline-variant bg-surface transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-primary/45 hover:bg-surface-container-low motion-reduce:transform-none",
        compact ? "gap-2.5 p-3" : "gap-3 p-4",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary",
            compact ? "size-9" : "size-10",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-title font-semibold text-on-surface line-clamp-2">
            {card.title}
          </h3>
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

      {card.description && !compact ? (
        <p className="type-body-sm text-on-surface-variant line-clamp-2">
          {card.description}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5">
        {card.skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex min-h-5 items-center rounded-md bg-surface-container-high px-2 type-caption font-semibold leading-none text-on-surface-variant"
          >
            {t(`skill_${skill}`)}
          </span>
        ))}
      </div>

      <Link
        href={card.startHref}
        className={cn(
          buttonVariants({
            variant: compact ? "secondary" : "primary",
            size: "sm",
          }),
          "w-full",
        )}
      >
        {t("start_test")}
        <ArrowRight className="size-4" />
      </Link>
    </article>
  );
}
