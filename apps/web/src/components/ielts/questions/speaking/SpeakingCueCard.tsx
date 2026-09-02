"use client";

/**
 * Speaking Part 2 cue card, boxed the way the examiner hands it over: topic,
 * "You should say:" bullets, and the closing line. Falls back to the plain
 * prompt when the question was authored without a structured card.
 */
import { useTranslations } from "next-intl";
import type { IeltsCueCard } from "@/lib/ielts/question-types/metadata";
import { cn } from "@/lib/utils";

export function SpeakingCueCard({
  cueCard,
  prompt,
  className,
}: {
  cueCard: IeltsCueCard | null;
  prompt: string;
  className?: string;
}) {
  const t = useTranslations("ielts.player.speaking.cueCard");

  if (!cueCard) {
    return (
      <p className={cn("type-body font-medium text-on-surface", className)}>
        {prompt}
      </p>
    );
  }

  return (
    <section
      aria-label={cueCard.topic}
      className={cn(
        "flex flex-col gap-3 rounded-xl border-2 border-outline-variant bg-surface-container-lowest p-5",
        className,
      )}
    >
      <p className="type-title text-on-surface">{cueCard.topic}</p>
      <div className="flex flex-col gap-1.5">
        <p className="type-body-sm font-semibold text-on-surface">
          {t("youShouldSay")}
        </p>
        <ul className="ml-5 flex list-disc flex-col gap-1 type-body-sm text-on-surface">
          {cueCard.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      </div>
      {cueCard.closing ? (
        <p className="type-body-sm font-medium text-on-surface">
          {cueCard.closing}
        </p>
      ) : null}
    </section>
  );
}
