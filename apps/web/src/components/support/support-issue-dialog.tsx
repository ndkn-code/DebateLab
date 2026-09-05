"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogClose,
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
  Mail,
  MessageSquareText,
  RefreshCw,
  XIcon,
} from "@/components/ui/icons";
import { usePathname } from "@/i18n/navigation";
import {
  buildTallyBugReportUrl,
  getConfiguredTallyBugReportFormUrl,
} from "@/lib/support/tally-url";
import { buildSupportMailtoUrl } from "@/lib/support/support-contact";
import {
  reduceSupportFormState,
  SUPPORT_FORM_TIMEOUT_MS,
} from "@/lib/support/support-form";
import { cn } from "@/lib/utils";
import { getFaroCorrelationContext } from "@/lib/observability/faro-client";
import { stripUrlQuery } from "@/lib/observability/faro-sanitize";
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
    faroSessionId: "",
    traceId: "",
    releaseSha: "",
    debugId: "",
  });
  const [open, setOpen] = useState(false);
  const [formState, dispatchForm] = useReducer(
    reduceSupportFormState,
    "loading",
  );
  const [iframeKey, setIframeKey] = useState(0);

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
        faroSessionId: browserContext.faroSessionId,
        traceId: browserContext.traceId,
        releaseSha: browserContext.releaseSha,
        debugId: browserContext.debugId,
      }),
    [browserContext, locale, profile?.email, profile?.id, userEmail],
  );

  const refreshContext = () => {
    const correlation = getFaroCorrelationContext();
    dispatchForm("retry");
    setIframeKey((key) => key + 1);
    setBrowserContext({
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      viewport: getViewport(),
      timestamp: new Date().toISOString(),
      route: stripUrlQuery(
        typeof window === "undefined" ? pathname : window.location.pathname,
      ),
      ...correlation,
    });
  };

  useEffect(() => {
    if (!open || !tallyUrl || formState !== "loading") return;

    const timeout = window.setTimeout(
      () => dispatchForm("timeout"),
      SUPPORT_FORM_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [formState, open, tallyUrl]);

  const mailtoUrl = buildSupportMailtoUrl({
    locale,
    route: browserContext.route,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start rounded-lg px-2 type-label text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              triggerClassName,
            )}
            onClick={refreshContext}
          />
        }
      >
        <HelpCircle className="mr-3 h-5 w-5 shrink-0" />
        <span className="truncate">{t("trigger_label")}</span>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-0 shadow-2xl sm:max-w-[52rem] lg:max-w-[60rem]"
      >
        <DialogHeader className="shrink-0 border-b border-outline-variant px-5 pb-4 pr-12 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="type-title text-on-surface">
                {t("modal_title")}
              </DialogTitle>
              <DialogDescription className="type-body-sm text-on-surface-variant">
                {t("modal_description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {tallyUrl ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative h-[calc(100dvh-15rem)] min-h-[320px] w-full flex-none overflow-auto bg-surface-container-lowest sm:max-h-[780px] sm:min-h-[520px]">
              {formState === "loading" ? (
                <div
                  role="status"
                  className="absolute inset-0 grid place-items-center type-body text-on-surface-variant"
                >
                  {t("loading")}
                </div>
              ) : null}
              <iframe
                key={iframeKey}
                title={t("iframe_title")}
                src={tallyUrl}
                className={cn(
                  "relative z-10 h-full w-full border-0 bg-transparent",
                  formState === "error" && "hidden",
                )}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write"
                onLoad={() => dispatchForm("load")}
                onError={() => dispatchForm("error")}
              />
              {formState === "error" ? (
                <div
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto px-6 py-6 text-center"
                >
                  <AlertCircle
                    className="h-8 w-8 text-error"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="type-title text-on-surface">
                      {t("error_title")}
                    </p>
                    <p className="type-body-sm max-w-md text-on-surface-variant">
                      {t("error_body")}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        dispatchForm("retry");
                        setIframeKey((key) => key + 1);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      {t("retry")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
              <Button
                nativeButton={false}
                render={
                  <a
                    href={tallyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                variant="outline"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("open_external")}
              </Button>
              <Button
                nativeButton={false}
                render={<a href={mailtoUrl} />}
                variant="ghost"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t("email_support")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 overflow-auto px-6 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-error" />
            <div className="space-y-1">
              <p className="type-title text-on-surface">
                {t("unavailable_title")}
              </p>
              <p className="type-body-sm max-w-sm text-on-surface-variant">
                {t("unavailable_body")}
              </p>
            </div>
            <Button
              nativeButton={false}
              render={<a href={mailtoUrl} />}
              variant="primary"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t("email_support")}
            </Button>
          </div>
        )}
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              aria-label={t("close")}
            />
          }
        >
          <XIcon aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
