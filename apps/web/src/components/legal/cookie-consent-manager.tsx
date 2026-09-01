"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ANALYTICS_COOKIE_MAX_AGE,
  ANALYTICS_COOKIE_NAME,
  getAnalyticsCookieValue,
} from "@/lib/settings";
import type { PublicLocale } from "@/lib/public-site";
import { saveAnalyticsConsentPreferenceAction } from "@/app/actions/analytics-consent";

type ConsentState = "granted" | "denied" | null;

function readConsent(): ConsentState {
  const prefix = `${ANALYTICS_COOKIE_NAME}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return value === "granted" || value === "denied" ? value : null;
}

function writeConsent(enabled: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ANALYTICS_COOKIE_NAME}=${getAnalyticsCookieValue(enabled)}; Path=/; Max-Age=${ANALYTICS_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function CookieConsentManager({
  locale,
  mode = "banner",
}: {
  locale: PublicLocale;
  mode?: "banner" | "settings";
}) {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedConsent = readConsent();
      setConsent(storedConsent);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const choose = async (enabled: boolean) => {
    writeConsent(enabled);
    setConsent(getAnalyticsCookieValue(enabled));
    await saveAnalyticsConsentPreferenceAction(enabled);
    window.location.reload();
  };

  if (!hydrated || (mode === "banner" && consent !== null)) return null;

  const vi = locale === "vi";
  const controls = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => choose(false)}
        className="inline-flex min-h-10 items-center justify-center rounded-control border border-outline px-3 type-label font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {vi ? "Từ chối phân tích" : "Reject analytics"}
      </button>
      <button
        type="button"
        onClick={() => choose(true)}
        className="inline-flex min-h-10 items-center justify-center rounded-control bg-on-surface px-3 type-label font-semibold text-surface hover:bg-on-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {vi ? "Đồng ý phân tích" : "Accept analytics"}
      </button>
    </div>
  );

  if (mode === "settings") {
    return (
      <div className="mt-5 rounded-control border border-outline-variant bg-surface-container-low p-4">
        <p className="type-body-sm text-on-surface-variant" aria-live="polite">
          {vi ? "Lựa chọn hiện tại" : "Current choice"}:{" "}
          {consent === "granted"
            ? vi
              ? "Đã đồng ý"
              : "Accepted"
            : consent === "denied"
              ? vi
                ? "Đã từ chối"
                : "Rejected"
              : vi
                ? "Chưa chọn"
                : "Not selected"}
        </p>
        <div className="mt-3">{controls}</div>
      </div>
    );
  }

  return (
    <aside
      aria-label={vi ? "Lựa chọn cookie" : "Cookie choices"}
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-outline bg-surface p-4 shadow-xl sm:bottom-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="max-w-xl">
        <p className="type-title font-semibold">
          {vi
            ? "Bạn kiểm soát dữ liệu phân tích"
            : "You control optional analytics"}
        </p>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {vi
            ? "Thinkfy luôn dùng lưu trữ thiết yếu. Chúng tôi chỉ bật PostHog và đo hiệu năng sau khi bạn đồng ý."
            : "Thinkfy always uses essential storage. We enable PostHog and performance measurement only after you consent."}{" "}
          <Link
            className="text-secondary underline underline-offset-4"
            href={`/${locale}/cookies`}
          >
            {vi ? "Xem chi tiết" : "Learn more"}
          </Link>
        </p>
      </div>
      <div className="mt-4 shrink-0 sm:mt-0">{controls}</div>
    </aside>
  );
}
