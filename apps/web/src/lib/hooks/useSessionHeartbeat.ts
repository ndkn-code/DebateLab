"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

export function useSessionHeartbeat(userId: string | undefined) {
  const sessionIdRef = useRef<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;

    // Restore session from sessionStorage
    const storedId = sessionStorage.getItem("dl_session_id");
    if (storedId) sessionIdRef.current = storedId;

    async function startSession() {
      // Fetch geo info once (best effort)
      let geo: { country?: string; city?: string; lat?: number; lon?: number } = {};
      try {
        const res = await fetch("https://ip-api.com/json/?fields=country,city,lat,lon", { signal: AbortSignal.timeout(3000) });
        if (res.ok) geo = await res.json();
      } catch { /* ignore */ }

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
          geo_country: geo.country ?? null,
          geo_city: geo.city ?? null,
          geo_lat: geo.lat ?? null,
          geo_lon: geo.lon ?? null,
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
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`;
      const body = JSON.stringify({ is_active: false, session_end: new Date().toISOString() });
      navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" })
      );
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
