"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessageLocal } from "./chat-shell";

interface ChatBubbleProps {
  message: ChatMessageLocal;
  isStreaming?: boolean;
}

export function ChatBubble({ message, isStreaming = false }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-primary" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-on-primary" />
        ) : (
          <Sparkles className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-on-primary"
            : "border border-outline-variant/10 bg-surface-container-lowest soft-shadow text-on-surface"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-li:my-0.5 prose-strong:text-primary prose-headings:text-on-surface prose-headings:mt-3 prose-headings:mb-1 prose-p:text-on-surface-variant prose-li:text-on-surface-variant prose-a:text-primary prose-code:text-primary prose-code:bg-surface-container prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-surface-container prose-pre:rounded-xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
