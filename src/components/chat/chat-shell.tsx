"use client";

import { useState, useCallback, useEffect } from "react";
import posthog from "posthog-js";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatArea } from "./chat-area";
import type { ConversationWithPreview } from "@/lib/api/chat";
import type { ChatMessage } from "@/types/database";

export interface ChatMessageLocal {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatShellProps {
  conversations: ConversationWithPreview[];
  initialMessage?: string;
  initialConversationId?: string;
  context?: string;
  contextId?: string;
}

export function ChatShell({
  conversations: initialConversations,
  initialMessage,
  initialConversationId,
  context,
  contextId,
}: ChatShellProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const [messages, setMessages] = useState<ChatMessageLocal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialMessageSent, setInitialMessageSent] = useState(false);

  // Load messages when switching conversations
  const loadConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setIsLoading(true);
    setSidebarOpen(false);

    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.messages.map((m: ChatMessage) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            created_at: m.created_at,
          }))
        );
      }
    } catch {
      // Failed to load, keep empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start new conversation
  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

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

      // Add user message to UI
      const userMsg: ChatMessageLocal = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      posthog.capture("chat_message_sent", { message_length: text.trim().length });

      // Add placeholder assistant message
      const assistantMsg: ChatMessageLocal = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            conversationId: activeConversationId,
            context,
            contextId,
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
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + data.text,
                    };
                  }
                  return updated;
                });
              }

              if (data.done) {
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
                            }
                          : c
                      );
                    }
                    // New conversation
                    return [
                      {
                        id: newConversationId!,
                        user_id: "",
                        title: text.trim().slice(0, 40),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
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
      } catch (err) {
        console.error("Send error:", err);
        // Update assistant message with error
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, I encountered an error. Please try again.",
            };
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, context, contextId]
  );

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
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden md:h-screen">
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
      />
    </div>
  );
}
