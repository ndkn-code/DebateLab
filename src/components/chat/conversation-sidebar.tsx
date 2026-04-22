"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { deleteConversationAction } from "@/app/[locale]/(protected)/chat/actions";
import type { ConversationWithPreview } from "@/lib/api/chat";

interface ConversationSidebarProps {
  conversations: ConversationWithPreview[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SidebarContent({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
}: Omit<ConversationSidebarProps, "open" | "onOpenChange">) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("dashboard.chat");

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("today");
    if (diffDays === 1) return t("yesterday");
    if (diffDays < 7) return t("days_ago", { count: diffDays });

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    startTransition(async () => {
      await deleteConversationAction(id);
      onDelete(id);
    });
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-outline-variant/12 p-4">
        <Button
          onClick={onNewChat}
          className="h-12 w-full gap-2 rounded-[18px] bg-primary text-on-primary shadow-[0_10px_24px_rgba(77,134,247,0.22)]"
        >
          <Plus className="h-4 w-4" />
          {t("new_chat")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <p className="text-sm text-on-surface-variant">{t("sidebar_empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group rounded-[18px] border px-3 py-3 transition-colors",
                    activeId === conversation.id
                      ? "border-primary/18 bg-primary/5 text-on-surface"
                      : "border-outline-variant/12 bg-transparent text-on-surface hover:border-outline-variant/18 hover:bg-surface-container-low/55"
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(conversation.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(conversation.id);
                      }
                    }}
                    className="flex min-w-0 cursor-pointer items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">
                          {conversation.title || t("new_conversation")}
                        </p>
                        <span className="shrink-0 text-[11px] text-on-surface-variant">
                          {formatDate(conversation.updated_at || conversation.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
                        {conversation.preview || t("preview_fallback")}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(event) => handleDelete(event, conversation.id)}
                    disabled={isPending}
                    className="mt-2 rounded-lg p-1 text-on-surface-variant opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                    aria-label={t("delete_conversation")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  const { open, onOpenChange, ...rest } = props;
  const t = useTranslations("dashboard.chat");

  return (
    <>
      <div className="hidden w-[260px] shrink-0 border-r border-outline-variant/12 bg-surface lg:block">
        <SidebarContent {...rest} />
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("conversations")}</SheetTitle>
          </SheetHeader>
          <SidebarContent {...rest} />
        </SheetContent>
      </Sheet>
    </>
  );
}
