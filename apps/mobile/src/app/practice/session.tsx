import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type PermissionResponse,
} from "expo-audio";
import { Redirect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type AppStateStatus,
} from "react-native";

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
import { createThinkfyApiClient } from "@thinkfy/shared/api-client";
import {
  createPracticeRecordingId,
  type PracticeRecordingArtifact,
} from "@thinkfy/shared/practice";

type RuntimePhase = "mic-check" | "prep" | "speaking";
type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

function getRuntimePhaseFromDraft(
  draftPhase: "setup" | "mic-check" | "prep" | "speaking" | "complete"
): RuntimePhase {
  if (draftPhase === "prep" || draftPhase === "speaking") {
    return draftPhase;
  }

  return "mic-check";
}

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function resolvePermissionState(
  permission: PermissionResponse | null
): PermissionState {
  if (!permission) return "unknown";
  return permission.granted ? "granted" : "denied";
}

export default function PracticeSessionRoute() {
  const colors = useThinkfyColors();
  const router = useRouter();
  const { getAccessToken, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();
  const {
    config,
    completeSession,
    clearSession,
    isRestoring,
    phase,
    restoredAt,
    setPhase,
  } = usePracticeSession();
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      if (status.hasError) {
        setRecordingError(status.error ?? "Recording failed.");
      }
    }
  );
  const recorderState = useAudioRecorderState(recorder, 250);
  const [runtimePhase, setRuntimePhase] = useState<RuntimePhase>("mic-check");
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [prepRemaining, setPrepRemaining] = useState(config?.prepTime ?? 0);
  const [speakingRemaining, setSpeakingRemaining] = useState(
    config?.speechTime ?? 0
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [backgroundInterrupted, setBackgroundInterrupted] = useState(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pausedMillisRef = useRef(0);
  const recorderDurationMillisRef = useRef(0);
  const runtimePhaseRef = useRef<RuntimePhase>("mic-check");
  const pausedRef = useRef(false);
  const apiClient = useMemo(
    () =>
      user && mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({
            baseUrl: mobileEnv.apiBaseUrl,
            getAccessToken,
          })
        : null,
    [getAccessToken, user]
  );
  const permissionState = resolvePermissionState(permission);

  useEffect(() => {
    runtimePhaseRef.current = runtimePhase;
  }, [runtimePhase]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    recorderDurationMillisRef.current = recorderState.durationMillis;
  }, [recorderState.durationMillis]);

  useEffect(() => {
    if (!config) return;
    setPrepRemaining(config.prepTime);
    setSpeakingRemaining(config.speechTime);
    setRuntimePhase(getRuntimePhaseFromDraft(phase));
  }, [config, phase]);

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then(setPermission)
      .catch(() => setPermission(null));
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const nextPermission = await requestRecordingPermissionsAsync();
      setPermission(nextPermission);
      trackMobilePracticeEvent(
        apiClient,
        "mobile_practice_mic_permission_result",
        "/practice/session",
        {
          granted: nextPermission.granted,
          status: nextPermission.status,
        }
      );
      return nextPermission.granted;
    } catch (error) {
      setRecordingError(
        error instanceof Error
          ? error.message
          : "Microphone permission could not be requested."
      );
      return false;
    }
  }, [apiClient]);

  const ensurePermission = useCallback(async () => {
    const existing = await getRecordingPermissionsAsync().catch(() => null);
    if (existing?.granted) {
      setPermission(existing);
      return true;
    }

    return requestPermission();
  }, [requestPermission]);

  const startSpeaking = useCallback(async () => {
    if (!config) return;

    const granted = await ensurePermission();
    if (!granted) return;

    try {
      setRecordingError(null);
      setBackgroundInterrupted(false);
      setIsPaused(false);
      pauseStartedAtRef.current = null;
      pausedMillisRef.current = 0;
      recorderDurationMillisRef.current = 0;
      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: false,
        interruptionMode: "doNotMix",
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      setSpeakingRemaining(config.speechTime);
      setRuntimePhase("speaking");
      await setPhase("speaking");
    } catch (error) {
      setRecordingError(
        error instanceof Error ? error.message : "Recording could not start."
      );
    }
  }, [config, ensurePermission, recorder, setPhase]);

  const pauseRecording = useCallback(
    (reason: "manual" | "background") => {
      if (runtimePhaseRef.current !== "speaking" || pausedRef.current) return;

      try {
        if (recorderState.isRecording || recorder.isRecording) {
          recorder.pause();
        }
        pauseStartedAtRef.current = Date.now();
        setIsPaused(true);
        if (reason === "background") setBackgroundInterrupted(true);
        trackMobilePracticeEvent(
          apiClient,
          "mobile_practice_recording_paused",
          "/practice/session",
          { reason }
        );
      } catch (error) {
        setRecordingError(
          error instanceof Error ? error.message : "Recording could not pause."
        );
      }
    },
    [apiClient, recorder, recorderState.isRecording]
  );

  const resumeRecording = useCallback(() => {
    if (runtimePhaseRef.current !== "speaking" || !pausedRef.current) return;

    try {
      if (pauseStartedAtRef.current) {
        pausedMillisRef.current += Date.now() - pauseStartedAtRef.current;
      }
      pauseStartedAtRef.current = null;
      recorder.record();
      setIsPaused(false);
    } catch (error) {
      setRecordingError(
        error instanceof Error ? error.message : "Recording could not resume."
      );
    }
  }, [recorder]);

  const stopRecording = useCallback(
    async (reason: "manual" | "timer") => {
      if (!config || isStopping) return;

      setIsStopping(true);
      try {
        if (pauseStartedAtRef.current) {
          pausedMillisRef.current += Date.now() - pauseStartedAtRef.current;
          pauseStartedAtRef.current = null;
        }

        await recorder.stop();

        const status = recorder.getStatus();
        const uri = recorder.uri ?? status.url;
        if (!uri) {
          throw new Error("No local recording URI was produced.");
        }

        const elapsedMillis =
          recorderDurationMillisRef.current ||
          Math.max(
            0,
            Date.now() -
              (recordingStartedAtRef.current ?? Date.now()) -
              pausedMillisRef.current
          );
        const durationSeconds = Math.max(1, Math.round(elapsedMillis / 1000));
        const artifact: PracticeRecordingArtifact = {
          recordingId: createPracticeRecordingId(),
          uri,
          durationSeconds,
          mimeType: "audio/mp4",
          fileExtension: ".m4a",
          byteSize: null,
          createdAt: new Date().toISOString(),
          localOnly: true,
        };

        await completeSession(artifact);
        trackMobilePracticeEvent(
          apiClient,
          "mobile_practice_recording_completed",
          "/practice/session",
          {
            durationSeconds,
            reason,
            topicId: config.topic.id,
          }
        );
        router.replace("/practice/complete" as Href);
      } catch (error) {
        setRecordingError(
          error instanceof Error ? error.message : "Recording could not stop."
        );
      } finally {
        setIsStopping(false);
      }
    },
    [
      apiClient,
      completeSession,
      config,
      isStopping,
      recorder,
      router,
    ]
  );

  useEffect(() => {
    if (recordingError) return;
    if (runtimePhase !== "prep") return;
    if (prepRemaining <= 0) {
      void startSpeaking();
      return;
    }

    const timer = window.setInterval(() => {
      setPrepRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [prepRemaining, recordingError, runtimePhase, startSpeaking]);

  useEffect(() => {
    if (recordingError) return;
    if (runtimePhase !== "speaking" || isPaused || isStopping) return;
    if (speakingRemaining <= 0) {
      void stopRecording("timer");
      return;
    }

    const timer = window.setInterval(() => {
      setSpeakingRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isPaused,
    isStopping,
    recordingError,
    runtimePhase,
    speakingRemaining,
    stopRecording,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          nextState !== "active" &&
          runtimePhaseRef.current === "speaking" &&
          !pausedRef.current
        ) {
          pauseRecording("background");
        }
      }
    );

    return () => subscription.remove();
  }, [pauseRecording]);

  const startPrep = async () => {
    if (!config) return;
    setRecordingError(null);
    setPrepRemaining(config.prepTime);
    setRuntimePhase("prep");
    await setPhase("prep");
  };

  const cancelSession = async () => {
    await clearSession();
    router.replace("/practice");
  };

  if (!user && !previewEnabled) {
    return <Redirect href="/" />;
  }

  if (isRestoring) {
    return (
      <Screen title="Restoring practice">
        <StateBlock
          body="Checking for a local mobile session draft."
          state="loading"
          title="One moment"
        />
      </Screen>
    );
  }

  if (!config) {
    return <Redirect href="/practice" />;
  }

  return (
    <Screen
      eyebrow="Practice"
      subtitle={config.topic.title}
      title={
        runtimePhase === "mic-check"
          ? "Mic check"
          : runtimePhase === "prep"
            ? "Prep your case"
            : "Speak now"
      }
      testID="practice-session-screen"
    >
      {restoredAt ? (
        <Surface tone="warning">
          <AppText variant="bodyStrong">Session draft restored</AppText>
          <AppText color={colors.muted} variant="caption">
            Active recordings cannot survive an app restart, so you can resume
            from mic check safely.
          </AppText>
        </Surface>
      ) : null}

      {runtimePhase === "mic-check" ? (
        <MicCheckPanel
          onCancel={cancelSession}
          onOpenSettings={() => Linking.openSettings()}
          onRequestPermission={requestPermission}
          onStartPrep={startPrep}
          permissionState={permissionState}
        />
      ) : null}

      {runtimePhase === "prep" ? (
        <PrepPanel
          onCancel={cancelSession}
          onSkip={() => void startSpeaking()}
          remaining={prepRemaining}
          total={config.prepTime}
        />
      ) : null}

      {runtimePhase === "speaking" ? (
        <SpeakingPanel
          backgroundInterrupted={backgroundInterrupted}
          isPaused={isPaused}
          isStopping={isStopping}
          metering={recorderState.metering}
          onPause={() => pauseRecording("manual")}
          onResume={resumeRecording}
          onStop={() => void stopRecording("manual")}
          remaining={speakingRemaining}
          total={config.speechTime}
        />
      ) : null}

      {recordingError ? (
        <StateBlock
          actionLabel={
            runtimePhase === "speaking" && isPaused ? "Resume" : "Try again"
          }
          body={recordingError}
          onPress={
            runtimePhase === "speaking" && isPaused
              ? resumeRecording
              : () => {
                  setRecordingError(null);
                  setRuntimePhase("mic-check");
                }
          }
          state="error"
          title="Recording issue"
        />
      ) : null}
    </Screen>
  );
}

function MicCheckPanel({
  permissionState,
  onRequestPermission,
  onOpenSettings,
  onStartPrep,
  onCancel,
}: {
  permissionState: PermissionState;
  onRequestPermission: () => Promise<boolean>;
  onOpenSettings: () => void;
  onStartPrep: () => void;
  onCancel: () => void;
}) {
  const colors = useThinkfyColors();
  const hasPermission = permissionState === "granted";

  return (
    <>
      <Surface tone={hasPermission ? "success" : "primary"}>
        <View style={styles.centerStack}>
          <IconBadge
            color={hasPermission ? colors.secondary : colors.primary}
            name={hasPermission ? "checkmark.circle" : "mic"}
            size={54}
          />
          <AppText style={styles.centerText} variant="heading">
            {hasPermission ? "Microphone ready" : "Allow microphone access"}
          </AppText>
          <AppText color={colors.muted} style={styles.centerText} variant="body">
            Thinkfy records one local m4a practice file in Phase 5. Upload and
            transcription start in the next phases.
          </AppText>
        </View>
      </Surface>

      <Surface>
        <SectionHeader title="Permission state" />
        <View style={styles.badgeRow}>
          <Badge tone={hasPermission ? "success" : "warning"}>
            {permissionState}
          </Badge>
          <Badge tone="neutral">local recording only</Badge>
        </View>
        {hasPermission ? (
          <AppButton onPress={onStartPrep}>Start prep timer</AppButton>
        ) : (
          <AppButton onPress={() => void onRequestPermission()}>
            Enable microphone
          </AppButton>
        )}
        {permissionState === "denied" ? (
          <AppButton onPress={onOpenSettings} variant="secondary">
            Open iOS settings
          </AppButton>
        ) : null}
        <AppButton onPress={onCancel} variant="ghost">
          Back to setup
        </AppButton>
      </Surface>
    </>
  );
}

function PrepPanel({
  remaining,
  total,
  onSkip,
  onCancel,
}: {
  remaining: number;
  total: number;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const colors = useThinkfyColors();
  const progress = total > 0 ? 1 - remaining / total : 1;

  return (
    <>
      <Surface tone="primary">
        <View style={styles.timerHero}>
          <AppText color={colors.primary} style={styles.timerText}>
            {formatClock(remaining)}
          </AppText>
          <ProgressBar value={progress} />
          <AppText color={colors.muted} style={styles.centerText} variant="body">
            Prepare claim, reason, evidence, impact, and one rebuttal path.
          </AppText>
        </View>
      </Surface>

      <Surface>
        <SectionHeader title="Prep checklist" />
        {["Claim", "Evidence", "Impact", "Likely rebuttal"].map((item) => (
          <View key={item} style={styles.checkRow}>
            <IconBadge name="checkmark" size={26} />
            <AppText variant="bodyStrong">{item}</AppText>
          </View>
        ))}
        <AppButton onPress={onSkip}>Skip to speaking</AppButton>
        <AppButton onPress={onCancel} variant="ghost">
          Cancel session
        </AppButton>
      </Surface>
    </>
  );
}

function SpeakingPanel({
  backgroundInterrupted,
  isPaused,
  isStopping,
  metering,
  remaining,
  total,
  onPause,
  onResume,
  onStop,
}: {
  backgroundInterrupted: boolean;
  isPaused: boolean;
  isStopping: boolean;
  metering?: number;
  remaining: number;
  total: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const colors = useThinkfyColors();
  const progress = total > 0 ? 1 - remaining / total : 1;

  return (
    <>
      {backgroundInterrupted ? (
        <Surface tone="warning">
          <AppText variant="bodyStrong">Recording paused in background</AppText>
          <AppText color={colors.muted} variant="caption">
            iOS paused capture when the app left the foreground. Resume when you
            are ready.
          </AppText>
        </Surface>
      ) : null}

      <Surface tone={isPaused ? "warning" : "primary"}>
        <View style={styles.timerHero}>
          <View style={styles.badgeRow}>
            <Badge tone={isPaused ? "warning" : "success"}>
              {isPaused ? "paused" : "recording"}
            </Badge>
            <Badge tone="neutral">m4a local file</Badge>
          </View>
          <AppText color={colors.primary} style={styles.timerText}>
            {formatClock(remaining)}
          </AppText>
          <ProgressBar value={progress} tone={isPaused ? "warning" : "primary"} />
          <WaveMeter metering={metering} />
        </View>
      </Surface>

      <View style={styles.controlRow}>
        <RoundControl
          label={isPaused ? "Resume" : "Pause"}
          onPress={isPaused ? onResume : onPause}
          tone={isPaused ? "success" : "warning"}
        />
        <RoundControl
          disabled={isStopping}
          label={isStopping ? "Saving" : "Finish"}
          onPress={onStop}
          tone="primary"
        />
      </View>
    </>
  );
}

function WaveMeter({ metering }: { metering?: number }) {
  const colors = useThinkfyColors();
  const level = typeof metering === "number" ? Math.max(0, Math.min(1, (metering + 60) / 60)) : 0.28;
  const bars = [0.4, 0.72, 0.56, 0.9, 0.64, 0.5, 0.78, 0.46];

  return (
    <View style={styles.waveRow}>
      {bars.map((bar, index) => (
        <View
          key={`${bar}-${index}`}
          style={[
            styles.waveBar,
            {
              backgroundColor: colors.primary,
              height: 18 + 42 * Math.max(0.18, Math.min(1, bar * level)),
            },
          ]}
        />
      ))}
    </View>
  );
}

function RoundControl({
  disabled = false,
  label,
  tone,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  tone: "primary" | "success" | "warning";
  onPress: () => void;
}) {
  const colors = useThinkfyColors();
  const background =
    tone === "success"
      ? colors.secondary
      : tone === "warning"
        ? colors.warning
        : colors.primary;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundControl,
        { backgroundColor: background },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <AppText color={colors.inverseText} variant="bodyStrong">
        {label}
      </AppText>
    </Pressable>
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
  timerHero: {
    gap: spacing.lg,
  },
  timerText: {
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 80,
    textAlign: "center",
  },
  checkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  controlRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  roundControl: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 56,
  },
  waveRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 72,
  },
  waveBar: {
    borderRadius: 8,
    width: 11,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
});
