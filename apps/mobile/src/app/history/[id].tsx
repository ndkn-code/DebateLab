import {
  ThinkfyApiError,
  createThinkfyApiClient,
} from "@thinkfy/shared/api-client";
import type {
  MobilePracticeHistoryDetail,
  MobilePracticeHistoryDetailResponse,
} from "@thinkfy/shared/practice-analysis";
import {
  Redirect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
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
import { trackMobileHistoryEvent } from "@/lib/mobile-analytics";

type DetailStatus =
  | { state: "loading" }
  | { state: "ready"; item: MobilePracticeHistoryDetail }
  | { state: "signed-out" }
  | { state: "error"; message: string };

function getFeedbackScoreRows(
  feedback: NonNullable<MobilePracticeHistoryDetail["feedback"]>,
) {
  return [
    { label: "Content", score: feedback.content.score, maxScore: 40 },
    { label: "Structure", score: feedback.structure.score, maxScore: 25 },
    { label: "Language", score: feedback.language.score, maxScore: 25 },
    { label: "Persuasion", score: feedback.persuasion.score, maxScore: 10 },
  ];
}

function createPreviewDetail(id: string): MobilePracticeHistoryDetail {
  return {
    id,
    topicTitle: "Homework should be abolished in high schools",
    topicCategory: "Education & School Life",
    topicDifficulty: "beginner",
    practiceTrack: "debate",
    practiceLanguage: "en",
    side: "opposition",
    mode: "full",
    prepTime: 180,
    speechTime: 180,
    durationSeconds: 126,
    transcript:
      "I believe homework should not be fully abolished, but it should become shorter and more targeted. Practice helps students remember class material, but too much homework replaces rest and activities.",
    totalScore: 81,
    overallBand: "Proficient",
    summary:
      "Clear stance and helpful balance. Add one stronger comparison against the other side.",
    modelName: "preview-model",
    aiDifficulty: "medium",
    rounds: null,
    createdAt: new Date().toISOString(),
    feedback: {
      content: {
        score: 32,
        claimClarity: 8,
        evidenceSupport: 7,
        logicCoherence: 8,
        counterArgument: 7,
      },
      structure: {
        score: 20,
        introduction: 8,
        bodyOrganization: 8,
        conclusion: 7,
      },
      language: {
        score: 21,
        vocabulary: 8,
        grammar: 8,
        fluency: 8,
      },
      persuasion: {
        score: 8,
        audienceAwareness: 8,
        impactfulness: 8,
      },
      totalScore: 81,
      overallBand: "Proficient",
      summary:
        "Clear stance and helpful balance. Add one stronger comparison against the other side.",
      strengths: ["Balanced framing", "Clear claim", "Good pacing"],
      improvements: ["Add concrete evidence", "Weigh your impact earlier"],
      sampleArguments: [
        "Targeted homework gives students practice without taking away rest, clubs, and family time.",
      ],
      practiceTrack: "debate",
      practiceLanguage: "en",
      detailedFeedback: {
        contentFeedback: "The claim is clear; evidence can be more concrete.",
        structureFeedback: "The flow is easy to follow.",
        languageFeedback: "The language is natural and precise.",
        persuasionFeedback: "The impact is persuasive but needs comparison.",
      },
      transcriptAnnotations: [
        {
          quote: "shorter and more targeted",
          tag: "clarity",
          severity: "strength",
          feedback: "This makes your position nuanced.",
          suggestion: "Open with this phrase earlier.",
        },
      ],
    },
  };
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default function HistoryDetailRoute() {
  const colors = useThinkfyColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { getAccessToken, isLoading, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<DetailStatus>({ state: "loading" });
  const apiClient = useMemo(
    () =>
      mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({
            baseUrl: mobileEnv.apiBaseUrl,
            getAccessToken,
          })
        : null,
    [getAccessToken],
  );

  useEffect(() => {
    let isMounted = true;
    if (!id) {
      setStatus({ state: "error", message: "Missing history id." });
      return () => {
        isMounted = false;
      };
    }

    if (previewEnabled) {
      setStatus({ state: "ready", item: createPreviewDetail(id) });
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
        message: "Set EXPO_PUBLIC_API_BASE_URL to load history detail.",
      });
      return () => {
        isMounted = false;
      };
    }

    setStatus({ state: "loading" });
    apiClient
      .requestJson<MobilePracticeHistoryDetailResponse>(
        `/api/mobile/history/${id}`,
      )
      .then((response) => {
        if (!isMounted) return;
        setStatus({ state: "ready", item: response.item });
        trackMobileHistoryEvent(
          apiClient,
          "mobile_history_detail_viewed",
          `/history/${id}`,
          {
            sessionId: id,
            totalScore: response.item.totalScore,
          },
        );
      })
      .catch((error) => {
        if (!isMounted) return;
        const message =
          error instanceof ThinkfyApiError
            ? `${error.status}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "History detail request failed.";
        setStatus({ state: "error", message });
      });

    return () => {
      isMounted = false;
    };
  }, [apiClient, id, isLoading, previewEnabled, reloadKey, user]);

  if (!user && !previewEnabled && !isLoading) {
    return <Redirect href="/" />;
  }

  if (status.state === "loading") {
    return (
      <Screen title="Session details">
        <StateBlock
          body="Loading transcript and feedback."
          state="loading"
          title="Checking session"
        />
      </Screen>
    );
  }

  if (status.state === "error") {
    return (
      <Screen title="Session details">
        <StateBlock
          actionLabel="Retry"
          body={status.message}
          onPress={() => setReloadKey((key) => key + 1)}
          state="error"
          title="Could not load session"
        />
      </Screen>
    );
  }

  if (status.state !== "ready") {
    return null;
  }

  const item = status.item;
  const feedback = item.feedback;
  const annotations = feedback?.transcriptAnnotations ?? [];

  return (
    <Screen
      eyebrow="History"
      subtitle={`${item.practiceTrack} • ${formatDuration(item.durationSeconds)}`}
      title={item.topicTitle}
      testID="history-detail-screen"
    >
      <Surface tone="success">
        <View style={styles.scoreRow}>
          <View style={[styles.scoreCircle, { borderColor: colors.primary }]}>
            <AppText color={colors.primary} style={styles.scoreText}>
              {item.totalScore ?? "--"}
            </AppText>
          </View>
          <View style={styles.flexCopy}>
            <View style={styles.badgeRow}>
              <Badge>{item.overallBand ?? "Unrated"}</Badge>
              <Badge tone="neutral">{item.side}</Badge>
              <Badge tone="neutral">{item.practiceLanguage}</Badge>
            </View>
            <AppText color={colors.muted} variant="body">
              {item.summary ?? feedback?.summary ?? "Feedback detail saved."}
            </AppText>
          </View>
        </View>
      </Surface>

      {feedback ? (
        <Surface>
          <SectionHeader title="Score breakdown" />
          {getFeedbackScoreRows(feedback).map(({ label, score, maxScore }) => (
            <View key={label} style={styles.metricRow}>
              <View style={styles.metricHeader}>
                <AppText variant="bodyStrong">{label}</AppText>
                <AppText color={colors.primary} variant="bodyStrong">
                  {score}/{maxScore}
                </AppText>
              </View>
              <ProgressBar value={score / maxScore} />
            </View>
          ))}
        </Surface>
      ) : null}

      {feedback?.debateVerdict ? (
        <Surface tone="primary">
          <SectionHeader title="Verdict" />
          <AppText variant="bodyStrong">
            {feedback.debateVerdict.winner}
          </AppText>
          <AppText color={colors.muted} variant="body">
            {feedback.debateVerdict.summary}
          </AppText>
        </Surface>
      ) : null}

      {feedback?.clashLinks?.length ? (
        <Surface>
          <SectionHeader title="Clash map" />
          {feedback.clashLinks.slice(0, 4).map((link) => (
            <View key={link.id} style={[styles.cardBlock, { borderTopColor: colors.outlineVariant }]}>
              <View style={styles.badgeRow}>
                <Badge tone="neutral">{link.outcome}</Badge>
                <Badge tone="neutral">{link.tag}</Badge>
              </View>
              <AppText variant="bodyStrong">{link.sourceQuote}</AppText>
              <AppText color={colors.muted} variant="caption">
                {link.suggestion}
              </AppText>
            </View>
          ))}
        </Surface>
      ) : null}

      <Surface>
        <SectionHeader title="Transcript" />
        <AppText color={colors.muted} style={styles.transcript} variant="body">
          {item.transcript}
        </AppText>
      </Surface>

      {annotations.length > 0 ? (
        <Surface>
          <SectionHeader title="Transcript coaching" />
          {annotations.slice(0, 5).map((annotation, index) => (
            <View
              key={`${annotation.quote}-${index}`}
              style={[styles.cardBlock, { borderTopColor: colors.outlineVariant }]}
            >
              <View style={styles.badgeRow}>
                <Badge tone="neutral">{annotation.tag}</Badge>
                <Badge
                  tone={
                    annotation.severity === "strength"
                      ? "success"
                      : annotation.severity === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {annotation.severity}
                </Badge>
              </View>
              <AppText variant="bodyStrong">{`"${annotation.quote}"`}</AppText>
              <AppText color={colors.muted} variant="caption">
                {annotation.feedback}
              </AppText>
            </View>
          ))}
        </Surface>
      ) : null}

      <View style={styles.actionRow}>
        <AppButton
          onPress={() =>
            router.push(
              `/coach?context=practice-feedback&contextId=${item.id}` as Href,
            )
          }
          variant="secondary"
        >
          Ask Coach
        </AppButton>
        <AppButton onPress={() => router.push("/practice" as Href)}>
          Practice again
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  scoreCircle: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 8,
    justifyContent: "center",
    width: 84,
  },
  scoreText: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
  },
  flexCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricRow: {
    gap: spacing.sm,
  },
  metricHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardBlock: {
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  transcript: {
    lineHeight: 22,
  },
  actionRow: {
    gap: spacing.sm,
  },
});
