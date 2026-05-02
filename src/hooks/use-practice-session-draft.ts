"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearStoredPracticeDraftId,
  getLocalPracticeSessionDraft,
  createPracticeSessionDraft,
  getStoredPracticeDraftId,
  loadPracticeSessionDraft,
  setLocalPracticeSessionDraft,
  setStoredPracticeDraftId,
  updatePracticeSessionDraft,
  type PracticeSessionDraftPayload,
} from "@/lib/practice-session-drafts";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore, type Phase } from "@/store/session-store";
import type { DebateRound } from "@/types";

const ACTIVE_DRAFT_PHASES: Phase[] = [
  "mic-check",
  "prep",
  "speaking",
  "ai-rebuttal",
  "analyzing",
];

function isDraftPhase(phase: Phase) {
  return ACTIVE_DRAFT_PHASES.includes(phase);
}

export function usePracticeSessionDraft() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createInFlightRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  const selectedTopic = useSessionStore((state) => state.selectedTopic);
  const side = useSessionStore((state) => state.side);
  const practiceTrack = useSessionStore((state) => state.practiceTrack);
  const mode = useSessionStore((state) => state.mode);
  const prepTime = useSessionStore((state) => state.prepTime);
  const speechTime = useSessionStore((state) => state.speechTime);
  const aiDifficulty = useSessionStore((state) => state.aiDifficulty);
  const currentPhase = useSessionStore((state) => state.currentPhase);
  const currentRound = useSessionStore((state) => state.currentRound);
  const prepNotes = useSessionStore((state) => state.prepNotes);
  const transcript = useSessionStore((state) => state.transcript);
  const rounds = useSessionStore((state) => state.rounds);
  const sessionStartTime = useSessionStore((state) => state.sessionStartTime);
  const draftId = useSessionStore((state) => state.draftId);
  const setDraftId = useSessionStore((state) => state.setDraftId);
  const restoreSessionDraft = useSessionStore(
    (state) => state.restoreSessionDraft
  );

  const resolvedSide = side === "random" ? "proposition" : side;

  const payload = useMemo<PracticeSessionDraftPayload | null>(() => {
    if (!selectedTopic || !isDraftPhase(currentPhase)) return null;

    return {
      selectedTopic,
      side: resolvedSide,
      practiceTrack,
      mode,
      prepTime,
      speechTime,
      aiDifficulty,
      currentPhase,
      currentRound,
      prepNotes,
      transcript,
      rounds: rounds as DebateRound[],
      sessionStartTime,
    };
  }, [
    aiDifficulty,
    currentPhase,
    currentRound,
    mode,
    practiceTrack,
    prepNotes,
    prepTime,
    resolvedSide,
    rounds,
    selectedTopic,
    sessionStartTime,
    speechTime,
    transcript,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function initializeDraft() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        clearStoredPracticeDraftId();
        const localDraft = getLocalPracticeSessionDraft();
        if (!useSessionStore.getState().selectedTopic && localDraft) {
          restoreSessionDraft({
            ...localDraft,
            draftId: "",
          });
          lastSavedRef.current = JSON.stringify(localDraft);
        }
        setIsRestoringDraft(false);
        return;
      }

      setUserId(user.id);

      const storedDraftId = getStoredPracticeDraftId();
      if (!useSessionStore.getState().selectedTopic && storedDraftId) {
        const draft = await loadPracticeSessionDraft(storedDraftId, user.id);
        if (!cancelled && draft) {
          restoreSessionDraft(draft);
          lastSavedRef.current = JSON.stringify(draft);
        } else if (!cancelled) {
          clearStoredPracticeDraftId(storedDraftId);
        }
      }

      if (!cancelled) {
        setIsRestoringDraft(false);
      }
    }

    initializeDraft().catch(() => {
      if (!cancelled) setIsRestoringDraft(false);
    });

    return () => {
      cancelled = true;
    };
  }, [restoreSessionDraft]);

  useEffect(() => {
    if (!userId || !payload || draftId || createInFlightRef.current) return;

    createInFlightRef.current = true;
    createPracticeSessionDraft(userId, payload)
      .then((createdDraftId) => {
        setDraftId(createdDraftId);
        setStoredPracticeDraftId(createdDraftId);
        lastSavedRef.current = JSON.stringify(payload);
      })
      .catch(() => {
        // Draft autosave is best-effort; local in-memory session still works.
      })
      .finally(() => {
        createInFlightRef.current = false;
      });
  }, [draftId, payload, setDraftId, userId]);

  useEffect(() => {
    if (!userId || !draftId || !payload) return;

    const nextSnapshot = JSON.stringify(payload);
    if (nextSnapshot === lastSavedRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      updatePracticeSessionDraft(draftId, userId, payload)
        .then(() => {
          lastSavedRef.current = nextSnapshot;
          setStoredPracticeDraftId(draftId);
        })
        .catch(() => {
          // Keep the local session usable if autosave fails.
        });
    }, 650);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [draftId, payload, userId]);

  useEffect(() => {
    if (userId || !payload) return;

    const nextSnapshot = JSON.stringify(payload);
    if (nextSnapshot === lastSavedRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      setLocalPracticeSessionDraft(payload);
      lastSavedRef.current = nextSnapshot;
    }, 650);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [payload, userId]);

  return { isRestoringDraft, draftUserId: userId };
}
