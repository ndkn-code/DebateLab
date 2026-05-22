"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ExternalLink,
  HelpCircle,
  MessageSquareText,
} from "@/components/ui/icons";
import { usePathname } from "@/i18n/navigation";
import {
  buildTallyBugReportUrl,
  getConfiguredTallyBugReportFormUrl,
} from "@/lib/support/tally-url";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface SupportIssueDialogProps {
  profile: Profile | null;
  userEmail: string | null;
  triggerClassName?: string;
}

function getViewport() {
  if (typeof window === "undefined") return "";

  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;

  return `${Math.round(width)}x${Math.round(height)}`;
}

export function SupportIssueDialog({
  profile,
  userEmail,
  triggerClassName,
}: SupportIssueDialogProps) {
  const t = useTranslations("dashboard.support");
  const locale = useLocale();
  const pathname = usePathname();
  const [browserContext, setBrowserContext] = useState({
    userAgent: "",
    viewport: "",
    timestamp: "",
    route: pathname,
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const tallyUrl = useMemo(
    () =>
      buildTallyBugReportUrl(getConfiguredTallyBugReportFormUrl(locale), {
        userId: profile?.id,
        email: userEmail ?? profile?.email,
        locale,
        route: browserContext.route,
        source: "web_sidebar_help_support",
        userAgent: browserContext.userAgent,
        viewport: browserContext.viewport,
        timestamp: browserContext.timestamp,
      }),
    [browserContext, locale, profile?.email, profile?.id, userEmail]
  );

  const refreshContext = () => {
    setIframeLoaded(false);
    setBrowserContext({
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      viewport: getViewport(),
      timestamp: new Date().toISOString(),
      route:
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start rounded-lg px-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              triggerClassName
            )}
            onClick={refreshContext}
          />
        }
      >
        <HelpCircle className="mr-3 h-5 w-5 shrink-0" />
        <span className="truncate">{t("trigger_label")}</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 shadow-2xl sm:max-w-2xl">
        <DialogHeader className="border-b border-outline-variant/15 px-5 pb-4 pr-12 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-semibold text-on-surface">
                {t("modal_title")}
              </DialogTitle>
              <DialogDescription className="text-sm leading-5 text-on-surface-variant">
                {t("modal_description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {tallyUrl ? (
          <div className="relative h-[calc(100dvh-11rem)] min-h-[420px] max-h-[680px] w-full bg-surface-container-lowest">
            <div
              className={cn(
                "absolute inset-0 grid place-items-center text-sm text-on-surface-variant transition-opacity",
                iframeLoaded ? "opacity-0" : "opacity-100"
              )}
            >
              {t("loading")}
            </div>
            <iframe
              title={t("iframe_title")}
              src={tallyUrl}
              className="relative z-10 h-full w-full border-0 bg-transparent"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-write"
              onLoad={() => setIframeLoaded(true)}
            />
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="h-8 w-8 text-error" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-on-surface">
                {t("unavailable_title")}
              </p>
              <p className="max-w-sm text-sm leading-5 text-on-surface-variant">
                {t("unavailable_body")}
              </p>
            </div>
          </div>
        )}

        {tallyUrl ? (
          <div className="flex justify-end border-t border-outline-variant/15 px-5 py-3">
            <a
              href={tallyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {t("open_external")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
