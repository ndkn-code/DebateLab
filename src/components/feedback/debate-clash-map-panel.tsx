"use client";

import {
  ClashMapBoard,
  type ClashMapItem,
} from "@/components/feedback/clash-map-board";
import { normalizeDebateClashLinks } from "@/lib/feedback/debate-review";
import type { DebateSession } from "@/types";

interface DebateClashMapPanelProps {
  session: DebateSession;
}

function speakerLabel(speaker: "user" | "ai") {
  return speaker === "user" ? "You" : "AI Opponent";
}

function getRoundLabel(session: DebateSession, roundNumber: number) {
  return (
    session.rounds?.find((round) => round.roundNumber === roundNumber)?.label ??
    `Round ${roundNumber}`
  );
}

export function DebateClashMapPanel({ session }: DebateClashMapPanelProps) {
  const links = normalizeDebateClashLinks(session.feedback?.clashLinks);
  const items: ClashMapItem[] = links.map((link) => {
    const responseLabel = link.responseSpeaker
      ? speakerLabel(link.responseSpeaker)
      : "No response";
    const sourceMeta = `${getRoundLabel(session, link.sourceRoundNumber)} · Round ${
      link.sourceRoundNumber
    }`;
    const responseMeta =
      link.responseRoundNumber && link.responseSpeaker
        ? `${getRoundLabel(session, link.responseRoundNumber)} · Round ${
            link.responseRoundNumber
          }`
        : "Dropped";

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
      judgeMeta: "AI Judge",
      pairKey: `${link.sourceRoundNumber}->${link.responseRoundNumber ?? "dropped"}`,
      pairLabel: `${getRoundLabel(session, link.sourceRoundNumber)} -> ${
        link.responseRoundNumber
          ? getRoundLabel(session, link.responseRoundNumber)
          : "Dropped"
      }`,
      sideKey: link.responseSpeaker ?? "dropped",
    };
  });

  return (
    <ClashMapBoard
      items={items}
      sideOptions={[
        { value: "all", label: "All sides" },
        { value: "user", label: "Your responses" },
        { value: "ai", label: "AI responses" },
        { value: "dropped", label: "Dropped claims" },
      ]}
      emptyMessage="Clash analysis will appear for newly analyzed full-round debates."
    />
  );
}
