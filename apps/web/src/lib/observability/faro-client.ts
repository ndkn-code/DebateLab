"use client";

import type { Faro, PushErrorOptions } from "@grafana/faro-web-sdk";
import {
  getWebInstrumentations,
  initializeFaro,
} from "@grafana/faro-web-sdk";
import { ReactIntegration } from "@grafana/faro-react";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

import {
  captureWithAnalyticsConsent,
  hasBrowserAnalyticsConsent,
} from "@/lib/analytics-consent";
import { getPracticeDebugId } from "@/lib/practice-debug-id";
import {
  sanitizeTelemetryItem,
  stripUrlQuery,
} from "@/lib/observability/faro-sanitize";

const APP_NAME = "thinkfy-web";

let faroInstance: Faro | null = null;

function releaseSha() {
  return process.env.NEXT_PUBLIC_APP_RELEASE_SHA?.trim() || "development";
}

function appEnvironment() {
  return (
    process.env.NEXT_PUBLIC_APP_ENV?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function initializeThinkfyFaro() {
  if (typeof window === "undefined") return null;
  if (!hasBrowserAnalyticsConsent()) return null;

  const collectorUrl =
    process.env.NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL?.trim();
  if (!collectorUrl) return null;

  if (faroInstance) {
    faroInstance.unpause();
    return faroInstance;
  }

  const release = releaseSha();
  faroInstance = initializeFaro({
    url: collectorUrl,
    app: {
      name: APP_NAME,
      environment: appEnvironment(),
      version: release,
      release,
      gitHash: release,
      bundleId: release,
    },
    beforeSend: (item) => sanitizeTelemetryItem(item),
    instrumentations: [
      ...getWebInstrumentations({ captureConsole: false }),
      new ReactIntegration(),
      new TracingInstrumentation({
        omitTraceContextForUnsampledSessions: true,
      }),
    ],
    sessionTracking: {
      enabled: true,
      persistent: false,
    },
  });

  faroInstance.api.setView({ name: stripUrlQuery(window.location.pathname) });
  return faroInstance;
}

export function pauseThinkfyFaro() {
  faroInstance?.pause();
  faroInstance?.api.setUser();
}

export function captureHandledError(
  error: unknown,
  context: Record<string, string | number | boolean | null | undefined> = {},
  options: Pick<PushErrorOptions, "fatal" | "fingerprint" | "type"> = {}
) {
  const faro = faroInstance;
  const consented = hasBrowserAnalyticsConsent();
  if (!faro || !consented) return;

  captureWithAnalyticsConsent(consented, () => {
    const normalizedError =
      error instanceof Error ? error : new Error("Handled application error");
    const safeContext = Object.fromEntries(
      Object.entries(context)
        .filter((entry): entry is [string, string | number | boolean] =>
          entry[1] !== null && entry[1] !== undefined
        )
        .map(([key, value]) => [key, String(value)])
    );

    faro.api.pushError(normalizedError, {
      ...options,
      context: sanitizeTelemetryItem(safeContext),
    });
  });
}

export function getFaroCorrelationContext() {
  if (typeof window === "undefined" || !faroInstance) {
    return {
      faroSessionId: "",
      traceId: "",
      releaseSha: releaseSha(),
      debugId: "",
    };
  }

  return {
    faroSessionId: faroInstance.metas.value.session?.id ?? "",
    traceId: faroInstance.api.getTraceContext()?.trace_id ?? "",
    releaseSha: releaseSha(),
    debugId: getPracticeDebugId("support"),
  };
}
