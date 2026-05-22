"use client";

import { useReportWebVitals } from "next/web-vitals";
import { inferFeatureAreaFromRoute } from "@/lib/analytics/events";

type WebVitalsMetric = Parameters<typeof useReportWebVitals>[0] extends (
  metric: infer T
) => void
  ? T
  : never;

function summarizeEntry(entry: PerformanceEntry) {
  const record: Record<string, string | number> = {
    entryType: entry.entryType,
    startTime: Math.round(entry.startTime),
    duration: Math.round(entry.duration),
  };

  if ("name" in entry && typeof entry.name === "string" && entry.name) {
    const safeName = sanitizeEntryName(entry.name);
    if (safeName) record.name = safeName;
  }

  if ("initiatorType" in entry && typeof entry.initiatorType === "string") {
    record.initiatorType = entry.initiatorType;
  }

  return record;
}

function sanitizeEntryName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const looksLikeUrl =
    /^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/");

  if (!looksLikeUrl) {
    return trimmed.split(/[?#]/, 1)[0]?.slice(0, 160) ?? null;
  }

  try {
    const url = new URL(trimmed, window.location.origin);
    const pathname = url.pathname.slice(0, 140);
    return url.origin === window.location.origin
      ? pathname
      : `${url.origin}${pathname}`.slice(0, 160);
  } catch {
    return trimmed.split(/[?#]/, 1)[0]?.slice(0, 160) ?? null;
  }
}

function postWebVital(metric: WebVitalsMetric) {
  const route = window.location.pathname;
  const metricName = metric.name;
  const isCls = metricName === "CLS";
  const metadata = {
    metricName,
    metricId: metric.id,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    route,
    navigationType: metric.navigationType,
    attribution: metric.entries?.slice(-3).map(summarizeEntry) ?? [],
  };
  const body = JSON.stringify({
    eventName: "web_vital_recorded",
    featureArea: inferFeatureAreaFromRoute(route),
    route,
    durationMs: isCls ? null : Math.round(metric.value),
    metadata,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/events", blob);
    return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function WebVitalsReporter() {
  useReportWebVitals(postWebVital);
  return null;
}
