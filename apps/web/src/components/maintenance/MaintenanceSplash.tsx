"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock, Sparkles } from "@/components/ui/icons";
import { LogoMark } from "@/components/landing/logo-mark";
import { useInitialAppTheme } from "@/components/shared/theme-provider";
import { fetchPublicMaintenanceState } from "@/lib/maintenance/client";
import { localizedMessage, type MaintenanceState } from "@/lib/maintenance/model";

function formatExpectedBack(value: string | null, locale: string, soon: string) {
  if (!value) return soon;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return soon;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function MaintenanceSplash({
  initialState,
  locale,
}: {
  initialState: MaintenanceState;
  locale: "en" | "vi";
}) {
  const router = useRouter();
  const t = useTranslations("maintenance");
  const initialTheme = useInitialAppTheme();
  const [state, setState] = useState(initialState);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const nextState = await fetchPublicMaintenanceState();
        if (!mounted) return;
        if (nextState.mode !== "full") {
          router.replace(`/${locale}`);
          router.refresh();
          return;
        }
        setState(nextState);
      } catch {
        // Preserve the last known full-mode state while polling is unavailable.
      }
    };
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [locale, router]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background px-5 text-on-surface">
      <div className="pointer-events-none absolute -left-20 top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-12 size-72 rounded-full bg-secondary/10 blur-3xl" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-1 py-6 sm:px-4 sm:py-8">
        <LogoMark size="sm" priority variant={initialTheme === "dark" ? "dark" : "light"} />
      </header>

      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center pb-8 text-center sm:pb-12">
        <div className="relative flex h-64 w-full max-w-lg items-center justify-center sm:h-80">
          <div className="absolute inset-x-12 bottom-4 h-28 rounded-full bg-primary/10 blur-3xl" />
          {artFailed ? (
            <div className="flex size-40 items-center justify-center rounded-full bg-primary-container text-primary shadow-token-card sm:size-52">
              <Sparkles className="size-16 sm:size-20" aria-hidden="true" />
              <span className="sr-only">{t("artFallback")}</span>
            </div>
          ) : (
            <Image
              priority
              src="/brand/thinkfy/thinkfy-mascot-standing.png"
              alt={t("artAlt")}
              width={488}
              height={658}
              className="relative h-64 w-auto object-contain drop-shadow-xl sm:h-80"
              onError={() => setArtFailed(true)}
            />
          )}
        </div>

        <div className="-mt-2 max-w-2xl sm:-mt-4">
          <p className="type-eyebrow text-primary-dim">{t("badge")}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base font-semibold leading-relaxed text-on-surface-variant sm:text-lg">
            {localizedMessage(state.fullMessage, locale)}
          </p>
        </div>

        <div className="mt-8 flex min-w-72 items-center gap-4 rounded-3xl border border-outline-variant/40 bg-surface/80 p-3 pr-6 text-left shadow-token-card backdrop-blur sm:mt-10">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary-dim">
            <Clock className="size-7" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              {t("expectedBack")}
            </span>
            <time className="mt-1 block text-lg font-extrabold text-primary-dim">
              {formatExpectedBack(state.expectedDoneAt, locale, t("soon"))}
            </time>
          </span>
        </div>

        <footer className="mt-9 flex items-center gap-3 text-sm font-semibold text-on-surface-variant sm:mt-12">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary-container text-xl" aria-hidden="true">
            ☕
          </span>
          <span>{t("coffeeFooter")}</span>
        </footer>
      </section>
    </main>
  );
}
