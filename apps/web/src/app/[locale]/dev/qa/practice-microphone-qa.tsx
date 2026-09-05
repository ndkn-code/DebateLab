"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import SessionPage from "../../(protected)/practice/session/page";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store/session-store";
import { showcaseTopic } from "@/lib/admin-ui-showcase/fixtures";

// Mounted only by the existing development + localhost guarded /dev/qa route.
// No call reaches the physical microphone or a paid STT/analysis endpoint.
export function PracticeMicrophoneQa() {
  const locale = useLocale();
  const t = useTranslations("dashboard.practice");
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const scenario = params.get("mic") ?? "pending";
  const phase =
    params.get("phase") === "speaking"
      ? "speaking"
      : params.get("phase") === "prep"
        ? "prep"
        : "mic-check";

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    const originalFetch = window.fetch;
    const contexts: AudioContext[] = [];
    const streams: MediaStream[] = [];
    const pendingResolvers: Array<(stream: MediaStream) => void> = [];
    let behavior = scenario;
    let requests = 0;
    const synthetic = () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.connect(destination); // Never connected to speakers or microphone.
      oscillator.start();
      void context.resume();
      contexts.push(context);
      streams.push(destination.stream);
      return destination.stream;
    };
    navigator.mediaDevices.getUserMedia = async () => {
      requests += 1;
      if (behavior === "pending")
        return new Promise<MediaStream>((resolve) => {
          pendingResolvers.push(resolve);
        });
      if (behavior === "denied")
        throw new DOMException("QA denied", "NotAllowedError");
      if (behavior === "missing")
        throw new DOMException("QA no device", "NotFoundError");
      return synthetic();
    };
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/api/deepgram-token"))
        return Response.json(
          { error: "Controlled QA: STT disabled" },
          { status: 503 },
        );
      if (url.includes("/auth/v1/") || url.includes("/rest/v1/"))
        return Response.json({ user: null });
      if (
        url.includes("/api/practice-attempts") ||
        url.includes("/practice/feedback")
      )
        throw new Error("QA cannot submit analysis");
      return originalFetch(input, init);
    };
    Object.assign(window, {
      __micQa: {
        setBehavior: (value: string) => {
          behavior = value;
        },
        resolveLate: () => pendingResolvers.shift()?.(synthetic()),
        disconnect: () =>
          streams.forEach((stream) =>
            stream.getTracks().forEach((track) => {
              track.stop();
              track.dispatchEvent(new Event("ended"));
            }),
          ),
        snapshot: () => ({
          requests,
          tracks: streams.flatMap((stream) =>
            stream.getTracks().map((track) => track.readyState),
          ),
          state: {
            phase: useSessionStore.getState().currentPhase,
            transcript: useSessionStore.getState().transcript,
            notes: useSessionStore.getState().prepNotes,
          },
        }),
      },
    });
    useSessionStore.getState().restoreSessionDraft({
      selectedTopic: showcaseTopic,
      side: "proposition",
      practiceTrack: "debate",
      practiceLanguage: locale === "vi" ? "vi" : "en",
      mode: "quick",
      prepTime: 120,
      speechTime: 180,
      aiDifficulty: "medium",
      currentPhase: phase,
      currentRound: 1,
      prepNotes: "QA: retained preparation notes",
      transcript:
        phase === "speaking"
          ? "QA: previously recorded transcript stays available."
          : "",
      rounds: [],
      sessionStartTime: Date.now(),
      draftId: "",
    });
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => {
      window.clearTimeout(timer);
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      window.fetch = originalFetch;
      streams.forEach((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      contexts.forEach((context) => void context.close());
      delete (window as Window & { __micQa?: unknown }).__micQa;
    };
  }, [locale, phase, scenario]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-warning-container p-3 type-body-sm text-on-warning-container">
        <span>
          Local QA fixture · synthetic audio only · STT and analysis disabled
        </span>
        <Button
          variant="outline"
          onClick={() => {
            const qa = (
              window as Window & {
                __micQa?: { setBehavior: (value: string) => void };
              }
            ).__micQa;
            qa?.setBehavior("success");
          }}
        >
          {t("session.mic_retry")} (fixture ready)
        </Button>
      </div>
      {ready && <SessionPage />}
    </>
  );
}
