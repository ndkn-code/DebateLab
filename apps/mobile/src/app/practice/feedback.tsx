import { Redirect, useRouter, type Href } from "expo-router";
import { useEffect, useMemo } from "react";
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
import { createThinkfyApiClient } from "@thinkfy/shared/api-client";
import type {
  DebateScore,
  PracticeRecordingArtifact,
  PracticeSessionConfig,
} from "@thinkfy/shared/practice";

function getBandTone(
  band: string | null | undefined,
): "success" | "warning" | "error" | "neutral" {
  if (band === "Expert" || band === "Proficient") return "success";
  if (band === "Competent" || band === "Developing") return "warning";
  if (band === "Novice") return "error";
  return "neutral";
}

function getCategoryRows(feedback: DebateScore) {
  return [
    {
      label: "Content",
      score: feedback.content.score,
      maxScore: 40,
      note: feedback.detailedFeedback.contentFeedback,
    },
    {
      label: "Structure",
      score: feedback.structure.score,
      maxScore: 25,
      note: feedback.detailedFeedback.structureFeedback,
    },
    {
      label: "Language",
      score: feedback.language.score,
      maxScore: 25,
      note: feedback.detailedFeedback.languageFeedback,
    },
    {
      label: "Persuasion",
      score: feedback.persuasion.score,
      maxScore: 10,
      note: feedback.detailedFeedback.persuasionFeedback,
    },
  ];
}

function createPreviewFeedbackSnapshot(): {
  config: PracticeSessionConfig;
  feedback: DebateScore;
  recording: PracticeRecordingArtifact;
  transcript: string;
  historyId: string;
} {
  const createdAt = new Date().toISOString();

  return {
    config: {
      topic: {
        id: "preview-topic-homework",
        title: "Homework should be abolished in high schools",
        category: "Education",
        difficulty: "intermediate",
        suggestedPoints: {
          proposition: [
            "Homework increases stress without always improving mastery.",
            "Targeted in-class practice gives faster feedback.",
          ],
          opposition: [
            "Practice outside class helps students retain material.",
            "Homework builds independent study habits.",
          ],
        },
      },
      side: "opposition",
      resolvedSide: "opposition",
      practiceTrack: "debate",
      practiceLanguage: "en",
      mode: "quick",
      prepTime: 60,
      speechTime: 120,
      aiDifficulty: "medium",
      createdAt,
    },
    feedback: {
      content: {
        score: 32,
        claimClarity: 8,
        evidenceSupport: 7,
        logicCoherence: 8,
        counterArgument: 8,
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
      strengths: [
        "You made the side easy to understand from the first sentence.",
        "Your evidence and reasoning stayed connected.",
      ],
      improvements: [
        "Add one concrete example before the final claim.",
        "Weigh your argument directly against the opposing side.",
      ],
      sampleArguments: [
        "A shorter homework model keeps practice while reducing repetitive busywork.",
      ],
      practiceTrack: "debate",
      practiceLanguage: "en",
      transcriptAnnotations: [
        {
          quote: "homework should become shorter and more targeted",
          tag: "weighing",
          severity: "strength",
          feedback: "This gives the judge a balanced position.",
          suggestion: "Now compare why this model beats the other side.",
        },
      ],
      debateVerdict: {
        winner: "user",
        confidence: 0.76,
        summary:
          "Your side wins on balance because it keeps practice while limiting harm.",
        decidingReasons: [
          "Clearer compromise",
          "Better student-wellbeing impact",
        ],
        nextMove:
          "Add a concrete classroom example to make the tradeoff vivid.",
      },
      clashLinks: [
        {
          id: "preview-clash-1",
          sourceRoundNumber: 1,
          sourceSpeaker: "ai",
          responseRoundNumber: 1,
          responseSpeaker: "user",
          sourceQuote: "Homework builds discipline.",
          responseQuote:
            "Shorter targeted homework can build discipline without overload.",
          outcome: "answered",
          judgeRead: "You answered the main discipline claim.",
          suggestion: "Add evidence that targeted practice performs better.",
          tag: "weighing",
        },
      ],
      detailedFeedback: {
        contentFeedback:
          "Strong claim clarity with room for one more concrete example.",
        structureFeedback:
          "The speech is easy to follow and lands the conclusion.",
        languageFeedback: "Clear phrasing and steady fluency.",
        persuasionFeedback:
          "Good balance; stronger comparative weighing would sharpen it.",
      },
    },
    recording: {
      recordingId: "preview-recording",
      uri: "file://preview.m4a",
      durationSeconds: 124,
      mimeType: "audio/mp4",
      fileExtension: ".m4a",
      byteSize: 920000,
      createdAt,
      localOnly: true,
    },
    transcript:
      "I believe homework should not be fully abolished, but it should become shorter and more targeted. Practice helps students remember class material, but too much homework can hurt sleep and reduce time for deeper learning.",
    historyId: "preview-session-1",
  };
}

export default function PracticeFeedbackRoute() {
  const colors = useThinkfyColors();
  const router = useRouter();
  const { getAccessToken, user } = useAuth();
  const previewEnabled = isDesignPreviewEnabled();
  const { clearSession, config, processing, recording } = usePracticeSession();
  const feedback = processing.analysis.feedback;
  const previewSnapshot = useMemo(() => createPreviewFeedbackSnapshot(), []);
  const displayFeedback =
    feedback ?? (previewEnabled ? previewSnapshot.feedback : null);
  const displayConfig =
    config ?? (previewEnabled ? previewSnapshot.config : null);
  const displayRecording =
    recording ?? (previewEnabled ? previewSnapshot.recording : null);
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
    if (!feedback) return;
    trackMobilePracticeEvent(
      apiClient,
      "mobile_practice_feedback_viewed",
      "/practice/feedback",
      {
        attemptId: processing.analysis.attemptId,
        legacySessionId: processing.analysis.legacySessionId,
        totalScore: feedback.totalScore,
      },
    );
  }, [
    apiClient,
    feedback,
    processing.analysis.attemptId,
    processing.analysis.legacySessionId,
  ]);

  if (!user && !previewEnabled) {
    return <Redirect href="/" />;
  }

  if (!displayFeedback || !displayConfig || !displayRecording) {
    return (
      <Screen
        eyebrow="Feedback"
        subtitle="Finish a practice transcript and request analysis first."
        title="No feedback yet"
      >
        <StateBlock
          actionLabel="Back to practice"
          body="Your feedback result will appear here after analysis completes."
          onPress={() => router.replace("/practice")}
          state="empty"
          title="Feedback not ready"
        />
      </Screen>
    );
  }

  const transcript =
    processing.transcription?.transcript ??
    (previewEnabled ? previewSnapshot.transcript : "");
  const annotations = displayFeedback.transcriptAnnotations ?? [];
  const historyId =
    processing.analysis.legacySessionId ??
    (previewEnabled ? previewSnapshot.historyId : null);

  const startFresh = async () => {
    await clearSession();
    router.replace("/practice");
  };

  return (
    <Screen
      eyebrow="Feedback"
      subtitle={displayConfig.topic.title}
      title="Feedback ready"
      testID="practice-feedback-screen"
    >
      <Surface tone="success">
        <View style={styles.scoreHero}>
          <View style={[styles.scoreCircle, { borderColor: colors.primary }]}>
            <AppText color={colors.primary} style={styles.scoreText}>
              {displayFeedback.totalScore}
            </AppText>
            <AppText color={colors.muted} variant="micro">
              /100
            </AppText>
          </View>
          <View style={styles.flexCopy}>
            <View style={styles.badgeRow}>
              <Badge tone={getBandTone(displayFeedback.overallBand)}>
                {displayFeedback.overallBand}
              </Badge>
              <Badge tone="neutral">{displayConfig.practiceTrack}</Badge>
              {processing.analysis.modelName ? (
                <Badge tone="neutral">{processing.analysis.modelName}</Badge>
              ) : null}
            </View>
            <AppText variant="heading">Nice work</AppText>
            <AppText color={colors.muted} variant="body">
              {displayFeedback.summary}
            </AppText>
          </View>
        </View>
      </Surface>

      <Surface>
        <SectionHeader title="Category scores" />
        {getCategoryRows(displayFeedback).map((row) => (
          <View key={row.label} style={styles.categoryRow}>
            <View style={styles.categoryHeader}>
              <AppText variant="bodyStrong">{row.label}</AppText>
              <AppText color={colors.primary} variant="bodyStrong">
                {row.score}/{row.maxScore}
              </AppText>
            </View>
            <ProgressBar value={row.score / row.maxScore} />
            <AppText color={colors.muted} variant="caption">
              {row.note}
            </AppText>
          </View>
        ))}
      </Surface>

      <FeedbackList
        title="Strengths"
        tone="success"
        items={displayFeedback.strengths}
      />
      <FeedbackList
        title="Next steps"
        tone="warning"
        items={displayFeedback.improvements}
      />

      {displayFeedback.debateVerdict ? (
        <Surface tone="primary">
          <SectionHeader title="Verdict" />
          <View style={styles.badgeRow}>
            <Badge>{displayFeedback.debateVerdict.winner}</Badge>
            <Badge tone="neutral">
              {Math.round(displayFeedback.debateVerdict.confidence * 100)}%
              confidence
            </Badge>
          </View>
          <AppText color={colors.muted} variant="body">
            {displayFeedback.debateVerdict.summary}
          </AppText>
          <AppText variant="bodyStrong">
            {displayFeedback.debateVerdict.nextMove}
          </AppText>
        </Surface>
      ) : null}

      {displayFeedback.clashLinks?.length ? (
        <Surface>
          <SectionHeader title="Clash map" />
          {displayFeedback.clashLinks.slice(0, 3).map((link) => (
            <View
              key={link.id}
              style={[styles.annotationCard, { borderTopColor: colors.outlineVariant }]}
            >
              <View style={styles.badgeRow}>
                <Badge tone="neutral">{link.outcome}</Badge>
                <Badge tone="neutral">{link.tag}</Badge>
              </View>
              <AppText variant="bodyStrong">{link.sourceQuote}</AppText>
              <AppText color={colors.muted} variant="caption">
                {link.judgeRead}
              </AppText>
              <AppText color={colors.primary} variant="caption">
                {link.suggestion}
              </AppText>
            </View>
          ))}
        </Surface>
      ) : null}

      <Surface>
        <SectionHeader title="Transcript coaching" />
        {annotations.length > 0 ? (
          annotations.slice(0, 5).map((annotation, index) => (
            <View
              key={`${annotation.quote}-${index}`}
              style={[styles.annotationCard, { borderTopColor: colors.outlineVariant }]}
            >
              <View style={styles.badgeRow}>
                <Badge
                  tone={
                    annotation.severity === "strength"
                      ? "success"
                      : annotation.severity === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {annotation.tag}
                </Badge>
                <Badge tone="neutral">{annotation.severity}</Badge>
              </View>
              <AppText variant="bodyStrong">{`"${annotation.quote}"`}</AppText>
              <AppText color={colors.muted} variant="caption">
                {annotation.feedback}
              </AppText>
              <AppText color={colors.primary} variant="caption">
                {annotation.suggestion}
              </AppText>
            </View>
          ))
        ) : (
          <AppText color={colors.muted} variant="body">
            {transcript}
          </AppText>
        )}
      </Surface>

      <View style={styles.actionRow}>
        {historyId ? (
          <AppButton
            onPress={() => router.push(`/history/${historyId}` as Href)}
            variant="secondary"
          >
            History detail
          </AppButton>
        ) : null}
        <AppButton onPress={startFresh}>Practice again</AppButton>
      </View>
    </Screen>
  );
}

function FeedbackList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  const colors = useThinkfyColors();

  return (
    <Surface tone={tone}>
      <SectionHeader title={title} />
      <View style={styles.listStack}>
        {items.slice(0, 4).map((item) => (
          <View key={item} style={styles.listRow}>
            <IconBadge
              color={tone === "success" ? colors.secondary : colors.warning}
              name={tone === "success" ? "checkmark" : "arrow.right"}
              size={25}
            />
            <AppText style={styles.flexCopy} variant="body">
              {item}
            </AppText>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  scoreHero: {
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
    width: 96,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36,
  },
  flexCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryRow: {
    gap: spacing.sm,
  },
  categoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  listStack: {
    gap: spacing.sm,
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  annotationCard: {
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  actionRow: {
    gap: spacing.sm,
  },
});
