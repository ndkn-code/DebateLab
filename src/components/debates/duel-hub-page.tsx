"use client";

import Image from "next/image";
import { ArrowRight, Swords } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
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
}: {
  title: string;
  description: string;
  href: string;
  disabled: boolean;
  image: string;
}) {
  const content = (
    <div
      className={cn(
        "group relative min-h-[360px] overflow-hidden rounded-[30px] border bg-surface p-6 text-left shadow-[0_18px_45px_rgba(11,20,66,0.06)] transition-all",
        disabled
          ? "cursor-not-allowed border-outline-variant/15 opacity-75"
          : "border-outline-variant/15 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(11,20,66,0.1)]"
      )}
    >
      <Image
        src={image}
        width={220}
        height={180}
        alt=""
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
        {disabled ? "Unavailable" : title}
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
  return (
    <PageTransition className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Swords className="h-4 w-4" />
            1v1 Debate Arena
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
            Pick your duel format
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">
            Matchmaking is a monitored beta with invisible skill matching.
            Friend rooms stay casual, shareable, and unrated.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <ModeCard
            title="Find a Match"
            description="Queue into a human opponent with hidden MMR, fair-play telemetry, and a ready check before the duel starts."
            href="/debates/matchmaking"
            disabled={!isAdmin}
            image="/images/debates/duel-preview.png"
          />
          <ModeCard
            title="Challenge a Friend"
            description="Create a shareable room, send the code, and debate casually. These duels do not affect hidden rating."
            href="/debates/new"
            disabled={!isAdmin}
            image="/images/debates/trophy.png"
          />
        </div>
      </div>
    </PageTransition>
  );
}
