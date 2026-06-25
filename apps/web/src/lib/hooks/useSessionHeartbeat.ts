"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

export function useSessionHeartbeat(userId: string | undefined) {
  const sessionIdRef = useRef<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!userId) return;

    // Restore session from sessionStorage
    const storedId = sessionStorage.getItem("dl_session_id");
    if (storedId) sessionIdRef.current = storedId;

    async function startSession() {
      if (sessionIdRef.current) {
        // Reactivate existing session
        await supabase.from("user_sessions").update({
          is_active: true,
          last_seen_at: new Date().toISOString(),
          session_end: null,
        }).eq("id", sessionIdRef.current);
      } else {
        // Create new session
        const { data } = await supabase.from("user_sessions").insert({
          user_id: userId,
          is_active: true,
          user_agent: navigator.userAgent,
        }).select("id").single();

        if (data) {
          sessionIdRef.current = data.id;
          sessionStorage.setItem("dl_session_id", data.id);
        }
      }
    }

    async function heartbeat() {
      if (!sessionIdRef.current) return;
      await supabase.from("user_sessions").update({
        last_seen_at: new Date().toISOString(),
      }).eq("id", sessionIdRef.current);
    }

    function endSession() {
      if (!sessionIdRef.current) return;
      // Use sendBeacon for reliability on page close
      const body = JSON.stringify({ sessionId: sessionIdRef.current });
      const payload = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/sessions/end", payload)) return;

      void fetch("/api/sessions/end", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }

    startSession();
    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    const handleBeforeUnload = () => endSession();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endSession();
    };
  }, [userId, supabase]);
}
