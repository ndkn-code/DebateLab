"use client";

import {
  ClashMapBoard,
  type ClashMapItem,
} from "@/components/feedback/clash-map-board";
import { normalizeDebateDuelClashLinks } from "@/lib/debate-duels/clash-links";
import type { DebateDuelRoomView, DebateDuelSide, DebateDuelSpeech } from "@/types";

interface DuelClashMapProps {
  room: DebateDuelRoomView;
}

function getSpeechLabel(speech: DebateDuelSpeech | null) {
  if (!speech) return "Dropped";
  if (speech.roundNumber === 1) return "Proposition Opening";
  if (speech.roundNumber === 2) return "Opposition Opening";
  if (speech.roundNumber === 3) return "Proposition Rebuttal";
  if (speech.roundNumber === 4) return "Opposition Rebuttal";
  return `Round ${speech.roundNumber}`;
}

function getSideLabel(side: DebateDuelSide | null) {
  if (side === "proposition") return "Proposition";
  if (side === "opposition") return "Opposition";
  return "No response";
}

function getParticipantName(room: DebateDuelRoomView, side: DebateDuelSide | null) {
  if (!side) return "No response";
  return (
    room.participants.find((participant) => participant.role === side)
      ?.displayName ?? getSideLabel(side)
  );
}

export function DuelClashMap({ room }: DuelClashMapProps) {
  const speechById = new Map(room.speeches.map((speech) => [speech.id, speech]));
  const links = normalizeDebateDuelClashLinks(room.judgment?.clashLinks);
  const items: ClashMapItem[] = links.map((link) => {
    const sourceSpeech = speechById.get(link.sourceSpeechId) ?? null;
    const responseSpeech = link.responseSpeechId
      ? speechById.get(link.responseSpeechId) ?? null
      : null;
    const responseSide = responseSpeech?.side ?? null;

    return {
      id: link.id,
      sourceQuote: link.sourceQuote,
      responseQuote: link.responseQuote,
      judgeRead: link.judgeRead,
      suggestion: link.suggestion,
      outcome: link.outcome,
      tag: link.tag,
      sourceLabel: getParticipantName(room, sourceSpeech?.side ?? null),
      sourceMeta: getSpeechLabel(sourceSpeech),
      responseLabel: getParticipantName(room, responseSide),
      responseMeta: getSpeechLabel(responseSpeech),
      judgeMeta: "AI Judge",
      pairKey: `${link.sourceSpeechId}->${link.responseSpeechId ?? "dropped"}`,
      pairLabel: `${getSpeechLabel(sourceSpeech)} -> ${getSpeechLabel(
        responseSpeech
      )}`,
      sideKey: responseSide ?? "dropped",
    };
  });

  return (
    <ClashMapBoard
      items={items}
      sideOptions={[
        { value: "all", label: "All sides" },
        { value: "proposition", label: "Proposition responses" },
        { value: "opposition", label: "Opposition responses" },
        { value: "dropped", label: "Dropped claims" },
      ]}
      emptyMessage="Clash analysis will appear for newly judged debates."
    />
  );
}
