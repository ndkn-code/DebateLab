import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  ThinkfyApiError,
  createThinkfyApiClient,
} from "@thinkfy/shared/api-client";
import type {
  CoachMessageMetadata,
  CoachResponseBlock,
  CoachSuggestedAction,
  MobileCoachConversationResponse,
  MobileCoachConversationSummary,
  MobileCoachHomeResponse,
  MobileCoachMessage,
  MobileCoachSendMessageResponse,
} from "@thinkfy/shared/coach";

import {
  AppButton,
  AppText,
  Badge,
  GlassSurface,
  IconBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { radius, spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import {
  createPreviewCoachReply,
  previewCoachConversation,
  previewCoachHome,
} from "@/lib/coach-preview";
import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";
import { trackMobileCoachEvent } from "@/lib/mobile-analytics";

const LAST_COACH_CONVERSATION_KEY = "thinkfy.mobile.coach.last-conversation.v1";

type CoachStatus =
  | { state: "loading" }
  | { state: "ready"; isPreview: boolean }
  | { state: "signed-out" }
  | { state: "error"; message: string };

function formatError(error: unknown) {
  if (error instanceof ThinkfyApiError) {
    return error.status > 0
      ? `${error.status}: ${error.message}`
      : error.message;
  }

  return error instanceof Error ? error.message : "Coach request failed.";
}

function bestSkillLabel(value: string | null) {
  if (!value) return "Not enough data";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mergeConversation(
  conversations: MobileCoachConversationSummary[],
  conversation: MobileCoachConversationSummary,
) {
  return [
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id),
  ];
}

function CoachMetricRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const colors = useThinkfyColors();
  const normalized = value == null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabel}>
        <AppText variant="caption">{label}</AppText>
        <AppText color={colors.muted} variant="caption">
          {value == null ? "No score yet" : `${Math.round(value)}/100`}
        </AppText>
      </View>
      <ProgressBar value={normalized / 100} />
    </View>
  );
}

function PromptChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useThinkfyColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.promptChip,
        {
          backgroundColor: colors.primaryContainer,
          borderColor: colors.outlineVariant,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <AppText color={colors.primaryDim} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function ConversationButton({
  conversation,
  isActive,
  onPress,
}: {
  conversation: MobileCoachConversationSummary;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors = useThinkfyColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationButton,
        {
          backgroundColor: isActive ? colors.primaryContainer : colors.surface,
          borderColor: isActive ? colors.primaryFixed : colors.outlineVariant,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.conversationIcon}>
        <IconBadge
          backgroundColor={isActive ? colors.surface : colors.surfaceDim}
          name="bubble.left.and.bubble.right"
          size={32}
        />
      </View>
      <View style={styles.conversationCopy}>
        <AppText numberOfLines={1} variant="bodyStrong">
          {conversation.title}
        </AppText>
        <AppText color={colors.muted} numberOfLines={2} variant="caption">
          {conversation.preview ?? "Open this coach thread"}
        </AppText>
      </View>
    </Pressable>
  );
}

function MetadataBlock({
  block,
  onPrompt,
}: {
  block: CoachResponseBlock;
  onPrompt: (prompt: string) => void;
}) {
  const colors = useThinkfyColors();

  return (
    <View
      style={[
        styles.metadataBlock,
        {
          backgroundColor: colors.surfaceDim,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.metadataHeader}>
        <Badge tone={block.type === "drill" ? "warning" : "neutral"}>
          {block.type.replace(/_/g, " ")}
        </Badge>
      </View>
      <AppText variant="bodyStrong">{block.title}</AppText>
      {block.body ? (
        <AppText color={colors.muted} variant="caption">
          {block.body}
        </AppText>
      ) : null}
      {block.items?.length ? (
        <View style={styles.blockItems}>
          {block.items.slice(0, 4).map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View
                style={[styles.bullet, { backgroundColor: colors.primary }]}
              />
              <AppText color={colors.muted} style={styles.bulletCopy} variant="caption">
                {item}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {block.prompt ? (
        <AppButton onPress={() => onPrompt(block.prompt ?? "")} variant="ghost">
          Use prompt
        </AppButton>
      ) : null}
    </View>
  );
}

function SuggestedActions({
  actions,
  onAction,
}: {
  actions: CoachSuggestedAction[];
  onAction: (action: CoachSuggestedAction) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.suggestedActions}>
      {actions.slice(0, 3).map((action) => (
        <PromptChip
          key={`${action.label}:${action.prompt}`}
          label={action.label}
          onPress={() => onAction(action)}
        />
      ))}
    </View>
  );
}

function CoachMessageBubble({
  message,
  onPrompt,
  onSuggestedAction,
}: {
  message: MobileCoachMessage;
  onPrompt: (prompt: string) => void;
  onSuggestedAction: (action: CoachSuggestedAction) => void;
}) {
  const colors = useThinkfyColors();
  const isUser = message.role === "user";
  const metadata: CoachMessageMetadata | null = message.metadata;

  return (
    <View
      style={[
        styles.messageWrap,
        isUser ? styles.userMessageWrap : styles.assistantMessageWrap,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderColor: isUser ? colors.primary : colors.outlineVariant,
          },
        ]}
      >
        <AppText
          color={isUser ? colors.inverseText : colors.foreground}
          variant="body"
        >
          {message.content}
        </AppText>
        {!isUser && metadata?.blocks?.length ? (
          <View style={styles.metadataStack}>
            {metadata.blocks.slice(0, 3).map((block) => (
              <MetadataBlock
                block={block}
                key={block.id}
                onPrompt={onPrompt}
              />
            ))}
          </View>
        ) : null}
        {!isUser ? (
          <SuggestedActions
            actions={metadata?.suggestedActions ?? []}
            onAction={onSuggestedAction}
          />
        ) : null}
      </View>
    </View>
  );
}

export function CoachScreen() {
  const colors = useThinkfyColors();
  const { getAccessToken, isLoading, user } = useAuth();
  const isPreview = isDesignPreviewEnabled();
  const [status, setStatus] = useState<CoachStatus>({ state: "loading" });
  const [home, setHome] = useState<MobileCoachHomeResponse | null>(null);
  const [activeConversation, setActiveConversation] =
    useState<MobileCoachConversationSummary | null>(null);
  const [messages, setMessages] = useState<MobileCoachMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isOpeningConversation, setIsOpeningConversation] = useState(false);
  const viewedRef = useRef(false);

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

  const loadConversation = useCallback(
    async (conversationId: string, options: { track?: boolean } = {}) => {
      setIsOpeningConversation(true);
      setSendError(null);

      try {
        let response: MobileCoachConversationResponse;
        if (isPreview) {
          response = {
            ...previewCoachConversation,
            conversation: {
              ...previewCoachConversation.conversation,
              id: conversationId,
            },
            messages: previewCoachConversation.messages.map((message) => ({
              ...message,
              conversationId,
            })),
          };
        } else {
          if (!apiClient) {
            throw new Error("Set EXPO_PUBLIC_API_BASE_URL to load Coach.");
          }
          response = await apiClient.requestJson<MobileCoachConversationResponse>(
            `/api/mobile/coach/conversations/${conversationId}`,
          );
        }

        setActiveConversation(response.conversation);
        setMessages(response.messages);
        await SecureStore.setItemAsync(
          LAST_COACH_CONVERSATION_KEY,
          response.conversation.id,
        ).catch(() => null);

        if (options.track !== false && !isPreview) {
          trackMobileCoachEvent(apiClient, "mobile_coach_conversation_opened", {
            conversationId: response.conversation.id,
          });
        }
      } catch (error) {
        setSendError(formatError(error));
      } finally {
        setIsOpeningConversation(false);
      }
    },
    [apiClient, isPreview],
  );

  const loadHome = useCallback(async () => {
    if (isPreview) {
      setHome(previewCoachHome);
      setActiveConversation(previewCoachConversation.conversation);
      setMessages(previewCoachConversation.messages);
      setStatus({ state: "ready", isPreview: true });
      return;
    }

    if (isLoading) {
      setStatus({ state: "loading" });
      return;
    }

    if (!user) {
      setStatus({ state: "signed-out" });
      return;
    }

    if (!apiClient) {
      setStatus({
        state: "error",
        message: "Set EXPO_PUBLIC_API_BASE_URL to load Coach.",
      });
      return;
    }

    setStatus({ state: "loading" });
    setSendError(null);

    try {
      const response =
        await apiClient.requestJson<MobileCoachHomeResponse>("/api/mobile/coach");
      setHome(response);
      setStatus({ state: "ready", isPreview: false });

      if (!viewedRef.current) {
        viewedRef.current = true;
        trackMobileCoachEvent(apiClient, "mobile_coach_viewed", {
          conversations: response.conversations.length,
          strongestSkill: response.profile.skillSnapshot.strongestSkill,
          weakestSkill: response.profile.skillSnapshot.weakestSkill,
        });
      }

      const lastConversationId = await SecureStore.getItemAsync(
        LAST_COACH_CONVERSATION_KEY,
      ).catch(() => null);
      const remembered = response.conversations.find(
        (conversation) => conversation.id === lastConversationId,
      );

      if (remembered) {
        await loadConversation(remembered.id, { track: false });
      } else {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (error) {
      setStatus({ state: "error", message: formatError(error) });
    }
  }, [apiClient, isLoading, isPreview, loadConversation, user]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const sendMessage = useCallback(
    async (overrideMessage?: string) => {
      const trimmed = (overrideMessage ?? composer).trim();
      if (!trimmed || isSending) return;

      setComposer("");
      setSendError(null);
      setIsSending(true);

      const previousMessages = messages;
      const conversationId = activeConversation?.id ?? undefined;

      try {
        if (!isPreview) {
          trackMobileCoachEvent(apiClient, "mobile_coach_message_sent", {
            conversationId: conversationId ?? null,
            messageLength: trimmed.length,
          });
        }

        const response = isPreview
          ? createPreviewCoachReply(trimmed, conversationId)
          : await apiClient!.requestJson<MobileCoachSendMessageResponse>(
              "/api/mobile/coach/messages",
              {
                method: "POST",
                body: JSON.stringify({
                  context: "coach-home",
                  conversationId,
                  message: trimmed,
                  practiceLanguage: "en",
                }),
                timeoutMs: 75_000,
              },
            );

        setActiveConversation(response.conversation);
        setMessages([
          ...previousMessages,
          response.userMessage,
          response.assistantMessage,
        ]);
        setHome((current) =>
          current
            ? {
                ...current,
                envelope: response.envelope,
                conversations: mergeConversation(
                  current.conversations,
                  response.conversation,
                ),
              }
            : current,
        );
        await SecureStore.setItemAsync(
          LAST_COACH_CONVERSATION_KEY,
          response.conversation.id,
        ).catch(() => null);

        if (!isPreview) {
          trackMobileCoachEvent(apiClient, "mobile_coach_response_received", {
            conversationId: response.conversation.id,
            finishReason: response.finishReason,
          });
        }
      } catch (error) {
        const message = formatError(error);
        setComposer(trimmed);
        setSendError(message);
        if (!isPreview) {
          trackMobileCoachEvent(apiClient, "mobile_coach_response_failed", {
            conversationId: conversationId ?? null,
            error: message,
          });
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      activeConversation?.id,
      apiClient,
      composer,
      isPreview,
      isSending,
      messages,
    ],
  );

  const handlePrompt = useCallback(
    (prompt: string) => {
      setComposer(prompt);
    },
    [],
  );

  const handleSuggestedAction = useCallback(
    (action: CoachSuggestedAction) => {
      if (!isPreview) {
        trackMobileCoachEvent(apiClient, "mobile_coach_suggested_action_tapped", {
          label: action.label,
        });
      }
      void sendMessage(action.prompt);
    },
    [apiClient, isPreview, sendMessage],
  );

  const startNewConversation = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
    setSendError(null);
    void SecureStore.deleteItemAsync(LAST_COACH_CONVERSATION_KEY).catch(
      () => null,
    );
  }, []);

  if (status.state === "loading") {
    return (
      <Screen
        eyebrow="Coach"
        subtitle="Loading your profile, recent practice, and coach context."
        title="AI Coach"
        testID="coach-screen"
      >
        <StateBlock
          body="Pulling your latest progress and conversations."
          state="loading"
          title="Getting Coach ready"
        />
      </Screen>
    );
  }

  if (status.state === "signed-out") {
    return (
      <Screen
        eyebrow="Coach"
        subtitle="Sign in to load personalized coaching and saved conversations."
        title="AI Coach"
        testID="coach-screen"
      >
        <StateBlock
          body="Coach uses your practice history, profile, and feedback to make advice specific."
          state="empty"
          title="Sign in to continue"
        />
      </Screen>
    );
  }

  if (status.state === "error" || !home) {
    return (
      <Screen
        eyebrow="Coach"
        subtitle="Coach is temporarily unavailable."
        title="AI Coach"
        testID="coach-screen"
      >
        <StateBlock
          actionLabel="Retry"
          body={status.state === "error" ? status.message : "Missing coach data."}
          onPress={() => void loadHome()}
          state="error"
          title="Coach could not load"
        />
      </Screen>
    );
  }

  const topMetric = home.profile.skillSnapshot.metrics[0];
  const starterPrompts = [
    ...home.envelope.starterPrompts,
    ...home.profile.starterPrompts,
  ].slice(0, 4);

  return (
    <Screen
      eyebrow="Coach"
      subtitle={home.envelope.focusSummary}
      title="AI Coach"
      testID="coach-screen"
    >
      <GlassSurface>
        <View style={styles.coachHeader}>
          <IconBadge name="brain.head.profile" size={46} />
          <View style={styles.headerCopy}>
            <AppText variant="heading">{home.envelope.focusTitle}</AppText>
            <AppText color={colors.muted} variant="caption">
              {home.profile.brief.nextMove}
            </AppText>
          </View>
          <Badge tone={status.isPreview ? "warning" : "success"}>
            {status.isPreview ? "Preview" : "Live"}
          </Badge>
        </View>

        <View style={styles.statGrid}>
          <Surface style={styles.statTile} tone="soft">
            <AppText color={colors.muted} variant="micro">
              Streak
            </AppText>
            <AppText variant="heading">{home.profile.streak} days</AppText>
          </Surface>
          <Surface style={styles.statTile} tone="soft">
            <AppText color={colors.muted} variant="micro">
              Level
            </AppText>
            <AppText variant="heading">{home.profile.level}</AppText>
          </Surface>
          <Surface style={styles.statTile} tone="soft">
            <AppText color={colors.muted} variant="micro">
              Focus
            </AppText>
            <AppText numberOfLines={1} variant="bodyStrong">
              {bestSkillLabel(home.profile.skillSnapshot.weakestSkill)}
            </AppText>
          </Surface>
        </View>

        <CoachMetricRow
          label={topMetric ? bestSkillLabel(topMetric.key) : "Overall"}
          value={topMetric?.value ?? home.profile.skillSnapshot.overallScore}
        />
      </GlassSurface>

      <SectionHeader title="Starter prompts" />
      <View style={styles.promptWrap}>
        {starterPrompts.map((prompt) => (
          <PromptChip key={prompt} label={prompt} onPress={() => handlePrompt(prompt)} />
        ))}
      </View>

      <SectionHeader action="Saved" title="Conversations" />
      <View style={styles.conversationList}>
        <Pressable
          accessibilityRole="button"
          onPress={startNewConversation}
          style={({ pressed }) => [
            styles.newConversationButton,
            {
              backgroundColor: colors.surfaceDim,
              borderColor: colors.outlineVariant,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <IconBadge name="plus.message" size={32} />
          <AppText variant="caption">New chat</AppText>
        </Pressable>
        {home.conversations.map((conversation) => (
          <ConversationButton
            conversation={conversation}
            isActive={conversation.id === activeConversation?.id}
            key={conversation.id}
            onPress={() => void loadConversation(conversation.id)}
          />
        ))}
      </View>

      <SectionHeader
        action={activeConversation ? "Active" : "Ask anything"}
        title={activeConversation?.title ?? "Current chat"}
      />
      <Surface style={styles.chatSurface}>
        {isOpeningConversation ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.primary} />
            <AppText color={colors.muted} variant="caption">
              Opening conversation...
            </AppText>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <IconBadge name="sparkles" size={42} />
            <AppText style={styles.centerText} variant="bodyStrong">
              Start with a recent goal or feedback question.
            </AppText>
            <AppText color={colors.muted} style={styles.centerText} variant="caption">
              Coach will use your profile and practice history when available.
            </AppText>
          </View>
        ) : (
          <View style={styles.messageStack}>
            {messages.map((message) => (
              <CoachMessageBubble
                key={message.id}
                message={message}
                onPrompt={handlePrompt}
                onSuggestedAction={handleSuggestedAction}
              />
            ))}
          </View>
        )}

        {sendError ? (
          <Surface style={styles.sendError} tone="error">
            <AppText color={colors.errorDim} variant="caption">
              {sendError}
            </AppText>
            <AppButton onPress={() => void sendMessage()} variant="destructive">
              Retry send
            </AppButton>
          </Surface>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setComposer}
            placeholder="Ask Coach for a drill, rewrite, or next move"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceDim,
                borderColor: colors.outlineVariant,
                color: colors.foreground,
              },
            ]}
            value={composer}
          />
          <AppButton
            disabled={!composer.trim()}
            isLoading={isSending}
            onPress={() => void sendMessage()}
            style={styles.sendButton}
          >
            Send
          </AppButton>
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  coachHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  statGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    gap: spacing.xs,
    minHeight: 86,
    padding: spacing.md,
  },
  metricRow: {
    gap: spacing.sm,
  },
  metricLabel: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  promptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  promptChip: {
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  conversationList: {
    gap: spacing.sm,
  },
  newConversationButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  conversationButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  conversationIcon: {
    alignSelf: "flex-start",
  },
  conversationCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  chatSurface: {
    gap: spacing.lg,
  },
  inlineLoading: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyChat: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  messageStack: {
    gap: spacing.md,
  },
  messageWrap: {
    flexDirection: "row",
  },
  userMessageWrap: {
    justifyContent: "flex-end",
  },
  assistantMessageWrap: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: "92%",
    padding: spacing.md,
  },
  metadataStack: {
    gap: spacing.sm,
  },
  metadataBlock: {
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  metadataHeader: {
    flexDirection: "row",
  },
  blockItems: {
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  bullet: {
    borderRadius: radius.round,
    height: 6,
    marginTop: 6,
    width: 6,
  },
  bulletCopy: {
    flex: 1,
  },
  suggestedActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sendError: {
    gap: spacing.sm,
  },
  composer: {
    gap: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    minHeight: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
  },
  sendButton: {
    minHeight: 50,
  },
  centerText: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ translateY: 1 }],
  },
});
