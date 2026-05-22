"use client";

import { useSessionHeartbeat } from "@/lib/hooks/useSessionHeartbeat";
import { useAnalyticsEventTracker } from "@/lib/hooks/useAnalyticsEventTracker";

export function SessionHeartbeatProvider({ userId }: { userId: string }) {
  useSessionHeartbeat(userId);
  useAnalyticsEventTracker(userId);
  return null;
}
