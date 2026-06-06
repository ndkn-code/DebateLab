"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight, Swords } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import {
  ProductPageHeader,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";

interface DuelHubPageProps {
  isAdmin: boolean;
}

function ModeCard({
  title,
  description,
  href,
  disabled,
  image,
  unavailableLabel,
}: {
  title: string;
  description: string;
  href: string;
  disabled: boolean;
  image: string;
  unavailableLabel: string;
}) {
  const content = (
    <div
      className={cn(
        "group relative min-h-[360px] overflow-hidden rounded-[30px] border bg-surface p-6 text-left shadow-token-card transition-all",
        disabled
          ? "cursor-not-allowed border-outline-variant/15 opacity-75"
          : "border-outline-variant/15 hover:-translate-y-1 hover:shadow-token-card"
      )}
    >
      <Image
        src={image}
        width={220}
        height={180}
        alt=""
        priority
        className="mx-auto mt-8 h-40 w-full object-contain transition-transform group-hover:scale-[1.03]"
      />

      <div className="mt-6">
        <h2 className="text-2xl font-bold text-on-surface">{title}</h2>
        <p className="mt-3 min-h-[72px] text-sm leading-6 text-on-surface-variant">
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

          <div className="max-w-3xl rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-6 text-on-surface-variant shadow-token-card sm:p-5">
            {t("subtitle")}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <ModeCard
              title={t("match.title")}
              description={t("match.description")}
              href="/debates/matchmaking"
              disabled={!isAdmin}
              image="/images/debates/duel-preview.png"
              unavailableLabel={t("unavailable")}
            />
            <ModeCard
              title={t("friend.title")}
              description={t("friend.description")}
              href="/debates/new"
              disabled={!isAdmin}
              image="/images/debates/trophy.png"
              unavailableLabel={t("unavailable")}
            />
          </div>
        </div>
      </ProductPageShell>
    </PageTransition>
  );
}
