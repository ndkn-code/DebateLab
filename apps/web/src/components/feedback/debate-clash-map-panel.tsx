"use client";

import { useTranslations } from "next-intl";
import {
  ClashMapBoard,
  type ClashMapItem,
} from "@/components/feedback/clash-map-board";
import { normalizeDebateClashLinks } from "@/lib/feedback/debate-review";
import { localizeRoundLabel } from "@/components/practice/round-labels";
import type { DebateSession } from "@/types";

interface DebateClashMapPanelProps {
  session: DebateSession;
}

export function DebateClashMapPanel({ session }: DebateClashMapPanelProps) {
  const t = useTranslations("sessionResult.clashMap");
  const tPractice = useTranslations("dashboard.practice");

  const speakerLabel = (speaker: "user" | "ai") =>
    speaker === "user" ? t("you") : t("aiOpponent");

  const getRoundLabel = (roundNumber: number) => {
    const label = session.rounds?.find(
      (round) => round.roundNumber === roundNumber
    )?.label;
    return label
      ? localizeRoundLabel(label, tPractice)
      : t("roundNumber", { number: roundNumber });
  };

  const links = normalizeDebateClashLinks(session.feedback?.clashLinks);
  const items: ClashMapItem[] = links.map((link) => {
    const responseLabel = link.responseSpeaker
      ? speakerLabel(link.responseSpeaker)
      : t("noResponse");
    const sourceMeta = `${getRoundLabel(link.sourceRoundNumber)} · ${t(
      "roundNumber",
      { number: link.sourceRoundNumber }
    )}`;
    const responseMeta =
      link.responseRoundNumber && link.responseSpeaker
        ? `${getRoundLabel(link.responseRoundNumber)} · ${t("roundNumber", {
            number: link.responseRoundNumber,
          })}`
        : t("outcomes.dropped");

    return {
      id: link.id,
      sourceQuote: link.sourceQuote,
      responseQuote: link.responseQuote,
      judgeRead: link.judgeRead,
      suggestion: link.suggestion,
      outcome: link.outcome,
      tag: link.tag,
      sourceLabel: speakerLabel(link.sourceSpeaker),
      sourceMeta,
      responseLabel,
      responseMeta,
      judgeMeta: t("aiJudge"),
      pairKey: `${link.sourceRoundNumber}->${link.responseRoundNumber ?? "dropped"}`,
      pairLabel: `${getRoundLabel(link.sourceRoundNumber)} → ${
        link.responseRoundNumber
          ? getRoundLabel(link.responseRoundNumber)
          : t("outcomes.dropped")
      }`,
      sideKey: link.responseSpeaker ?? "dropped",
    };
  });

  return (
    <ClashMapBoard
      items={items}
      sideOptions={[
        { value: "all", label: t("sides.all") },
        { value: "user", label: t("sides.user") },
        { value: "ai", label: t("sides.ai") },
        { value: "dropped", label: t("sides.dropped") },
      ]}
      emptyMessage={t("emptyAnalysis")}
    />
  );
}
