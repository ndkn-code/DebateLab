import {
  ThinkfyApiError,
  createThinkfyApiClient,
} from "@thinkfy/shared/api-client";
import type {
  MobilePracticeHistoryResponse,
  MobilePracticeHistoryRow,
} from "@thinkfy/shared/practice-analysis";
import { Redirect, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
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
import { trackMobileHistoryEvent } from "@/lib/mobile-analytics";

type HistoryStatus =
  | { state: "loading" }
  | { state: "ready"; items: MobilePracticeHistoryRow[]; nextCursor: string | null }
  | { state: "signed-out" }
  | { state: "error"; message: string };

const previewHistory: MobilePracticeHistoryRow[] = [
  {
    id: "preview-session-1",
    topicTitle: "Homework should be abolished in high schools",
    topicCategory: "Education & School Life",
    topicDifficulty: "beginner",
    practiceTrack: "debate",
    practiceLanguage: "en",
    side: "opposition",
    mode: "full",
    durationSeconds: 126,
    totalScore: 81,
    overallBand: "Proficient",
    summary: "Clear stance with a stronger impact comparison near the end.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "preview-session-2",
    topicTitle: "Students should be allowed to use AI tools for schoolwork",
    topicCategory: "Technology & Social Media",
    topicDifficulty: "advanced",
    practiceTrack: "speaking",
    practiceLanguage: "en",
    side: "proposition",
    mode: "quick",
    durationSeconds: 94,
    totalScore: 74,
    overallBand: "Competent",
    summary: "Good structure; add a concrete example earlier.",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function getScoreTone(
  band: string | null
): "success" | "warning" | "error" | "neutral" {
  if (band === "Expert" || band === "Proficient") return "success";
  if (band === "Competent" || band === "Developing") return "warning";
  if (band === "Novice") return "error";
  return "neutral";
}

export default function HistoryRoute() {
  const router = useRouter();
  const colors = useThinkfyColors();
  const { getAccessToken, isLoading, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<HistoryStatus>({ state: "loading" });
  const apiClient = useMemo(
    () =>
      mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({
            baseUrl: mobileEnv.apiBaseUrl,
            getAccessToken,
          })
        : null,
    [getAccessToken]
  );

  useEffect(() => {
    let isMounted = true;

    if (previewEnabled) {
      setStatus({ state: "ready", items: previewHistory, nextCursor: null });
      return () => {
        isMounted = false;
      };
    }

    if (isLoading) {
      setStatus({ state: "loading" });
      return () => {
        isMounted = false;
      };
    }

    if (!user) {
      setStatus({ state: "signed-out" });
      return () => {
        isMounted = false;
      };
    }

    if (!apiClient) {
      setStatus({
        state: "error",
        message: "Set EXPO_PUBLIC_API_BASE_URL to load history.",
      });
      return () => {
        isMounted = false;
      };
    }

    setStatus({ state: "loading" });
    apiClient
      .requestJson<MobilePracticeHistoryResponse>("/api/mobile/history")
      .then((response) => {
        if (!isMounted) return;
        setStatus({
          state: "ready",
          items: response.items,
          nextCursor: response.nextCursor,
        });
        trackMobileHistoryEvent(apiClient, "mobile_history_viewed", "/history", {
          itemCount: response.items.length,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        const message =
          error instanceof ThinkfyApiError
            ? `${error.status}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "History request failed.";
        setStatus({ state: "error", message });
      });

    return () => {
      isMounted = false;
    };
  }, [apiClient, isLoading, previewEnabled, reloadKey, user]);

  if (!user && !previewEnabled && !isLoading) {
    return <Redirect href="/" />;
  }

  return (
    <Screen
      eyebrow="History"
      subtitle="Review scores, transcripts, and next steps from completed reps."
      title="Practice history"
      testID="history-screen"
    >
      {status.state === "loading" ? (
        <StateBlock
          body="Loading your completed practice sessions."
          state="loading"
          title="Checking history"
        />
      ) : null}

      {status.state === "error" ? (
        <StateBlock
          actionLabel="Retry"
          body={status.message}
          onPress={() => setReloadKey((key) => key + 1)}
          state="error"
          title="History failed"
        />
      ) : null}

      {status.state === "ready" && status.items.length === 0 ? (
        <StateBlock
          actionLabel="Start practice"
          body="Completed feedback sessions will appear here."
          onPress={() => router.replace("/practice")}
          state="empty"
          title="No practice sessions yet"
        />
      ) : null}

      {status.state === "ready" && status.items.length > 0 ? (
        <>
          <SectionHeader
            action={`${status.items.length} sessions`}
            title="Recent feedback"
          />
          <View style={styles.stack}>
            {status.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/history/${item.id}` as Href)}
                style={({ pressed }) => [pressed ? styles.pressed : null]}
              >
                <Surface style={styles.historyCard}>
                  <View style={styles.historyRow}>
                    <View style={styles.flexCopy}>
                      <AppText variant="bodyStrong">{item.topicTitle}</AppText>
                      <AppText
                        color={colors.muted}
                        numberOfLines={2}
                        variant="caption"
                      >
                        {item.summary ?? item.topicCategory}
                      </AppText>
                      <View style={styles.badgeRow}>
                        <Badge tone="neutral">{item.practiceTrack}</Badge>
                        <Badge tone="neutral">
                          {formatDuration(item.durationSeconds)}
                        </Badge>
                        <Badge tone="neutral">{formatDate(item.createdAt)}</Badge>
                      </View>
                    </View>
                    <View style={styles.scoreStack}>
                      <AppText color={colors.primary} style={styles.scoreText}>
                        {item.totalScore ?? "--"}
                      </AppText>
                      <Badge tone={getScoreTone(item.overallBand)}>
                        {item.overallBand ?? "Unrated"}
                      </Badge>
                    </View>
                  </View>
                </Surface>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <AppButton onPress={() => router.push("/practice")}>
        Start another practice
      </AppButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  historyCard: {
    borderRadius: 8,
    padding: spacing.md,
  },
  historyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  flexCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  scoreStack: {
    alignItems: "center",
    gap: spacing.xs,
    width: 112,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.78,
  },
});
