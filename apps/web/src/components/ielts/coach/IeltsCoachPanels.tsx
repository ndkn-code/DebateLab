"use client";

import { BeautifulRecommendationCard } from "@/components/beautifului";
import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";
import type { IeltsCoachResponseMetadata } from "@/lib/coach/ielts-api-contract";
import { scoreAuthorityLabel } from "./IeltsCoachMessage";
import {
  resolveIeltsCoachActionDestination,
  type IeltsCoachActionDestination,
} from "./actions";
import { IELTS_COACH_COPY, type CoachLocale } from "./copy";

type CoachCopy = (typeof IELTS_COACH_COPY)[CoachLocale];

export function IeltsCoachHeader({
  copy,
  hasMessages,
  isLoading,
  onNewConversation,
}: {
  copy: CoachCopy;
  hasMessages: boolean;
  isLoading: boolean;
  onNewConversation: () => void;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="type-eyebrow text-primary">{copy.eyebrow}</p>
        <h1 className="mt-1 type-heading-lg text-on-surface">{copy.title}</h1>
        <p className="mt-1 max-w-2xl type-body-sm text-on-surface-variant">
          {copy.intro}
        </p>
      </div>
      {hasMessages ? (
        <Button
          variant="outline"
          disabled={isLoading}
          onClick={onNewConversation}
        >
          <ProductIcon name="plus" size="sm" />
          {copy.newChat}
        </Button>
      ) : null}
    </header>
  );
}

export function IeltsCoachRecommendation({
  copy,
  locale,
  metadata,
  disabled,
  onAction,
}: {
  copy: CoachCopy;
  locale: CoachLocale;
  metadata: IeltsCoachResponseMetadata | null | undefined;
  disabled: boolean;
  onAction: (destination: IeltsCoachActionDestination) => void;
}) {
  if (!metadata) return null;
  const output = metadata.coach;
  const destination = resolveIeltsCoachActionDestination({
    action: output.action,
    locale,
  });
  const confidenceLevel = copy.confidenceLevels[output.confidence.level];

  return (
    <BeautifulRecommendationCard
      eyebrow={copy.recommendationTitle}
      title={output.recommendedTask.title}
      description={output.recommendedTask.instructions}
      confidenceLabel={`${copy.confidence}: ${confidenceLevel}`}
      confidenceValue={Math.round(output.confidence.value * 100)}
      primaryAction={
        destination
          ? {
              label: output.action.label,
              disabled,
              onClick: () => onAction(destination),
            }
          : undefined
      }
    >
      <div className="space-y-2 type-caption text-on-surface-variant">
        <p>
          <strong className="font-semibold text-on-surface">
            {copy.whyItHelps}:{" "}
          </strong>
          {output.recommendedTask.whyItHelps}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span>{copy.scoreAuthority}</span>
          <span className="font-medium text-on-surface">
            {scoreAuthorityLabel(output.scoreAuthority.effective, locale)}
          </span>
        </div>
        {output.confidence.limitations.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4">
            {output.confidence.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : null}
        {!destination ? (
          <p className="text-error">{copy.actionUnavailable}</p>
        ) : null}
        <p>{copy.practiceEstimateDisclaimer}</p>
      </div>
    </BeautifulRecommendationCard>
  );
}
