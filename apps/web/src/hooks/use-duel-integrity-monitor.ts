"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { DebateDuelRoomView } from "@/types";

const MIN_EVENT_GAP_MS = 4500;

export function useDuelIntegrityMonitor(room: DebateDuelRoomView | null) {
  const lastEventAtRef = useRef(new Map<string, number>());
  const roomRef = useRef(room);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const sendEvent = useCallback(
    async (actionType: string, metadata: Record<string, unknown> = {}) => {
      const currentRoom = roomRef.current;
      if (
        !currentRoom ||
        currentRoom.duelKind !== "matchmaking" ||
        !currentRoom.viewer.isParticipant ||
        currentRoom.status === "completed" ||
        currentRoom.status === "expired" ||
        currentRoom.status === "cancelled"
      ) {
        return;
      }

      const now = Date.now();
      const lastEventAt = lastEventAtRef.current.get(actionType) ?? 0;
      if (now - lastEventAt < MIN_EVENT_GAP_MS) {
        return;
      }
      lastEventAtRef.current.set(actionType, now);

      try {
        const response = await fetch(
          `/api/debate-duels/${currentRoom.shareCode}/integrity`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionType, metadata }),
            keepalive: true,
          }
        );
        const payload = (await response.json()) as {
          showWarning?: boolean;
          message?: string | null;
        };

        if (response.ok && payload.showWarning && payload.message) {
          toast.warning(payload.message);
        }
      } catch {
        // Integrity telemetry should never interrupt the duel experience.
      }
    },
    []
  );

  useEffect(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom || currentRoom.duelKind !== "matchmaking") {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void sendEvent("TAB_SWITCH", { visibilityState: document.visibilityState });
      } else {
        void sendEvent("WINDOW_FOCUS", { visibilityState: document.visibilityState });
      }
    };
    const handleBlur = () => {
      void sendEvent("WINDOW_BLUR");
    };
    const handleFocus = () => {
      void sendEvent("WINDOW_FOCUS");
    };
    const handlePaste = () => {
      void sendEvent("COPY_PASTE", { event: "paste" });
    };
    const handleContextMenu = () => {
      void sendEvent("RIGHT_CLICK");
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = event.ctrlKey || event.metaKey;
      if (!isShortcut) return;
      const key = event.key.toLowerCase();
      if (["c", "v", "x", "a"].includes(key)) {
        void sendEvent("KEYBOARD_SHORTCUT", { key });
      }
    };
    const handleOffline = () => {
      void sendEvent("DISCONNECT");
    };
    const handleOnline = () => {
      void sendEvent("RECONNECT");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [sendEvent, room?.duelKind, room?.id]);
}
