"use client";

import { useEffect } from "react";
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

export function useDebateDuelRoom(shareCode: string, mode: "room" | "result" = "room") {
  const key = `/api/debate-duels/${shareCode}${mode === "result" ? "/result" : ""}`;
  const swr = useSWR(key, fetchRoom, {
    refreshInterval: DUEL_POLL_INTERVAL_MS,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`debate-duel-${shareCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debate_duels",
        },
        () => {
          swr.mutate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debate_duel_participants",
        },
        () => {
          swr.mutate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debate_duel_speeches",
        },
        () => {
          swr.mutate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debate_duel_judgments",
        },
        () => {
          swr.mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shareCode, swr]);

  return swr;
}
