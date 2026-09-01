"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  MessageSquareText,
  Plus,
  Trash2,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  BeautifulSidebarNav,
  BeautifulSidebarRow,
  BeautifulSidebarSearch,
} from "@/components/beautifului";
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
  collapsed = false,
  onCollapsedChange,
  mobile = false,
}: Omit<ConversationSidebarProps, "open" | "onOpenChange"> & {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobile?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showRepeated, setShowRepeated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations("dashboard.chat");
  const locale = useLocale();
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
  const visibleConversations = useMemo(() => {
    const base = showRepeated
      ? conversations
      : conversations.filter(
          (conversation) =>
            !repeatedIds.has(conversation.id) || conversation.id === activeId,
        );
    const query = searchQuery.trim().toLocaleLowerCase(locale);
    if (!query) return base;
    return base.filter((conversation) =>
      [conversation.title, conversation.preview]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase(locale).includes(query)),
    );
  }, [activeId, conversations, locale, repeatedIds, searchQuery, showRepeated]);

  const handleDelete = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    startTransition(async () => {
      await deleteConversationAction(id);
      onDelete(id);
    });
  };

  const collapseLabel = locale.startsWith("vi")
    ? "Thu gọn thanh hội thoại"
    : "Collapse conversation sidebar";
  const expandLabel = locale.startsWith("vi")
    ? "Mở rộng thanh hội thoại"
    : "Expand conversation sidebar";

  return (
    <BeautifulSidebarNav
      collapsed={mobile ? false : collapsed}
      onCollapsedChange={mobile ? undefined : onCollapsedChange}
      collapseLabel={collapseLabel}
      expandLabel={expandLabel}
      header={
        <span className="block truncate px-1 type-label font-semibold text-on-surface">
          {t("conversations")}
        </span>
      }
      primaryAction={
        <Button
          onClick={onNewChat}
          title={collapsed ? t("new_chat") : undefined}
          aria-label={t("new_chat")}
          className={cn(
            "h-8 gap-2 rounded-control bg-primary type-label font-medium text-on-primary shadow-none",
            collapsed ? "w-8 px-0" : "w-full",
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed ? t("new_chat") : null}
        </Button>
      }
      search={
        conversations.length > 0 && !collapsed ? (
          <BeautifulSidebarSearch
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={t("conversations")}
            label={t("conversations")}
            collapsed={collapsed}
          />
        ) : null
      }
      className={mobile ? "w-full" : undefined}
    >
      {conversations.length === 0 ? (
        <div className={cn("py-6", collapsed ? "px-1" : "px-2")}>
          {collapsed ? (
            <MessageSquareText
              className="mx-auto size-4 text-on-surface-variant"
              aria-hidden="true"
            />
          ) : (
            <p className="type-body-sm text-on-surface-variant">
              {t("sidebar_empty")}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {!collapsed && repeatedConversations.length > 0 && !showRepeated ? (
            <button
              type="button"
              onClick={() => setShowRepeated(true)}
              aria-expanded={false}
              className="flex min-h-9 w-full items-center justify-between rounded-control px-2 py-2 text-left type-caption text-on-surface-variant transition-colors hover:bg-surface-container-low/70 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{t("new_conversation")}</span>
              <span className="flex items-center gap-1 text-xs text-on-surface-variant/65">
                {repeatedConversations.length}
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : null}
          {!collapsed && showRepeated && repeatedConversations.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowRepeated(false)}
              aria-expanded={true}
              className="flex min-h-8 w-full items-center justify-between rounded-control px-2 py-1.5 text-left type-caption font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{t("new_conversation")}</span>
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            </button>
          ) : null}
          {visibleConversations.map((conversation) => {
            return (
              <BeautifulSidebarRow
                key={conversation.id}
                active={activeId === conversation.id}
                collapsed={collapsed}
                icon={
                  <MessageSquareText className="size-4" aria-hidden="true" />
                }
                label={conversation.title || t("new_conversation")}
                onClick={() => onSelect(conversation.id)}
                trailing={
                  <button
                    type="button"
                    onClick={(event) => handleDelete(event, conversation.id)}
                    disabled={isPending}
                    className="flex size-7 items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-[background-color,color,opacity] hover:bg-error/10 hover:text-error focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                    aria-label={t("delete_conversation")}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </BeautifulSidebarNav>
  );
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  const { open, onOpenChange, ...rest } = props;
  const t = useTranslations("dashboard.chat");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className="hidden shrink-0 border-r border-outline-variant bg-surface lg:block">
        <SidebarContent
          {...rest}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("conversations")}</SheetTitle>
          </SheetHeader>
          <SidebarContent {...rest} mobile />
        </SheetContent>
      </Sheet>
    </>
  );
}
