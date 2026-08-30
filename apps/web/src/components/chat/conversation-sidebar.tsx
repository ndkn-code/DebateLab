"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, ChevronDown } from "@/components/ui/icons";
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
  const [showRepeated, setShowRepeated] = useState(false);
  const t = useTranslations("dashboard.chat");
  const repeatedConversations = useMemo(() => {
    const titleCounts = new Map<string, number>();
    for (const conversation of conversations) {
      const key = conversation.title?.trim().toLocaleLowerCase() ?? "";
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
    }

    return conversations.filter((conversation) => {
      const key = conversation.title?.trim().toLocaleLowerCase() ?? "";
      return !key || (titleCounts.get(key) ?? 0) > 1;
    });
  }, [conversations]);
  const repeatedIds = useMemo(
    () => new Set(repeatedConversations.map((conversation) => conversation.id)),
    [repeatedConversations],
  );
  const visibleConversations = useMemo(
    () =>
      showRepeated
        ? conversations
        : conversations.filter(
            (conversation) =>
              !repeatedIds.has(conversation.id) || conversation.id === activeId,
          ),
    [activeId, conversations, repeatedIds, showRepeated],
  );

  const handleDelete = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    startTransition(async () => {
      await deleteConversationAction(id);
      onDelete(id);
    });
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-outline-variant/60 p-3">
        <Button
          onClick={onNewChat}
          className="h-8 w-full gap-2 rounded-[10px] bg-primary type-label font-medium text-on-primary shadow-none"
        >
          <Plus className="h-4 w-4" />
          {t("new_chat")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {conversations.length === 0 ? (
          <div className="px-3 py-8">
            <p className="text-sm leading-6 text-on-surface-variant">
              {t("sidebar_empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {repeatedConversations.length > 0 && !showRepeated ? (
              <button
                type="button"
                onClick={() => setShowRepeated(true)}
                aria-expanded={false}
                className="flex min-h-9 w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low/70 hover:text-on-surface"
              >
                <span className="truncate">{t("new_conversation")}</span>
                <span className="flex items-center gap-1 text-xs text-on-surface-variant/65">
                  {repeatedConversations.length}
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </button>
            ) : null}
            {showRepeated && repeatedConversations.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowRepeated(false)}
                aria-expanded={true}
                className="flex min-h-8 w-full items-center justify-between rounded-[10px] px-3 py-1.5 text-left text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low/70"
              >
                <span>{t("new_conversation")}</span>
                <ChevronDown className="h-3.5 w-3.5 rotate-180" />
              </button>
            ) : null}
            {visibleConversations.map((conversation) => {
              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex min-h-10 min-w-0 items-center gap-1 rounded-[10px] border transition-colors",
                    activeId === conversation.id
                      ? "border-primary/16 bg-primary/5 text-on-surface"
                      : "border-transparent bg-transparent text-on-surface hover:border-outline-variant/14 hover:bg-surface-container-low/70",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className="min-h-10 min-w-0 flex-1 px-3 py-2 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {conversation.title || t("new_conversation")}
                    </span>
                  </button>

                  <button
                    onClick={(event) => handleDelete(event, conversation.id)}
                    disabled={isPending}
                    className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
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
      <div className="hidden w-55 shrink-0 border-r border-outline-variant/12 bg-surface lg:block">
        <SidebarContent {...rest} />
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-55 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("conversations")}</SheetTitle>
          </SheetHeader>
          <SidebarContent {...rest} />
        </SheetContent>
      </Sheet>
    </>
  );
}
