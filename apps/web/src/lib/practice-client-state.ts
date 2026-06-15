"use client";

import { clearPracticeDebugId } from "@/lib/practice-debug-id";
import {
  clearLocalPracticeSessionDraft,
  clearStoredPracticeDraftId,
} from "@/lib/practice-session-drafts";
import { useSessionStore } from "@/store/session-store";

export type AuthUserIdSnapshot = string | null | undefined;

export function shouldResetPracticeClientStateOnAuthChange(
  previousUserId: AuthUserIdSnapshot,
  nextUserId: string | null
) {
  return previousUserId !== undefined && previousUserId !== nextUserId;
}

export function resetPracticeClientStateForAuthChange() {
  useSessionStore.getState().resetSession();
  clearStoredPracticeDraftId();
  clearLocalPracticeSessionDraft();
  clearPracticeDebugId();
}
