"use client";

import { useSessionHeartbeat } from "@/lib/hooks/useSessionHeartbeat";

export function SessionHeartbeatProvider({ userId }: { userId: string }) {
  useSessionHeartbeat(userId);
  return null;
}
