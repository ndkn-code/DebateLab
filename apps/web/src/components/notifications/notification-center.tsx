"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  BellRing,
  Check,
  CheckCircle2,
  MoreHorizontal,
  Settings,
  X,
} from "@/components/ui/icons";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  type NotificationInboxEvent,
  type NotificationInboxFilter,
  type NotificationInboxSnapshot,
  type NotificationUiOperations,
} from "./contracts";
import { getNotificationCopy, type NotificationLocale } from "./copy";
import { notificationApiOperations } from "./notification-api";

const LEARNING_TOPICS = new Set([
  "practice",
  "streak",
  "achievements",
  "teacher_feedback",
]);
const CLASS_TOPICS = new Set(["assignments", "class_updates"]);

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(value: string, locale: NotificationLocale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchesFilter(
  event: NotificationInboxEvent,
  filter: NotificationInboxFilter,
) {
  if (filter === "unread") return !event.readAt;
  if (filter === "learning") return LEARNING_TOPICS.has(event.topic);
  if (filter === "classes") return CLASS_TOPICS.has(event.topic);
  return true;
}

interface NotificationCenterProps {
  snapshot?: NotificationInboxSnapshot;
  operations?: Pick<
    NotificationUiOperations,
    "listInbox" | "markRead" | "markAllRead" | "muteObject"
  >;
  variant?: "sidebar" | "icon";
  className?: string;
}

export function NotificationCenter({
  snapshot,
  operations,
  variant = "icon",
  className,
}: NotificationCenterProps) {
  const locale = (useLocale() === "vi" ? "vi" : "en") as NotificationLocale;
  const copy = getNotificationCopy(locale).inbox;
  const activeOperations = operations ?? notificationApiOperations;
  const [events, setEvents] = useState(snapshot?.events ?? []);
  const [unreadCount, setUnreadCount] = useState(snapshot?.unreadCount ?? 0);
  const [filter, setFilter] = useState<NotificationInboxFilter>("all");
  const [announcement, setAnnouncement] = useState("");
  const [loading, setLoading] = useState(!snapshot);
  const [loadError, setLoadError] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const next = await activeOperations.listInbox();
      setEvents(next.events);
      setUnreadCount(next.unreadCount);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeOperations]);

  useEffect(() => {
    if (snapshot) {
      setEvents(snapshot.events);
      setUnreadCount(snapshot.unreadCount);
      setLoading(false);
      setLoadError(false);
      return;
    }
    void loadInbox();
  }, [loadInbox, snapshot]);

  const filtered = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)),
    [events, filter],
  );
  const today = filtered.filter((event) => isToday(event.createdAt));
  const earlier = filtered.filter((event) => !isToday(event.createdAt));

  async function markRead(event: NotificationInboxEvent) {
    if (event.readAt) return;
    const readAt = new Date().toISOString();
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, readAt } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    setAnnouncement(copy.markRead);
    try {
      await activeOperations.markRead(event.id);
    } catch {
      setEvents((current) =>
        current.map((item) =>
          item.id === event.id ? { ...item, readAt: null } : item,
        ),
      );
      setUnreadCount((current) => current + 1);
    }
  }

  async function markAllRead() {
    const readAt = new Date().toISOString();
    const previous = events;
    const previousUnreadCount = unreadCount;
    setEvents((current) => current.map((event) => ({ ...event, readAt })));
    setUnreadCount(0);
    setAnnouncement(copy.markAll);
    try {
      await activeOperations.markAllRead();
    } catch {
      setEvents(previous);
      setUnreadCount(previousUnreadCount);
    }
  }

  async function muteObject(event: NotificationInboxEvent) {
    if (!event.objectType || !event.objectId) return;
    const previous = events;
    setEvents((current) =>
      current.map((item) =>
        item.objectType === event.objectType && item.objectId === event.objectId
          ? { ...item, muted: true }
          : item,
      ),
    );
    setAnnouncement(copy.muted);
    try {
      await activeOperations.muteObject({
        subjectType: event.objectType,
        subjectId: event.objectId,
      });
    } catch {
      setEvents(previous);
    }
  }

  const trigger =
    variant === "sidebar" ? (
      <SheetTrigger
        aria-label={`${copy.title}, ${copy.unread(unreadCount)}`}
        className={cn(
          "sidebar-nav-action flex h-8 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        <span className="relative">
          <BellRing className="h-5 w-5 shrink-0" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 size-2 rounded-full bg-secondary ring-2 ring-sidebar"
              aria-hidden="true"
            />
          ) : null}
        </span>
        <span className="truncate">{copy.title}</span>
        {unreadCount > 0 ? (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] bg-secondary-container px-1 type-caption font-semibold text-secondary-dim">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </SheetTrigger>
    ) : (
      <SheetTrigger
        aria-label={`${copy.title}, ${copy.unread(unreadCount)}`}
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-control text-sidebar-muted transition-colors hover:bg-white/[0.08] hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        <BellRing className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-secondary type-caption font-bold leading-none text-on-secondary">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </SheetTrigger>
    );

  return (
    <Sheet>
      {trigger}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-full gap-0 border-outline-variant bg-surface p-0 motion-reduce:transition-none sm:!w-[420px] sm:!max-w-[420px]"
      >
        <SheetHeader className="border-b border-outline-variant px-4 py-4 pr-14">
          <SheetTitle className="type-heading-md text-on-surface">
            {copy.title}
          </SheetTitle>
          <SheetDescription className="type-body-sm text-on-surface-variant">
            {copy.description}
          </SheetDescription>
        </SheetHeader>
        <SheetClose
          aria-label={
            locale === "vi" ? "Đóng thông báo" : "Close notifications"
          }
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-control text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </SheetClose>

        <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-2">
          <div
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
            role="group"
            aria-label={copy.title}
          >
            {(["all", "unread", "learning", "classes"] as const).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "h-8 shrink-0 rounded-control px-2.5 type-label font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    filter === value
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container",
                  )}
                >
                  {copy.filters[value]}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control px-2 type-label font-medium text-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{copy.markAll}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div
              className="flex min-h-64 items-center justify-center px-8 type-body-sm text-on-surface-variant"
              role="status"
            >
              {copy.loading}
            </div>
          ) : loadError ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-8 text-center">
              <p className="type-body-sm text-on-surface-variant">
                {copy.loadError}
              </p>
              <button
                type="button"
                onClick={() => void loadInbox()}
                className="mt-3 inline-flex h-8 items-center rounded-control px-3 type-label font-semibold text-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {copy.retry}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-control bg-secondary-container text-secondary-dim">
                <Check className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 type-label font-semibold text-on-surface">
                {copy.emptyTitle}
              </h3>
              <p className="mt-1 type-body-sm text-on-surface-variant">
                {copy.emptyBody}
              </p>
            </div>
          ) : (
            <div>
              <NotificationGroup
                id="today"
                title={copy.today}
                events={today}
                locale={locale}
                onMarkRead={markRead}
                onMute={muteObject}
              />
              <NotificationGroup
                id="earlier"
                title={copy.earlier}
                events={earlier}
                locale={locale}
                onMarkRead={markRead}
                onMute={muteObject}
              />
            </div>
          )}
        </div>

        <div className="border-t border-outline-variant p-3">
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/settings#notifications"
                className="flex h-8 items-center justify-center gap-2 rounded-control type-label font-medium text-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            }
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            {locale === "vi" ? "Cài đặt thông báo" : "Notification settings"}
          </SheetClose>
        </div>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </SheetContent>
    </Sheet>
  );
}

function NotificationGroup({
  id,
  title,
  events,
  locale,
  onMarkRead,
  onMute,
}: {
  id: "today" | "earlier";
  title: string;
  events: NotificationInboxEvent[];
  locale: NotificationLocale;
  onMarkRead: (event: NotificationInboxEvent) => void;
  onMute: (event: NotificationInboxEvent) => void;
}) {
  const copy = getNotificationCopy(locale).inbox;
  if (events.length === 0) return null;

  return (
    <section aria-labelledby={`notification-group-${id}`}>
      <h3
        id={`notification-group-${id}`}
        className="sticky top-0 z-10 border-b border-outline-variant/60 bg-surface-container-low px-4 py-2 type-caption font-semibold uppercase text-on-surface-variant"
      >
        {title}
      </h3>
      <ul className="divide-y divide-outline-variant/50">
        {events.map((event) => (
          <li
            key={event.id}
            className={cn(
              "grid grid-cols-[8px_minmax(0,1fr)_auto] gap-3 px-4 py-3",
              event.readAt ? "bg-surface" : "bg-primary-container/20",
            )}
          >
            <span
              className={cn(
                "mt-1.5 size-2 rounded-full",
                event.readAt ? "bg-outline-variant" : "bg-primary",
              )}
              aria-label={event.readAt ? copy.markRead : copy.unread(1)}
            />
            <div className="min-w-0">
              <p className="type-label font-semibold text-on-surface">
                {event.title}
              </p>
              <p className="mt-0.5 type-body-sm text-on-surface-variant">
                {event.body}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="type-caption text-on-surface-variant">
                  {formatTime(event.createdAt, locale)}
                </span>
                {event.muted ? (
                  <span className="inline-flex h-5 items-center rounded-[6px] bg-surface-container px-1.5 type-caption font-semibold text-on-surface-variant">
                    {copy.mutedLabel}
                  </span>
                ) : null}
                {event.deepLink ? (
                  <SheetClose
                    nativeButton={false}
                    render={
                      <Link
                        href={event.deepLink}
                        onClick={() => onMarkRead(event)}
                        className="rounded-[6px] type-caption font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                    }
                  >
                    {copy.open}
                  </SheetClose>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-1">
              {!event.readAt ? (
                <button
                  type="button"
                  onClick={() => onMarkRead(event)}
                  aria-label={`${copy.markRead}: ${event.title}`}
                  className="inline-flex size-8 items-center justify-center rounded-control text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              {event.objectType && event.objectId && !event.muted ? (
                <button
                  type="button"
                  onClick={() => onMute(event)}
                  aria-label={`${copy.mute}: ${event.title}`}
                  className="inline-flex size-8 items-center justify-center rounded-control text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
