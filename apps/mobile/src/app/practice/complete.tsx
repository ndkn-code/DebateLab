import { File, Paths } from "expo-file-system";
import { Redirect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  IconBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";
import { trackMobilePracticeEvent } from "@/lib/mobile-analytics";
import { usePracticeSession } from "@/lib/practice-session";
import { assertSupabaseConfig, supabase } from "@/lib/supabase";
import {
  createThinkfyApiClient,
  ThinkfyApiError,
} from "@thinkfy/shared/api-client";
import type {
  MobilePracticeAttemptResponse,
  PracticeAnalysisJobResponse,
} from "@thinkfy/shared/practice-analysis";
import {
  createMobilePracticeAudioPath,
  DEFAULT_PRACTICE_LANGUAGE,
  getLocalizedTopics,
  createPracticeSessionConfig,
  MOBILE_PRACTICE_AUDIO_BUCKET,
  MOBILE_PRACTICE_AUDIO_CONTENT_TYPE,
  type DebateScore,
  type PracticeTranscriptionArtifact,
  type PracticeUploadArtifact,
} from "@thinkfy/shared/practice";

const MAX_AUDIO_BYTES = 26_214_400;
const ANALYSIS_POLL_INTERVAL_MS = 2_000;
const ANALYSIS_POLL_TIMEOUT_MS = 180_000;
const E2E_SAMPLE_FILE_NAME = "thinkfy-e2e-sample.m4a";
const E2E_SAMPLE_DURATION_SECONDS = 28;

type PracticeTranscriptionResponse = {
  transcription: PracticeTranscriptionArtifact;
};

type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "Unknown";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDisplayUri(uri: string) {
  const parts = uri.split("/");
  return parts[parts.length - 1] ?? uri;
}

function getPipelineError(error: unknown) {
  if (error instanceof ThinkfyApiError) {
    return {
      message: error.message,
      code:
        error.body && typeof error.body === "object" && "code" in error.body
          ? String(error.body.code)
          : `http_${error.status}`,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, code: null };
  }

  return { message: "The mobile transcription pipeline failed.", code: null };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAttemptId() {
  const cryptoSource =
    typeof globalThis.crypto === "object"
      ? (globalThis.crypto as RandomSource)
      : null;

  if (cryptoSource?.randomUUID) {
    return cryptoSource.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoSource?.getRandomValues) {
    cryptoSource.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function isE2ESampleRecordingEnabled() {
  return (
    __DEV__ && mobileEnv.appEnv === "development" && mobileEnv.enableE2ELogin
  );
}

function createE2ESamplePracticeConfig() {
  const topic = getLocalizedTopics(DEFAULT_PRACTICE_LANGUAGE)[0];
  if (!topic) return null;

  return createPracticeSessionConfig({
    topic,
    practiceLanguage: DEFAULT_PRACTICE_LANGUAGE,
    practiceTrack: "debate",
    mode: "quick",
    side: "proposition",
    prepTime: 30,
    speechTime: 60,
    aiDifficulty: "medium",
  });
}

function createE2ESampleRecordingArtifact() {
  const sampleFile = new File(Paths.document, E2E_SAMPLE_FILE_NAME);
  if (!sampleFile.exists || sampleFile.size <= 0) {
    throw new Error(
      `${E2E_SAMPLE_FILE_NAME} is missing from the simulator Documents directory.`,
    );
  }

  return {
    recordingId: `e2e-sample-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
    uri: sampleFile.uri,
    durationSeconds: E2E_SAMPLE_DURATION_SECONDS,
    mimeType: "audio/mp4" as const,
    fileExtension: ".m4a" as const,
    byteSize: sampleFile.size,
    createdAt: new Date().toISOString(),
    localOnly: true as const,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function createPreviewFeedback(
  config: NonNullable<ReturnType<typeof usePracticeSession>["config"]>,
): DebateScore {
  return {
    content: {
      score: 82,
      claimClarity: 8,
      evidenceSupport: 7,
      logicCoherence: 8,
      counterArgument: 7,
    },
    structure: {
      score: 78,
      introduction: 8,
      bodyOrganization: 7,
      conclusion: 8,
    },
    language: {
      score: 84,
      vocabulary: 8,
      grammar: 9,
      fluency: 8,
    },
    persuasion: {
      score: 80,
      audienceAwareness: 8,
      impactfulness: 8,
    },
    totalScore: 81,
    overallBand: "Proficient",
    summary:
      "Your speech makes a clear claim and gives the listener a concrete path through the argument.",
    strengths: [
      "Clear opening stance",
      "Good impact framing",
      "Natural pacing for a short rep",
    ],
    improvements: [
      "Add one specific example earlier",
      "Compare your impact against the other side",
    ],
    sampleArguments: [
      "Homework can be reduced because targeted review gives students the benefits of practice without replacing rest, clubs, and family time.",
    ],
    practiceTrack: config.practiceTrack,
    practiceLanguage: config.practiceLanguage,
    transcriptAnnotations: [
      {
        quote:
          "students improve fastest when practice gives them a clear claim",
        tag: "clarity",
        severity: "strength",
        feedback: "This tells the judge exactly what to listen for.",
        suggestion: "Keep this direct claim style in your first sentence.",
      },
    ],
    detailedFeedback: {
      contentFeedback:
        "The main idea is easy to follow. Add a more concrete example to make the claim feel grounded.",
      structureFeedback:
        "The speech has a clear beginning and next step. Make transitions between reasons more explicit.",
      languageFeedback:
        "The vocabulary is clean and natural. Vary sentence length to make key impacts land harder.",
      persuasionFeedback:
        "The argument is motivating. Add a direct comparison to explain why your side matters more.",
    },
  };
}

export default function PracticeCompleteRoute() {
  const colors = useThinkfyColors();
  const router = useRouter();
  const { getAccessToken, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();
  const [e2eSampleError, setE2ESampleError] = useState<string | null>(null);
  const {
    beginSession,
    clearSession,
    completeSession,
    completeTranscription,
    completeUpload,
    config,
    failAnalysis,
    failProcessing,
    markAnalysisQueued,
    markAnalysisSubmitting,
    markTranscriptionStarted,
    markUploadStarted,
    processing,
    recording,
    resetProcessing,
    updateAnalysis,
  } = usePracticeSession();
  const pipelineStartedRef = useRef(false);
  const analysisStartedRef = useRef(false);
  const apiClient = useMemo(
    () =>
      user && mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({
            baseUrl: mobileEnv.apiBaseUrl,
            getAccessToken,
          })
        : null,
    [getAccessToken, user],
  );
  const canUseE2ESampleRecording = isE2ESampleRecordingEnabled();

  const runPreviewPipeline = useCallback(async () => {
    if (!config || !recording) return;

    await markUploadStarted();
    await wait(550);
    const upload: PracticeUploadArtifact = {
      bucket: MOBILE_PRACTICE_AUDIO_BUCKET,
      path: `preview/mobile-practice/${recording.recordingId}.m4a`,
      recordingId: recording.recordingId,
      byteSize: recording.byteSize ?? 1_240_000,
      contentType: MOBILE_PRACTICE_AUDIO_CONTENT_TYPE,
      uploadedAt: new Date().toISOString(),
    };
    await completeUpload(upload);

    await markTranscriptionStarted();
    await wait(700);
    await completeTranscription({
      transcript:
        "Preview transcript: I believe students improve fastest when practice gives them a clear claim, evidence, impact, and one focused next step.",
      confidence: 0.94,
      wordCount: 25,
      provider: "deepgram",
      model: "nova-3",
      requestId: "preview-deepgram-request",
      language: config.practiceLanguage,
      warnings: [],
      audioBucket: upload.bucket,
      audioStoragePath: upload.path,
      durationSeconds: recording.durationSeconds,
      transcribedAt: new Date().toISOString(),
    });
  }, [
    completeTranscription,
    completeUpload,
    config,
    markTranscriptionStarted,
    markUploadStarted,
    recording,
  ]);

  const runLivePipeline = useCallback(async () => {
    if (!apiClient || !config || !recording || !user) {
      throw new Error("Missing mobile API, user, or recording context.");
    }

    let stage: "upload" | "transcription" = "upload";
    let upload = processing.upload;

    try {
      if (!upload) {
        assertSupabaseConfig();
        await markUploadStarted();
        trackMobilePracticeEvent(
          apiClient,
          "mobile_practice_audio_upload_started",
          "/practice/complete",
          {
            recordingId: recording.recordingId,
            durationSeconds: recording.durationSeconds,
          },
        );

        const audioFile = new File(recording.uri);
        const audioBuffer = await audioFile.arrayBuffer();
        const byteSize = audioBuffer.byteLength || audioFile.size;

        if (byteSize <= 0) {
          throw new Error("The local recording file is empty.");
        }
        if (byteSize > MAX_AUDIO_BYTES) {
          throw new Error("Recording is larger than the 25 MB upload limit.");
        }

        const path = createMobilePracticeAudioPath(
          user.id,
          recording.recordingId,
        );
        const { error } = await supabase.storage
          .from(MOBILE_PRACTICE_AUDIO_BUCKET)
          .upload(path, audioBuffer, {
            cacheControl: "3600",
            contentType: MOBILE_PRACTICE_AUDIO_CONTENT_TYPE,
            upsert: false,
          });

        if (error) throw error;

        upload = {
          bucket: MOBILE_PRACTICE_AUDIO_BUCKET,
          path,
          recordingId: recording.recordingId,
          byteSize,
          contentType: MOBILE_PRACTICE_AUDIO_CONTENT_TYPE,
          uploadedAt: new Date().toISOString(),
        };
        await completeUpload(upload);
        trackMobilePracticeEvent(
          apiClient,
          "mobile_practice_audio_upload_completed",
          "/practice/complete",
          {
            byteSize,
            path,
            recordingId: recording.recordingId,
          },
        );
      }

      stage = "transcription";
      await markTranscriptionStarted();
      trackMobilePracticeEvent(
        apiClient,
        "mobile_practice_transcription_started",
        "/practice/complete",
        {
          path: upload.path,
          recordingId: upload.recordingId,
        },
      );

      const response =
        await apiClient.requestJson<PracticeTranscriptionResponse>(
          "/api/mobile/practice-transcriptions",
          {
            method: "POST",
            body: JSON.stringify({
              bucket: upload.bucket,
              path: upload.path,
              contentType: upload.contentType,
              byteSize: upload.byteSize,
              durationSeconds: recording.durationSeconds,
              practiceLanguage: config.practiceLanguage,
              recordingId: upload.recordingId,
            }),
          },
        );

      await completeTranscription(response.transcription);
      trackMobilePracticeEvent(
        apiClient,
        "mobile_practice_transcription_completed",
        "/practice/complete",
        {
          path: upload.path,
          recordingId: upload.recordingId,
          wordCount: response.transcription.wordCount,
          warnings: response.transcription.warnings,
        },
      );
    } catch (error) {
      const normalized = getPipelineError(error);
      await failProcessing({ stage, ...normalized });
      trackMobilePracticeEvent(
        apiClient,
        stage === "upload"
          ? "mobile_practice_audio_upload_failed"
          : "mobile_practice_transcription_failed",
        "/practice/complete",
        {
          code: normalized.code,
          message: normalized.message,
          recordingId: recording.recordingId,
        },
      );
    }
  }, [
    apiClient,
    completeTranscription,
    completeUpload,
    config,
    failProcessing,
    markTranscriptionStarted,
    markUploadStarted,
    processing.upload,
    recording,
    user,
  ]);

  const runPipeline = useCallback(async () => {
    if (!config || !recording) return;
    if (previewEnabled && !user) {
      await runPreviewPipeline();
      return;
    }

    await runLivePipeline();
  }, [
    config,
    previewEnabled,
    recording,
    runLivePipeline,
    runPreviewPipeline,
    user,
  ]);

  const runPreviewAnalysis = useCallback(async () => {
    if (!config || !recording || !processing.transcription) return;

    const existingAttemptId = processing.analysis.attemptId;
    const attemptId =
      existingAttemptId && isUuid(existingAttemptId)
        ? existingAttemptId
        : createAttemptId();
    await markAnalysisSubmitting(attemptId);
    trackMobilePracticeEvent(
      apiClient,
      "mobile_practice_feedback_requested",
      "/practice/complete",
      { preview: true, attemptId },
    );
    await wait(600);
    await markAnalysisQueued({
      attemptId,
      jobId: "preview-analysis-job",
      chargedCredits: 0,
      orbBalance: null,
    });
    trackMobilePracticeEvent(
      apiClient,
      "mobile_practice_analysis_queued",
      "/practice/complete",
      { preview: true, attemptId },
    );
    await wait(800);
    await updateAnalysis({
      status: "processing",
      attemptStatus: "analyzing",
    });
    await wait(900);
    await updateAnalysis({
      status: "completed",
      attemptStatus: "completed",
      feedback: createPreviewFeedback(config),
      modelName: "preview-model",
      legacySessionId: "preview-session",
      error: null,
      completedAt: new Date().toISOString(),
    });
    trackMobilePracticeEvent(
      apiClient,
      "mobile_practice_analysis_completed",
      "/practice/complete",
      { preview: true, attemptId },
    );
    router.push("/practice/feedback" as Href);
  }, [
    apiClient,
    config,
    markAnalysisQueued,
    markAnalysisSubmitting,
    processing.analysis.attemptId,
    processing.transcription,
    recording,
    router,
    updateAnalysis,
  ]);

  const runLiveAnalysis = useCallback(async () => {
    if (!apiClient || !config || !recording || !processing.transcription) {
      throw new Error("Missing transcript, mobile API, or session context.");
    }

    const transcript = processing.transcription;
    const upload = processing.upload;
    const existingAttemptId = processing.analysis.attemptId;
    const attemptId =
      existingAttemptId && isUuid(existingAttemptId)
        ? existingAttemptId
        : createAttemptId();
    await markAnalysisSubmitting(attemptId);
    trackMobilePracticeEvent(
      apiClient,
      "mobile_practice_feedback_requested",
      "/practice/complete",
      {
        attemptId,
        wordCount: transcript.wordCount,
        practiceTrack: config.practiceTrack,
      },
    );

    try {
      const created =
        await apiClient.requestJson<MobilePracticeAttemptResponse>(
          "/api/mobile/practice-attempts",
          {
            method: "POST",
            body: JSON.stringify({
              attemptId,
              transcript: transcript.transcript,
              topic: config.topic.title,
              side: config.resolvedSide,
              practiceTrack: config.practiceTrack,
              practiceLanguage: config.practiceLanguage,
              speechType:
                config.practiceTrack === "speaking"
                  ? "Speaking Practice"
                  : config.mode === "full"
                    ? "Opening Statement"
                    : "Quick Debate Practice",
              timeLimit: config.speechTime / 60,
              actualDuration: recording.durationSeconds,
              isFullRound: false,
              mode: config.mode,
              prepTime: config.prepTime,
              speechTime: config.speechTime,
              aiDifficulty: config.aiDifficulty,
              topicId: isUuid(config.topic.id) ? config.topic.id : undefined,
              practiceTopicKey: config.topic.topicKey ?? config.topic.id,
              topicCategory: config.topic.category,
              topicCategoryKey: config.topic.categoryKey,
              topicDifficulty: config.topic.difficulty,
              audioStoragePath: upload?.path ?? transcript.audioStoragePath,
            }),
          },
        );

      await markAnalysisQueued({
        attemptId: created.attemptId,
        jobId: created.jobId,
        chargedCredits: created.chargedCredits,
        orbBalance: created.orbBalance,
      });
      trackMobilePracticeEvent(
        apiClient,
        "mobile_practice_analysis_queued",
        "/practice/complete",
        {
          attemptId: created.attemptId,
          jobId: created.jobId,
          chargedCredits: created.chargedCredits,
        },
      );

      const pollStartedAt = Date.now();
      while (Date.now() - pollStartedAt < ANALYSIS_POLL_TIMEOUT_MS) {
        await wait(ANALYSIS_POLL_INTERVAL_MS);
        const job = await apiClient.requestJson<PracticeAnalysisJobResponse>(
          `/api/mobile/analysis-jobs/${created.jobId}`,
          { method: "GET" },
        );

        if (job.status === "completed" && job.feedback) {
          await updateAnalysis({
            status: "completed",
            attemptId: job.attemptId,
            jobId: job.id,
            attemptStatus: job.attemptStatus,
            feedback: job.feedback,
            modelName: job.modelName,
            legacySessionId: job.legacySessionId,
            error: null,
            completedAt: new Date().toISOString(),
          });
          trackMobilePracticeEvent(
            apiClient,
            "mobile_practice_analysis_completed",
            "/practice/complete",
            {
              attemptId: job.attemptId,
              jobId: job.id,
              totalScore: job.feedback.totalScore,
            },
          );
          router.push("/practice/feedback" as Href);
          return;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          const message =
            job.error ?? "Analysis failed. Your transcript is saved.";
          await failAnalysis("failed", message);
          trackMobilePracticeEvent(
            apiClient,
            "mobile_practice_analysis_failed",
            "/practice/complete",
            { attemptId: job.attemptId, jobId: job.id, message },
          );
          return;
        }

        await updateAnalysis({
          status: job.status === "processing" ? "processing" : "queued",
          attemptId: job.attemptId,
          jobId: job.id,
          attemptStatus: job.attemptStatus,
          modelName: job.modelName,
          legacySessionId: job.legacySessionId,
          error: null,
        });
      }

      const timeoutMessage =
        "Analysis is taking longer than expected. Your transcript is saved.";
      await failAnalysis("timeout", timeoutMessage);
      trackMobilePracticeEvent(
        apiClient,
        "mobile_practice_analysis_failed",
        "/practice/complete",
        { attemptId: created.attemptId, jobId: created.jobId, timeout: true },
      );
    } catch (error) {
      const normalized = getPipelineError(error);
      await failAnalysis(
        error instanceof ThinkfyApiError && error.status === 402
          ? "insufficient_credits"
          : "failed",
        normalized.message,
      );
      trackMobilePracticeEvent(
        apiClient,
        "mobile_practice_analysis_failed",
        "/practice/complete",
        {
          attemptId,
          code: normalized.code,
          message: normalized.message,
        },
      );
    }
  }, [
    apiClient,
    config,
    failAnalysis,
    markAnalysisQueued,
    markAnalysisSubmitting,
    processing.analysis.attemptId,
    processing.transcription,
    processing.upload,
    recording,
    router,
    updateAnalysis,
  ]);

  const requestFeedback = useCallback(async () => {
    if (!config || !recording || !processing.transcription) return;
    analysisStartedRef.current = true;
    if (previewEnabled && !user) {
      await runPreviewAnalysis();
      return;
    }
    await runLiveAnalysis();
  }, [
    config,
    previewEnabled,
    processing.transcription,
    recording,
    runLiveAnalysis,
    runPreviewAnalysis,
    user,
  ]);

  useEffect(() => {
    pipelineStartedRef.current = false;
    analysisStartedRef.current = false;
  }, [recording?.recordingId]);

  useEffect(() => {
    if (!config || !recording) return;
    if (pipelineStartedRef.current) return;
    if (processing.status === "failed" || processing.status === "transcribed") {
      return;
    }
    if (processing.status !== "idle" && processing.status !== "uploaded") {
      return;
    }

    pipelineStartedRef.current = true;
    void runPipeline();
  }, [config, processing.status, recording, runPipeline]);

  const useE2ESampleRecording = async () => {
    setE2ESampleError(null);
    try {
      const sampleConfig = config ?? createE2ESamplePracticeConfig();
      if (!sampleConfig) {
        throw new Error("No practice topic is available for the E2E sample.");
      }

      const sampleRecording = createE2ESampleRecordingArtifact();
      pipelineStartedRef.current = false;
      analysisStartedRef.current = false;
      await completeSession(sampleRecording, sampleConfig);
      router.replace("/practice/complete" as Href);
    } catch (error) {
      setE2ESampleError(
        error instanceof Error
          ? error.message
          : "The E2E sample recording could not be loaded.",
      );
    }
  };

  if (!user && !previewEnabled) {
    return <Redirect href="/" />;
  }

  if (!config || !recording) {
    return (
      <Screen
        eyebrow="Practice"
        subtitle="No completed mobile recording is available in this session."
        title="Nothing saved yet"
      >
        <StateBlock
          actionLabel="Go to setup"
          body="Start from Practice to create a fresh local recording."
          onPress={() => router.replace("/practice")}
          title="Recording not found"
        />
        {canUseE2ESampleRecording ? (
          <Surface tone="warning">
            <SectionHeader title="E2E sample" />
            <AppText color={colors.muted} variant="body">
              Use a simulator-local spoken m4a sample to verify upload,
              transcription, feedback, and history when mic input is silent.
            </AppText>
            {e2eSampleError ? (
              <AppText color={colors.error} variant="caption">
                {e2eSampleError}
              </AppText>
            ) : null}
            <AppButton onPress={useE2ESampleRecording}>
              Use E2E sample recording
            </AppButton>
          </Surface>
        ) : null}
      </Screen>
    );
  }

  const isShortRecording = recording.durationSeconds < 20;
  const isWorking =
    processing.status === "uploading" || processing.status === "transcribing";
  const transcript = processing.transcription;
  const analysis = processing.analysis;
  const isAnalysisWorking =
    analysis.status === "submitting" ||
    analysis.status === "queued" ||
    analysis.status === "processing";
  const canRequestFeedback =
    Boolean(transcript) &&
    !transcript?.warnings.includes("no_speech_detected") &&
    (transcript?.wordCount ?? 0) >= 20 &&
    !isWorking &&
    !isAnalysisWorking;

  const retrySameTopic = async () => {
    await beginSession(
      createPracticeSessionConfig({
        topic: config.topic,
        aiDifficulty: config.aiDifficulty,
        mode: config.mode,
        practiceLanguage: config.practiceLanguage,
        practiceTrack: config.practiceTrack,
        prepTime: config.prepTime,
        side: config.side,
        speechTime: config.speechTime,
      }),
    );
    router.replace("/practice/session" as Href);
  };

  const retryPipeline = async () => {
    pipelineStartedRef.current = true;
    if (
      processing.status === "failed" &&
      processing.lastError?.stage === "upload"
    ) {
      await resetProcessing();
    }
    await runPipeline();
  };

  const retryAnalysis = async () => {
    analysisStartedRef.current = true;
    await requestFeedback();
  };

  const backToSetup = async () => {
    await clearSession();
    router.replace("/practice");
  };

  return (
    <Screen
      eyebrow="Practice"
      subtitle="Audio upload and transcription prepare this session for Phase 7 feedback."
      title={
        transcript
          ? "Transcript ready"
          : isWorking
            ? "Preparing transcript"
            : "Recording saved"
      }
      testID="practice-complete-screen"
    >
      <Surface tone={getHeroTone(processing.status, isShortRecording)}>
        <View style={styles.centerStack}>
          <IconBadge
            color={getHeroIconColor(
              colors,
              processing.status,
              isShortRecording,
            )}
            name={getHeroIcon(processing.status, isShortRecording)}
            size={58}
          />
          <AppText style={styles.centerText} variant="heading">
            {getHeroTitle(processing.status, isShortRecording)}
          </AppText>
          <AppText
            color={colors.muted}
            style={styles.centerText}
            variant="body"
          >
            {getHeroBody(processing.status, isShortRecording)}
          </AppText>
        </View>
      </Surface>

      <PipelinePanel
        isWorking={isWorking}
        onRetry={retryPipeline}
        processing={processing}
      />

      {transcript ? (
        <Surface
          tone={
            transcript.warnings.includes("no_speech_detected")
              ? "warning"
              : "success"
          }
        >
          <SectionHeader title="Transcript" />
          <View style={styles.badgeRow}>
            <Badge tone={transcript.wordCount >= 20 ? "success" : "warning"}>
              {transcript.wordCount} words
            </Badge>
            <Badge tone="neutral">
              {transcript.confidence == null
                ? "confidence n/a"
                : `${Math.round(transcript.confidence * 100)}% confidence`}
            </Badge>
            <Badge tone="neutral">{transcript.model}</Badge>
          </View>
          <AppText
            color={colors.muted}
            style={styles.transcriptText}
            variant="body"
          >
            {transcript.transcript ||
              "No clear speech was detected. Record again or retry transcription before moving to feedback."}
          </AppText>
        </Surface>
      ) : null}

      {canUseE2ESampleRecording &&
      (transcript?.warnings.includes("no_speech_detected") ||
        (transcript?.wordCount ?? 0) < 20) ? (
        <Surface tone="warning">
          <SectionHeader title="Simulator E2E fallback" />
          <AppText color={colors.muted} variant="body">
            The simulator produced a valid audio file with little or no speech.
            Use the local spoken sample to exercise the real Phase 6 and Phase 7
            services without changing production behavior.
          </AppText>
          {e2eSampleError ? (
            <AppText color={colors.error} variant="caption">
              {e2eSampleError}
            </AppText>
          ) : null}
          <AppButton
            disabled={isWorking || isAnalysisWorking}
            onPress={useE2ESampleRecording}
          >
            Use E2E sample recording
          </AppButton>
        </Surface>
      ) : null}

      {transcript ? (
        <AnalysisPanel
          analysis={analysis}
          canRequestFeedback={canRequestFeedback}
          isWorking={isAnalysisWorking}
          onRequest={requestFeedback}
          onRetry={retryAnalysis}
          onViewFeedback={() => router.push("/practice/feedback" as Href)}
          wordCount={transcript.wordCount}
        />
      ) : null}

      <Surface>
        <SectionHeader title="Session summary" />
        <View style={styles.badgeRow}>
          <Badge>{config.practiceTrack}</Badge>
          <Badge tone="neutral">{config.mode}</Badge>
          <Badge tone="neutral">{config.resolvedSide}</Badge>
          <Badge tone="neutral">{config.practiceLanguage}</Badge>
        </View>
        <AppText variant="heading">{config.topic.title}</AppText>
        <SummaryRow
          label="Duration"
          value={formatDuration(recording.durationSeconds)}
        />
        <SummaryRow
          label="Format"
          value={`${recording.mimeType} ${recording.fileExtension}`}
        />
        <SummaryRow
          label="Upload"
          value={
            processing.upload
              ? `${processing.upload.bucket}/${processing.upload.path}`
              : "Waiting"
          }
        />
        <SummaryRow
          label="File size"
          value={formatBytes(processing.upload?.byteSize ?? recording.byteSize)}
        />
        <SummaryRow label="Local file" value={getDisplayUri(recording.uri)} />
      </Surface>

      <Surface tone="primary">
        <AppText variant="bodyStrong">Feedback boundary</AppText>
        <AppText color={colors.muted} variant="body">
          Phase 7 submits this transcript to analysis, then saves the completed
          result into mobile feedback and history.
        </AppText>
      </Surface>

      <AppButton
        disabled={isWorking || isAnalysisWorking}
        onPress={retrySameTopic}
      >
        Record this topic again
      </AppButton>
      <AppButton
        disabled={isWorking || isAnalysisWorking}
        onPress={backToSetup}
        variant="secondary"
      >
        Back to setup
      </AppButton>
    </Screen>
  );
}

function getHeroTone(
  status: string,
  isShortRecording: boolean,
): "primary" | "success" | "warning" | "error" | undefined {
  if (status === "failed") return "error";
  if (status === "transcribed") return "success";
  if (isShortRecording) return "warning";
  return "primary";
}

function getHeroIcon(
  status: string,
  isShortRecording: boolean,
):
  | "checkmark.circle"
  | "exclamationmark.triangle"
  | "waveform"
  | "arrow.up.circle" {
  if (status === "failed" || isShortRecording)
    return "exclamationmark.triangle";
  if (status === "uploading") return "arrow.up.circle";
  if (status === "transcribing") return "waveform";
  return "checkmark.circle";
}

function getHeroIconColor(
  colors: ReturnType<typeof useThinkfyColors>,
  status: string,
  isShortRecording: boolean,
) {
  if (status === "failed") return colors.error;
  if (isShortRecording) return colors.warning;
  if (status === "transcribed") return colors.secondary;
  return colors.primary;
}

function getHeroTitle(status: string, isShortRecording: boolean) {
  if (status === "failed") return "Needs a retry";
  if (status === "uploading") return "Uploading audio";
  if (status === "transcribing") return "Building transcript";
  if (status === "transcribed") return "Transcript ready";
  if (isShortRecording) return "Very short recording";
  return "Nice rep";
}

function getHeroBody(status: string, isShortRecording: boolean) {
  if (status === "failed") {
    return "Your local recording is preserved, so you can retry without speaking again.";
  }
  if (status === "uploading") {
    return "Thinkfy is saving your private practice audio to your account.";
  }
  if (status === "transcribing") {
    return "Deepgram is converting the recording into a reviewable transcript.";
  }
  if (status === "transcribed") {
    return "This transcript is ready for the Phase 7 feedback pipeline.";
  }
  if (isShortRecording) {
    return "The file is saved, but future feedback usually needs a longer speech.";
  }
  return "The local m4a artifact is saved and Phase 6 will process it automatically.";
}

function PipelinePanel({
  isWorking,
  processing,
  onRetry,
}: {
  isWorking: boolean;
  processing: ReturnType<typeof usePracticeSession>["processing"];
  onRetry: () => void;
}) {
  const colors = useThinkfyColors();
  const uploadDone = Boolean(processing.upload);
  const transcriptDone = Boolean(processing.transcription);
  const progress = transcriptDone
    ? 1
    : uploadDone
      ? 0.66
      : isWorking
        ? 0.33
        : 0.12;

  return (
    <Surface>
      <SectionHeader title="Processing" />
      <ProgressBar
        tone={processing.status === "failed" ? "warning" : "primary"}
        value={progress}
      />
      <View style={styles.statusList}>
        <StatusRow
          active={processing.status === "uploading"}
          done={uploadDone}
          label="Upload private audio"
        />
        <StatusRow
          active={processing.status === "transcribing"}
          done={transcriptDone}
          label="Generate transcript"
        />
        <StatusRow
          active={processing.status === "transcribed"}
          done={transcriptDone}
          label="Ready for feedback phase"
        />
      </View>

      {processing.lastError ? (
        <View style={styles.errorBox}>
          <AppText variant="bodyStrong">
            {processing.lastError.stage === "upload"
              ? "Upload failed"
              : "Transcription failed"}
          </AppText>
          <AppText color={colors.muted} variant="body">
            {processing.lastError.message}
          </AppText>
          {processing.lastError.code ? (
            <Badge tone="neutral">{processing.lastError.code}</Badge>
          ) : null}
          <AppButton onPress={onRetry}>Retry</AppButton>
        </View>
      ) : null}

      {isWorking && processing.status === "transcribing" && !transcriptDone ? (
        <View style={styles.errorBox}>
          <AppText variant="bodyStrong">Still waiting?</AppText>
          <AppText color={colors.muted} variant="body">
            Retry the transcription without recording again.
          </AppText>
          <AppButton onPress={onRetry}>Retry transcription</AppButton>
        </View>
      ) : null}
    </Surface>
  );
}

function AnalysisPanel({
  analysis,
  canRequestFeedback,
  isWorking,
  wordCount,
  onRequest,
  onRetry,
  onViewFeedback,
}: {
  analysis: ReturnType<typeof usePracticeSession>["processing"]["analysis"];
  canRequestFeedback: boolean;
  isWorking: boolean;
  wordCount: number;
  onRequest: () => void;
  onRetry: () => void;
  onViewFeedback: () => void;
}) {
  const colors = useThinkfyColors();
  const completed = analysis.status === "completed" && analysis.feedback;
  const failed =
    analysis.status === "failed" ||
    analysis.status === "timeout" ||
    analysis.status === "insufficient_credits";
  const progress =
    analysis.status === "completed"
      ? 1
      : analysis.status === "processing"
        ? 0.72
        : analysis.status === "queued"
          ? 0.48
          : analysis.status === "submitting"
            ? 0.24
            : 0.08;

  return (
    <Surface tone={failed ? "error" : completed ? "success" : "default"}>
      <SectionHeader title="Feedback analysis" />
      <ProgressBar tone={failed ? "warning" : "primary"} value={progress} />
      <View style={styles.statusList}>
        <StatusRow
          active={analysis.status === "submitting"}
          done={analysis.status !== "idle"}
          label="Request feedback"
        />
        <StatusRow
          active={analysis.status === "queued"}
          done={
            analysis.status === "processing" || analysis.status === "completed"
          }
          label="Queue analysis"
        />
        <StatusRow
          active={analysis.status === "processing"}
          done={analysis.status === "completed"}
          label="Generate feedback"
        />
      </View>
      <View style={styles.badgeRow}>
        <Badge tone={wordCount >= 20 ? "success" : "warning"}>
          {wordCount} words
        </Badge>
        <Badge tone="neutral">
          {analysis.chargedCredits == null
            ? "Credits on submit"
            : `${analysis.chargedCredits} Credits`}
        </Badge>
        {analysis.orbBalance != null ? (
          <Badge tone="neutral">{analysis.orbBalance} left</Badge>
        ) : null}
      </View>

      {analysis.error ? (
        <View style={styles.errorBox}>
          <AppText variant="bodyStrong">
            {analysis.status === "insufficient_credits"
              ? "Not enough Credits"
              : "Feedback needs attention"}
          </AppText>
          <AppText color={colors.muted} variant="body">
            {analysis.error}
          </AppText>
        </View>
      ) : (
        <AppText color={colors.muted} variant="body">
          Thinkfy will analyze clarity, structure, language, persuasion, and
          transcript highlights.
        </AppText>
      )}

      {completed ? (
        <AppButton onPress={onViewFeedback}>View feedback</AppButton>
      ) : failed ? (
        <AppButton
          disabled={isWorking || !canRequestFeedback}
          onPress={onRetry}
        >
          Retry feedback
        </AppButton>
      ) : (
        <AppButton
          disabled={!canRequestFeedback}
          isLoading={isWorking}
          onPress={onRequest}
        >
          Get feedback
        </AppButton>
      )}
    </Surface>
  );
}

function StatusRow({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  const colors = useThinkfyColors();
  const tone = done ? "success" : active ? "primary" : "neutral";

  return (
    <View style={styles.statusRow}>
      <IconBadge
        color={done ? colors.secondary : active ? colors.primary : colors.muted}
        name={done ? "checkmark" : active ? "ellipsis" : "circle"}
        size={26}
      />
      <AppText variant="bodyStrong">{label}</AppText>
      <Badge tone={tone}>
        {done ? "done" : active ? "working" : "waiting"}
      </Badge>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const colors = useThinkfyColors();

  return (
    <View style={styles.summaryRow}>
      <AppText color={colors.muted} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.summaryValue} variant="bodyStrong">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centerStack: {
    alignItems: "center",
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  errorBox: {
    gap: spacing.sm,
  },
  statusList: {
    gap: spacing.sm,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryRow: {
    gap: spacing.xs,
  },
  summaryValue: {
    flexShrink: 1,
  },
  transcriptText: {
    lineHeight: 22,
  },
});
