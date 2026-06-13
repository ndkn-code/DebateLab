"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Swords } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
        "group relative flex min-h-[380px] flex-col overflow-hidden rounded-[30px] border bg-surface p-6 text-left shadow-token-card transition-all",
        disabled
          ? "cursor-not-allowed border-outline-variant/15 opacity-75"
          : "border-outline-variant/15 hover:-translate-y-1"
      )}
    >
      <div className="flex flex-1 items-center justify-center rounded-[24px] bg-surface-container-low">
        <DuelIllustration
          name={illustration}
          alt={title}
          className="h-44 w-full max-w-[260px] transition-transform group-hover:scale-[1.03]"
        />
      </div>

      <div className="mt-5">
        <h2 className="text-2xl font-bold text-on-surface">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          {description}
        </p>
      </div>

      <Button
        type="button"
        disabled={disabled}
        className="mt-6 h-12 w-full rounded-2xl text-base"
      >
        {disabled ? unavailableLabel : title}
        {!disabled && <ArrowRight className="h-4 w-4" />}
      </Button>
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
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
          <ProductPageHeader title={t("title")} icon={<Swords />} />

          <div className="mt-2 overflow-hidden rounded-[30px] border border-outline-variant/15 bg-surface p-6 shadow-token-card sm:p-8">
            <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_240px]">
              <p className="max-w-xl text-base leading-7 text-on-surface-variant">
                {t("subtitle")}
              </p>
              <DuelIllustration
                name="thinkfy_duel_hero_v1"
                alt={t("title")}
                className="mx-auto h-[170px] w-full max-w-[240px]"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
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
