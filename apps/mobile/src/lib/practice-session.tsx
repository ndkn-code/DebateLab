import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import type {
  PracticeFeedbackAnalysisState,
  PracticeProcessingState,
  PracticeRecordingArtifact,
  PracticeSessionConfig,
  PracticeSessionDraft,
  PracticeSessionPhase,
  PracticeTranscriptionArtifact,
  PracticeUploadArtifact,
} from "@thinkfy/shared/practice";
import { createIdlePracticeProcessingState } from "@thinkfy/shared/practice";

const PRACTICE_DRAFT_KEY = "thinkfy.mobile.practice-session-draft.v1";

type PracticeSessionContextValue = {
  config: PracticeSessionConfig | null;
  recording: PracticeRecordingArtifact | null;
  processing: PracticeProcessingState;
  phase: PracticeSessionPhase;
  isRestoring: boolean;
  restoredAt: string | null;
  beginSession: (config: PracticeSessionConfig) => Promise<void>;
  setPhase: (phase: PracticeSessionPhase) => Promise<void>;
  completeSession: (
    recording: PracticeRecordingArtifact,
    overrideConfig?: PracticeSessionConfig,
  ) => Promise<void>;
  markUploadStarted: () => Promise<void>;
  completeUpload: (upload: PracticeUploadArtifact) => Promise<void>;
  markTranscriptionStarted: () => Promise<void>;
  completeTranscription: (
    transcription: PracticeTranscriptionArtifact,
  ) => Promise<void>;
  markAnalysisSubmitting: (attemptId: string) => Promise<void>;
  markAnalysisQueued: (params: {
    attemptId: string;
    jobId: string;
    chargedCredits: number;
    orbBalance: number | null;
  }) => Promise<void>;
  updateAnalysis: (
    analysis: Partial<PracticeFeedbackAnalysisState>,
  ) => Promise<void>;
  failAnalysis: (
    status: "failed" | "timeout" | "insufficient_credits",
    message: string,
  ) => Promise<void>;
  failProcessing: (error: {
    stage: "upload" | "transcription";
    message: string;
    code?: string | null;
  }) => Promise<void>;
  resetProcessing: () => Promise<void>;
  clearSession: () => Promise<void>;
};

const PracticeSessionContext =
  createContext<PracticeSessionContextValue | null>(null);

function isPracticeSessionDraft(value: unknown): value is PracticeSessionDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PracticeSessionDraft>;

  return Boolean(
    candidate.config &&
    typeof candidate.config === "object" &&
    candidate.phase &&
    typeof candidate.phase === "string" &&
    candidate.updatedAt &&
    typeof candidate.updatedAt === "string",
  );
}

function normalizeProcessingState(
  processing: PracticeProcessingState | undefined,
) {
  const idle = createIdlePracticeProcessingState();

  return {
    ...idle,
    ...processing,
    analysis: {
      ...idle.analysis,
      ...(processing?.analysis ?? {}),
    },
  };
}

async function writeDraft(draft: PracticeSessionDraft | null) {
  try {
    if (!draft) {
      await SecureStore.deleteItemAsync(PRACTICE_DRAFT_KEY);
      return;
    }

    await SecureStore.setItemAsync(PRACTICE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Draft recovery is a convenience; never block the practice flow on it.
  }
}

export function PracticeSessionProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<PracticeSessionConfig | null>(null);
  const [recording, setRecording] = useState<PracticeRecordingArtifact | null>(
    null,
  );
  const [processing, setProcessing] = useState<PracticeProcessingState>(
    createIdlePracticeProcessingState,
  );
  const processingRef = useRef<PracticeProcessingState>(
    createIdlePracticeProcessingState(),
  );
  const [phase, setLocalPhase] = useState<PracticeSessionPhase>("setup");
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    SecureStore.getItemAsync(PRACTICE_DRAFT_KEY)
      .then((rawDraft) => {
        if (!isMounted || !rawDraft) return;

        const parsed = JSON.parse(rawDraft) as unknown;
        if (!isPracticeSessionDraft(parsed)) return;

        setConfig(parsed.config);
        setRecording(parsed.recording);
        const restoredProcessing = normalizeProcessingState(parsed.processing);
        processingRef.current = restoredProcessing;
        setProcessing(restoredProcessing);
        setLocalPhase(parsed.phase);
        setRestoredAt(new Date().toISOString());
      })
      .catch(() => null)
      .finally(() => {
        if (isMounted) setIsRestoring(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const persist = useCallback(
    async (
      nextConfig: PracticeSessionConfig | null,
      nextPhase: PracticeSessionPhase,
      nextRecording: PracticeRecordingArtifact | null,
      nextProcessing: PracticeProcessingState,
    ) => {
      if (!nextConfig) {
        await writeDraft(null);
        return;
      }

      await writeDraft({
        config: nextConfig,
        phase: nextPhase,
        recording: nextRecording,
        processing: nextProcessing,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const beginSession = useCallback(
    async (nextConfig: PracticeSessionConfig) => {
      const idleProcessing = createIdlePracticeProcessingState();
      setConfig(nextConfig);
      setRecording(null);
      processingRef.current = idleProcessing;
      setProcessing(idleProcessing);
      setLocalPhase("mic-check");
      await persist(nextConfig, "mic-check", null, idleProcessing);
    },
    [persist],
  );

  const setPhase = useCallback(
    async (nextPhase: PracticeSessionPhase) => {
      setLocalPhase(nextPhase);
      await persist(config, nextPhase, recording, processingRef.current);
    },
    [config, persist, recording],
  );

  const completeSession = useCallback(
    async (
      nextRecording: PracticeRecordingArtifact,
      overrideConfig?: PracticeSessionConfig,
    ) => {
      const idleProcessing = createIdlePracticeProcessingState();
      const nextConfig = overrideConfig ?? config;
      setConfig(nextConfig);
      setRecording(nextRecording);
      processingRef.current = idleProcessing;
      setProcessing(idleProcessing);
      setLocalPhase("complete");
      await persist(nextConfig, "complete", nextRecording, idleProcessing);
    },
    [config, persist],
  );

  const updateProcessing = useCallback(
    async (nextProcessing: PracticeProcessingState) => {
      processingRef.current = nextProcessing;
      setProcessing(nextProcessing);
      await persist(config, phase, recording, nextProcessing);
    },
    [config, persist, phase, recording],
  );

  const markUploadStarted = useCallback(async () => {
    await updateProcessing({
      ...processingRef.current,
      status: "uploading",
      lastError: null,
      updatedAt: new Date().toISOString(),
    });
  }, [updateProcessing]);

  const completeUpload = useCallback(
    async (upload: PracticeUploadArtifact) => {
      await updateProcessing({
        ...processingRef.current,
        status: "uploaded",
        upload,
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
    },
    [updateProcessing],
  );

  const markTranscriptionStarted = useCallback(async () => {
    await updateProcessing({
      ...processingRef.current,
      status: "transcribing",
      lastError: null,
      updatedAt: new Date().toISOString(),
    });
  }, [updateProcessing]);

  const completeTranscription = useCallback(
    async (transcription: PracticeTranscriptionArtifact) => {
      await updateProcessing({
        ...processingRef.current,
        status: "transcribed",
        transcription,
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
    },
    [updateProcessing],
  );

  const markAnalysisSubmitting = useCallback(
    async (attemptId: string) => {
      const now = new Date().toISOString();
      await updateProcessing({
        ...processingRef.current,
        analysis: {
          ...processingRef.current.analysis,
          status: "submitting",
          attemptId,
          error: null,
          requestedAt: processingRef.current.analysis.requestedAt ?? now,
          updatedAt: now,
        },
      });
    },
    [updateProcessing],
  );

  const markAnalysisQueued = useCallback(
    async (params: {
      attemptId: string;
      jobId: string;
      chargedCredits: number;
      orbBalance: number | null;
    }) => {
      const now = new Date().toISOString();
      await updateProcessing({
        ...processingRef.current,
        analysis: {
          ...processingRef.current.analysis,
          status: "queued",
          attemptId: params.attemptId,
          jobId: params.jobId,
          chargedCredits: params.chargedCredits,
          orbBalance: params.orbBalance,
          error: null,
          requestedAt: processingRef.current.analysis.requestedAt ?? now,
          updatedAt: now,
        },
      });
    },
    [updateProcessing],
  );

  const updateAnalysis = useCallback(
    async (analysis: Partial<PracticeFeedbackAnalysisState>) => {
      await updateProcessing({
        ...processingRef.current,
        analysis: {
          ...processingRef.current.analysis,
          ...analysis,
          error: analysis.error ?? processingRef.current.analysis.error,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [updateProcessing],
  );

  const failAnalysis = useCallback(
    async (
      status: "failed" | "timeout" | "insufficient_credits",
      message: string,
    ) => {
      await updateProcessing({
        ...processingRef.current,
        analysis: {
          ...processingRef.current.analysis,
          status,
          error: message,
          retryCount: processingRef.current.analysis.retryCount + 1,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [updateProcessing],
  );

  const failProcessing = useCallback(
    async (error: {
      stage: "upload" | "transcription";
      message: string;
      code?: string | null;
    }) => {
      const currentProcessing = processingRef.current;
      await updateProcessing({
        ...currentProcessing,
        status: "failed",
        lastError: {
          stage: error.stage,
          message: error.message,
          code: error.code ?? null,
          occurredAt: new Date().toISOString(),
        },
        retryCount: currentProcessing.retryCount + 1,
        updatedAt: new Date().toISOString(),
      });
    },
    [updateProcessing],
  );

  const resetProcessing = useCallback(async () => {
    await updateProcessing(createIdlePracticeProcessingState());
  }, [updateProcessing]);

  const clearSession = useCallback(async () => {
    const idleProcessing = createIdlePracticeProcessingState();
    setConfig(null);
    setRecording(null);
    processingRef.current = idleProcessing;
    setProcessing(idleProcessing);
    setLocalPhase("setup");
    await writeDraft(null);
  }, []);

  const value = useMemo<PracticeSessionContextValue>(
    () => ({
      config,
      recording,
      processing,
      phase,
      isRestoring,
      restoredAt,
      beginSession,
      setPhase,
      completeSession,
      markUploadStarted,
      completeUpload,
      markTranscriptionStarted,
      completeTranscription,
      failAnalysis,
      failProcessing,
      markAnalysisQueued,
      markAnalysisSubmitting,
      resetProcessing,
      updateAnalysis,
      clearSession,
    }),
    [
      beginSession,
      clearSession,
      completeTranscription,
      completeSession,
      completeUpload,
      config,
      failAnalysis,
      failProcessing,
      isRestoring,
      markAnalysisQueued,
      markAnalysisSubmitting,
      markTranscriptionStarted,
      markUploadStarted,
      phase,
      processing,
      recording,
      resetProcessing,
      restoredAt,
      setPhase,
      updateAnalysis,
    ],
  );

  return (
    <PracticeSessionContext.Provider value={value}>
      {children}
    </PracticeSessionContext.Provider>
  );
}

export function usePracticeSession() {
  const value = useContext(PracticeSessionContext);

  if (!value) {
    throw new Error(
      "usePracticeSession must be used inside PracticeSessionProvider.",
    );
  }

  return value;
}
