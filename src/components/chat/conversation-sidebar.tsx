"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("today");
    if (diffDays === 1) return t("yesterday");
    if (diffDays < 7) return t("days_ago", { count: diffDays });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteConversationAction(id);
      onDelete(id);
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full gap-2 bg-primary text-on-primary"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {t("new_chat")}
        </Button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <MessageCircle className="mb-3 h-8 w-8 text-primary/30" />
            <p className="text-sm text-on-surface-variant">
              {t("sidebar_empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                  activeId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface hover:bg-surface-container"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {conv.title || t("new_conversation")}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {formatDate(conv.updated_at || conv.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg p-1 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  const { open, onOpenChange, ...rest } = props;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden w-[280px] shrink-0 border-r border-outline-variant/10 bg-surface-container-lowest lg:block">
        <SidebarContent {...rest} />
      </div>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <SidebarContent {...rest} />
        </SheetContent>
      </Sheet>
    </>
  );
}
