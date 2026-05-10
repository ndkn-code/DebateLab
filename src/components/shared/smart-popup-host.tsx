"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BellRing, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SmartPopupPayload } from "@/lib/smart-popups/types";

interface SmartPopupHostProps {
  paused?: boolean;
}

type SmartPopupResponse = {
  popup?: SmartPopupPayload | null;
};

function isSuppressedPath(pathname: string | null) {
  const path = (pathname ?? "").toLowerCase();

  if (!path || path === "/") return true;
  if (path.includes("/auth") || path.includes("/onboarding")) return true;
  if (path.includes("/dashboard/admin") || path.includes("/admin")) return true;
  if (path.includes("/practice/session")) return true;

  return !(path === "/dashboard" || path.endsWith("/dashboard"));
}

function buildQuery(params: Record<string, string>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  return search.toString();
}

export function SmartPopupHost({ paused = false }: SmartPopupHostProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [popup, setPopup] = useState<SmartPopupPayload | null>(null);
  const [open, setOpen] = useState(false);
  const lastRequestKeyRef = useRef<string | null>(null);
  const handledCloseRef = useRef(false);
  const suppressed = paused || isSuppressedPath(pathname);

  const trackEvent = useCallback(
    (eventType: "dismissed" | "cta_clicked" | "dont_show_again") => {
      if (!popup) return;

      void fetch("/api/client/smart-popups/events", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignKey: popup.key,
          eventType,
          surface: popup.surface,
          route: pathname,
          metadata: popup.metadata,
        }),
      }).catch(() => undefined);
    },
    [pathname, popup]
  );

  const closeWithEvent = useCallback(
    (eventType: "dismissed" | "cta_clicked" | "dont_show_again") => {
      if (handledCloseRef.current) return;
      handledCloseRef.current = true;
      trackEvent(eventType);
      setOpen(false);
    },
    [trackEvent]
  );

  useEffect(() => {
    if (!suppressed || !open || !popup) return;
    const timer = window.setTimeout(() => closeWithEvent("dismissed"), 0);
    return () => window.clearTimeout(timer);
  }, [closeWithEvent, open, popup, suppressed]);

  useEffect(() => {
    if (suppressed) return;

    const requestKey = `${locale}:${pathname ?? ""}`;
    if (lastRequestKeyRef.current === requestKey) return;
    lastRequestKeyRef.current = requestKey;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const route = pathname ?? "";
        const previewQuery = buildQuery({
          locale,
          route,
          surface: "dashboard",
        });
        const previewRes = await fetch(
          `/api/client/smart-popups/next?${previewQuery}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!previewRes.ok || controller.signal.aborted) return;
        const preview = (await previewRes.json()) as SmartPopupResponse;
        if (!preview.popup) return;

        await new Promise((resolve) => window.setTimeout(resolve, 350));
        if (controller.signal.aborted) return;

        const commitRes = await fetch("/api/client/smart-popups/next", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            route,
            surface: "dashboard",
          }),
        });

        if (!commitRes.ok || controller.signal.aborted) return;
        const committed = (await commitRes.json()) as SmartPopupResponse;
        if (!committed.popup) return;

        handledCloseRef.current = false;
        setPopup(committed.popup);
        setOpen(true);
      } catch {
        // Popup eligibility is opportunistic; failures should never block the page.
      }
    }, 950);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locale, pathname, suppressed]);

  if (!popup) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeWithEvent("dismissed");
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[calc(100dvh-2rem)] max-w-[min(92vw,460px)] overflow-hidden rounded-[28px] border border-[#dbe7ff] bg-white p-0 text-[#172554] shadow-[0_30px_80px_-45px_rgba(29,78,216,0.9)] sm:max-w-[460px]"
        )}
      >
        <button
          type="button"
          onClick={() => closeWithEvent("dismissed")}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#64748b] shadow-sm transition hover:bg-[#edf3ff] hover:text-[#1d4ed8]"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{popup.dismissLabel}</span>
        </button>

        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <div className="relative flex min-h-[210px] items-end justify-center overflow-hidden bg-[#eaf3ff] px-6 pt-7">
            <div className="absolute inset-x-0 bottom-0 h-20 bg-white" />
            <Image
              src={popup.imageSrc}
              alt={popup.imageAlt}
              width={420}
              height={420}
              className="relative h-[220px] w-[220px] object-contain sm:h-[250px] sm:w-[250px]"
              priority={false}
            />
          </div>

          <div className="px-6 pb-6 pt-5">
            {popup.eyebrow ? (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#edf7ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                <BellRing className="h-3.5 w-3.5" />
                {popup.eyebrow}
              </div>
            ) : null}

            <DialogTitle className="text-2xl font-bold leading-tight tracking-normal text-[#172554]">
              {popup.title}
            </DialogTitle>
            <DialogDescription className="mt-3 text-base leading-6 text-[#52627a]">
              {popup.body}
            </DialogDescription>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  closeWithEvent("cta_clicked");
                  router.push(popup.ctaHref);
                }}
                className="h-12 justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white shadow-[0_18px_32px_-24px_rgba(29,78,216,0.95)] hover:bg-primary/90"
              >
                {popup.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeWithEvent("dismissed")}
                  className="h-10 rounded-2xl border-[#dbe7ff] bg-white text-[#475569] hover:bg-[#f5f8ff]"
                >
                  {popup.dismissLabel}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => closeWithEvent("dont_show_again")}
                  className="h-10 rounded-2xl text-[#64748b] hover:bg-[#f5f8ff] hover:text-[#1d4ed8]"
                >
                  {popup.dontShowAgainLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
