"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Swords } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/shared/page-motion";
import {
  ProductPageHeader,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { DuelIllustration } from "@/components/debates/duel-illustration";
import { cn } from "@/lib/utils";

interface DuelHubPageProps {
  isAdmin: boolean;
}

function ModeCard({
  title,
  description,
  href,
  disabled,
  illustration,
  unavailableLabel,
}: {
  title: string;
  description: string;
  href: string;
  disabled: boolean;
  illustration: string;
  unavailableLabel: string;
}) {
  const content = (
    <div
      className={cn(
        "group relative flex min-h-[220px] flex-col overflow-hidden rounded-control border bg-surface p-4 text-left shadow-none transition-colors",
        disabled
          ? "cursor-not-allowed border-outline-variant/15 opacity-75"
          : "border-outline-variant hover:border-primary/45 hover:bg-primary-container/15",
      )}
    >
      <div className="flex flex-1 items-center justify-center rounded-control bg-surface-container-low">
        <DuelIllustration
          name={illustration}
          alt={title}
          className="h-24 w-full max-w-[180px] transition-transform duration-150 group-hover:scale-[1.02] motion-reduce:transform-none"
        />
      </div>

      <div className="mt-4">
        <h2 className="type-title font-semibold text-on-surface">{title}</h2>
        <p className="mt-1 line-clamp-2 type-body-sm text-on-surface-variant">
          {description}
        </p>
      </div>

      <span
        className={cn(
          "mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-control bg-primary px-3 type-label font-semibold text-on-primary",
          disabled && "bg-surface-container text-on-surface-variant",
        )}
      >
        {disabled ? unavailableLabel : title}
        {!disabled && <ArrowRight className="h-4 w-4" />}
      </span>
    </div>
  );

  if (disabled) {
    return <div aria-disabled="true">{content}</div>;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

export function DuelHubPage({ isAdmin }: DuelHubPageProps) {
  const t = useTranslations("duelHub");

  return (
    <PageTransition className="min-h-full bg-background">
      <ProductPageShell>
        <div className="mx-auto max-w-[1180px] px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
          <ProductPageHeader title={t("title")} icon={<Swords />} />

          <div className="mt-2 overflow-hidden rounded-xl border border-outline-variant bg-surface p-4 shadow-none sm:p-5">
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              <p className="max-w-xl type-body-sm text-on-surface-variant">
                {t("subtitle")}
              </p>
              <DuelIllustration
                name="thinkfy_duel_hero_v1"
                alt={t("title")}
                className="mx-auto h-24 w-full max-w-[150px]"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ModeCard
              title={t("match.title")}
              description={t("match.description")}
              href="/debates/matchmaking"
              disabled={!isAdmin}
              illustration="thinkfy_duel_matchmaking_v1"
              unavailableLabel={t("unavailable")}
            />
            <ModeCard
              title={t("friend.title")}
              description={t("friend.description")}
              href="/debates/new"
              disabled={!isAdmin}
              illustration="thinkfy_duel_hero_v2"
              unavailableLabel={t("unavailable")}
            />
          </div>
        </div>
      </ProductPageShell>
    </PageTransition>
  );
}
