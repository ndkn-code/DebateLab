"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { DUEL_POLL_INTERVAL_MS } from "@/lib/debate-duels/shared";
import type { DebateDuelRoomView } from "@/types";

function isDebateDuelRoomView(
  payload: DebateDuelRoomView | { error?: string }
): payload is DebateDuelRoomView {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    "shareCode" in payload &&
    "participants" in payload
  );
}

async function fetchRoom(url: string): Promise<DebateDuelRoomView> {
  const response = await fetch(url, { credentials: "include" });
  const payload = (await response.json()) as
    | DebateDuelRoomView
    | { error?: string };

  if (!response.ok || !isDebateDuelRoomView(payload)) {
    throw new Error(
      "error" in payload ? payload.error || "Failed to load duel room." : "Failed to load duel room."
    );
  }

  return payload;
}

export function useDebateDuelRoom(
  shareCode: string | null,
  mode: "room" | "result" = "room"
) {
  const key = shareCode
    ? `/api/debate-duels/${shareCode}${mode === "result" ? "/result" : ""}`
    : null;
  const swr = useSWR(key, fetchRoom, {
    refreshInterval: DUEL_POLL_INTERVAL_MS,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
  const { data, mutate } = swr;
  const viewerId = data?.viewer.id ?? null;

  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // Realtime: postgres_changes is the durable backstop for canonical state;
  // presence tracks who is actually connected to the room right now.
  useEffect(() => {
    if (!shareCode) return;

    const supabase = createClient();
    const channel = supabase.channel(
      `debate-duel-${shareCode}`,
      viewerId ? { config: { presence: { key: viewerId } } } : undefined
    );

    for (const table of [
      "debate_duels",
      "debate_duel_participants",
      "debate_duel_speeches",
      "debate_duel_judgments",
    ]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          mutate();
        }
      );
    }

    if (viewerId) {
      channel.on("presence", { event: "sync" }, () => {
        setOnlineUserIds(Object.keys(channel.presenceState()));
      });
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && viewerId) {
        channel.track({ user_id: viewerId, online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shareCode, viewerId, mutate]);

  // Client-side judging backstop: if a duel is parked in `judging` with no
  // judgment (the speech-submit request that should have judged it died), poke
  // the idempotent /judge endpoint. Safe to call repeatedly — the endpoint
  // no-ops once a judgment exists and is rate-limited server-side.
  const isStuckJudging =
    mode === "room" && data?.status === "judging" && !data?.judgment;
  useEffect(() => {
    if (!isStuckJudging || !shareCode) return;

    let cancelled = false;
    const trigger = async () => {
      try {
        await fetch(`/api/debate-duels/${shareCode}/judge`, { method: "POST" });
      } catch {
        // ignore — a later tick (or another client) will retry
      }
      if (!cancelled) mutate();
    };

    const first = window.setTimeout(trigger, 3500);
    const interval = window.setInterval(trigger, 15000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [isStuckJudging, shareCode, mutate]);

  // AI-backfill turn: when it's the AI opponent's turn (opposition phase) and it
  // hasn't spoken yet, ask the server to generate + submit its speech. Mirrors
  // the auto-judge backstop; idempotent + rate-limited server-side.
  const aiRound =
    data?.aiOpponent && data?.status === "in_progress"
      ? data.currentPhase === "opposition-opening"
        ? 2
        : data.currentPhase === "opposition-rebuttal"
          ? 4
          : null
      : null;
  const isAiTurn =
    mode === "room" &&
    aiRound !== null &&
    !data?.speeches.some((speech) => speech.roundNumber === aiRound);
  useEffect(() => {
    if (!isAiTurn || !shareCode) return;

    let cancelled = false;
    const trigger = async () => {
      try {
        await fetch(`/api/debate-duels/${shareCode}/ai-turn`, { method: "POST" });
      } catch {
        // ignore — a later tick will retry
      }
      if (!cancelled) mutate();
    };

    // Brief beat so the AI turn feels like a turn, then retry while it stands.
    const first = window.setTimeout(trigger, 1200);
    const interval = window.setInterval(trigger, 15000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [isAiTurn, shareCode, mutate]);

  return {
    ...swr,
    onlineUserIds,
    isAiTurn,
  };
}
