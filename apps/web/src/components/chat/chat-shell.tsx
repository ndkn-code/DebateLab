"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatArea } from "./chat-area";
import { PageTransition } from "@/components/shared/page-motion";
import { coercePracticeLanguage } from "@/lib/practice-language";
import type { ConversationWithPreview } from "@/lib/api/chat";
import type { ChatMessage } from "@/types/database";
import type { CoachContextEnvelope, CoachMessageMetadata, CoachProfile } from "@/types";

export interface ChatMessageLocal {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: CoachMessageMetadata | null;
  status?: "streaming" | "complete" | "error";
  finalRenderMode?: "structured" | "markdown";
  finishReason?: string | null;
  isTruncated?: boolean;
  created_at: string;
}

const STREAM_REVEAL_INTERVAL_MS = 24;
const STREAM_REVEAL_CHAR_BUDGET = 3;

function splitStreamingText(text: string) {
  return Array.from(text);
}

interface ChatShellProps {
  conversations: ConversationWithPreview[];
  initialMessage?: string;
  initialConversationId?: string;
  context?: string;
  contextId?: string;
  initialCoachProfile: CoachProfile;
  initialCoachEnvelope: CoachContextEnvelope;
}

export function ChatShell({
  conversations: initialConversations,
  initialMessage,
  initialConversationId,
  context,
  contextId,
  initialCoachEnvelope,
}: ChatShellProps) {
  const t = useTranslations("dashboard.chat");
  const locale = useLocale();
  const practiceLanguage = coercePracticeLanguage(locale);
  const initialContextType = context ?? "coach-home";
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const [activeContextType, setActiveContextType] = useState(initialContextType);
  const [activeContextId, setActiveContextId] = useState<string | null>(
    contextId ?? null
  );
  const [messages, setMessages] = useState<ChatMessageLocal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const [coachEnvelope, setCoachEnvelope] = useState(initialCoachEnvelope);
  const [visualizingMessageId, setVisualizingMessageId] = useState<string | null>(
    null
  );
  const autoVisualizedMessageIdsRef = useRef<Set<string>>(new Set());

  const refreshCoachView = useCallback(
    async ({
      nextContextType,
      nextContextId,
      nextMessage,
    }: {
      nextContextType?: string | null;
      nextContextId?: string | null;
      nextMessage?: string;
    }) => {
      setIsInsightsLoading(true);

      try {
        const params = new URLSearchParams();
        const resolvedContextType = nextContextType ?? "coach-home";
        params.set("contextType", resolvedContextType);
        if (nextContextId) {
          params.set("contextId", nextContextId);
        }
        if (nextMessage) {
          params.set("message", nextMessage);
        }
        params.set("practiceLanguage", practiceLanguage);

        const coachProfileUrl = `/api/chat/coach-profile?${params.toString()}`;
        const res = await fetch(coachProfileUrl);
        if (!res.ok) {
          throw new Error("Failed to load coach profile");
        }

        const data = (await res.json()) as {
          envelope: CoachContextEnvelope;
        };
        setCoachEnvelope(data.envelope);
      } catch {
        // Keep current coach view on failure
      } finally {
        setIsInsightsLoading(false);
      }
    },
    [practiceLanguage]
  );

  // Load messages when switching conversations
  const loadConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setIsLoading(true);
    setLoadError(false);
    setSidebarOpen(false);

    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}`
      );
      if (!res.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await res.json();
      setMessages(
        data.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          metadata: m.metadata,
          status: "complete",
          finalRenderMode: "markdown",
          finishReason: null,
          isTruncated: false,
          created_at: m.created_at,
        }))
      );

      const nextContextType = data.conversation.context_type ?? "coach-home";
      const nextContextId = data.conversation.context_id ?? null;
      setActiveContextType(nextContextType);
      setActiveContextId(nextContextId);
      void refreshCoachView({
        nextContextType,
        nextContextId,
      });
    } catch {
      setMessages([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [refreshCoachView]);

  // Start new conversation
  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setLoadError(false);
    setSidebarOpen(false);
    setActiveContextType(initialContextType);
    setActiveContextId(contextId ?? null);
    setCoachEnvelope(initialCoachEnvelope);
  }, [
    contextId,
    initialCoachEnvelope,
    initialContextType,
  ]);

  // Handle conversation deletion from sidebar
  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [activeConversationId]
  );

  // Send a message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const trimmedText = text.trim();
      setLoadError(false);

      // Add user message to UI
      const userMsg: ChatMessageLocal = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmedText,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      posthog.capture("chat_message_sent", { message_length: trimmedText.length });

      void refreshCoachView({
        nextContextType: activeContextType,
        nextContextId: activeContextId,
        nextMessage: trimmedText,
      });

      // Add placeholder assistant message
      const assistantMsg: ChatMessageLocal = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        metadata: null,
        status: "streaming",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmedText,
            conversationId: activeConversationId,
            context: activeContextType,
            contextId: activeContextId,
            practiceLanguage,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error("Chat API error:", res.status, errBody);
          throw new Error(`Chat request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let newConversationId = activeConversationId;
        let streamTimer: ReturnType<typeof setTimeout> | null = null;
        let resolveStreamDrain: (() => void) | null = null;
        let pendingFinal:
          | {
              assistantMessageId?: unknown;
              metadata?: CoachMessageMetadata | null;
              finishReason?: unknown;
            }
          | null = null;
        const textQueue: string[] = [];

        const appendAssistantText = (chunk: string) => {
          if (!chunk) return;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk,
                status: "streaming",
              };
            }
            return updated;
          });
        };

        const finishAssistant = () => {
          if (!pendingFinal) return;
          const final = pendingFinal;
          pendingFinal = null;
          const finishReason =
            typeof final.finishReason === "string" ? final.finishReason : null;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                id:
                  typeof final.assistantMessageId === "string"
                    ? final.assistantMessageId
                    : last.id,
                metadata: final.metadata ?? last.metadata ?? null,
                status: "complete",
                finalRenderMode: "markdown",
                finishReason,
                isTruncated: finishReason === "length",
              };
            }
            return updated;
          });
          resolveStreamDrain?.();
          resolveStreamDrain = null;
        };

        const resolveDrainIfIdle = () => {
          if (pendingFinal || textQueue.length > 0 || streamTimer) return;
          resolveStreamDrain?.();
          resolveStreamDrain = null;
        };

        const pumpTextQueue = () => {
          streamTimer = null;

          if (textQueue.length === 0) {
            finishAssistant();
            resolveDrainIfIdle();
            return;
          }

          let nextChunk = "";
          while (
            textQueue.length > 0 &&
            Array.from(nextChunk).length < STREAM_REVEAL_CHAR_BUDGET
          ) {
            nextChunk += textQueue.shift() ?? "";
          }
          appendAssistantText(nextChunk);

          if (textQueue.length > 0) {
            streamTimer = setTimeout(pumpTextQueue, STREAM_REVEAL_INTERVAL_MS);
            return;
          }

          finishAssistant();
          resolveDrainIfIdle();
        };

        const enqueueAssistantText = (text: string) => {
          textQueue.push(...splitStreamingText(text));
          if (!streamTimer) {
            streamTimer = setTimeout(pumpTextQueue, STREAM_REVEAL_INTERVAL_MS);
          }
        };

        const waitForStreamDrain = () =>
          new Promise<void>((resolve) => {
            if (!streamTimer && textQueue.length === 0 && !pendingFinal) {
              resolve();
              return;
            }
            resolveStreamDrain = resolve;
          });

        const stopTypewriter = () => {
          textQueue.length = 0;
          pendingFinal = null;
          if (streamTimer) {
            clearTimeout(streamTimer);
            streamTimer = null;
          }
          resolveStreamDrain?.();
          resolveStreamDrain = null;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));

              if (data.conversationId && !newConversationId) {
                newConversationId = data.conversationId;
                setActiveConversationId(newConversationId);
              }

              if (data.text) {
                enqueueAssistantText(data.text);
              }

              if (data.error) {
                stopTypewriter();
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: t("error_message"),
                      metadata: null,
                      status: "error",
                      finalRenderMode: "markdown",
                    };
                  }
                  return updated;
                });
              }

              if (data.done) {
                pendingFinal = data;
                if (!streamTimer && textQueue.length === 0) {
                  finishAssistant();
                }

                // Refresh conversation list
                if (newConversationId) {
                  // Add or update in sidebar
                  setConversations((prev) => {
                    const exists = prev.find(
                      (c) => c.id === newConversationId
                    );
                    if (exists) {
                      return prev.map((c) =>
                        c.id === newConversationId
                          ? {
                              ...c,
                              updated_at: new Date().toISOString(),
                              preview: trimmedText,
                            }
                          : c
                      );
                    }
                    // New conversation
                    return [
                      {
                        id: newConversationId!,
                        user_id: "",
                        title: trimmedText.slice(0, 40),
                        context_type: activeContextType,
                        context_id: activeContextId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        preview: trimmedText,
                      },
                      ...prev,
                    ];
                  });
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        await waitForStreamDrain();
      } catch (err) {
        console.error("Send error:", err);
        // Update assistant message with error
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: t("error_message"),
              metadata: null,
              status: "error",
              finalRenderMode: "markdown",
            };
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeContextId,
      activeContextType,
      activeConversationId,
      practiceLanguage,
      refreshCoachView,
      t,
    ]
  );

  const requestVisualize = useCallback(
    async (messageId: string) => {
      if (!messageId || messageId.startsWith("temp-")) return;
      setVisualizingMessageId(messageId);
      try {
        const res = await fetch("/api/chat/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            conversationId: activeConversationId,
          }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = (await res.json()) as {
          metadata?: CoachMessageMetadata | null;
        };
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  metadata: data.metadata ?? message.metadata ?? null,
                }
              : message
          )
        );
      } catch (error) {
        console.error("Visual explainer error:", error);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId && message.metadata
              ? {
                  ...message,
                  metadata: {
                    ...message.metadata,
                    autoVisualize: false,
                  },
                }
              : message
          )
        );
      } finally {
        setVisualizingMessageId(null);
      }
    },
    [activeConversationId]
  );

  useEffect(() => {
    if (visualizingMessageId) return;
    const nextMessage = messages.find(
      (message) =>
        message.role === "assistant" &&
        message.status === "complete" &&
        !message.id.startsWith("temp-") &&
        Boolean(message.metadata?.autoVisualize) &&
        Boolean(message.metadata?.visualizable) &&
        !message.metadata?.visualExplainer &&
        !autoVisualizedMessageIdsRef.current.has(message.id)
    );

    if (!nextMessage) return;
    autoVisualizedMessageIdsRef.current.add(nextMessage.id);
    void requestVisualize(nextMessage.id);
  }, [messages, requestVisualize, visualizingMessageId]);

  // Auto-send initial message from URL param
  useEffect(() => {
    if (initialMessage && !initialMessageSent) {
      setInitialMessageSent(true);
      sendMessage(initialMessage);
    }
  }, [initialMessage, initialMessageSent, sendMessage]);

  // Load initial conversation
  useEffect(() => {
    if (initialConversationId && !initialMessage) {
      loadConversation(initialConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageTransition className="flex h-full min-h-0 overflow-hidden bg-background">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConversation}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />
      <ChatArea
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        onOpenSidebar={() => setSidebarOpen(true)}
        hasConversation={!!activeConversationId}
        coachEnvelope={coachEnvelope}
        isInsightsLoading={isInsightsLoading}
        loadError={loadError}
        visualizingMessageId={visualizingMessageId}
        onRequestVisualize={requestVisualize}
        onRetryLoad={
          activeConversationId
            ? () => {
                loadConversation(activeConversationId);
              }
            : undefined
        }
      />
    </PageTransition>
  );
}
