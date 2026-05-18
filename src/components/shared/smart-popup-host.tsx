"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BellRing, CheckCircle2, Gift, Loader2, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  SmartPopupEventType,
  SmartPopupPayload,
  SmartPopupSurveyPayload,
} from "@/lib/smart-popups/types";
import type { LocalizedSurveyQuestion } from "@/lib/smart-popups/survey";

interface SmartPopupHostProps {
  paused?: boolean;
}

type SmartPopupResponse = {
  popup?: SmartPopupPayload | null;
};

type AnswerValue = number | string | string[];
type AnswerState = Record<string, AnswerValue>;

type SurveySubmitResponse = {
  ok?: boolean;
  rewardCredits?: number;
  newBalance?: number | null;
  thankYou?: {
    title: string;
    body: string;
  };
  error?: string;
};

function isSuppressedPath(pathname: string | null) {
  const path = (pathname ?? "").toLowerCase();

  if (!path || path === "/") return true;
  if (path.includes("/auth") || path.includes("/onboarding")) return true;
  if (path.includes("/dashboard/admin") || path.includes("/admin")) return true;
  if (path.includes("/practice/session")) return true;

  return false;
}

function resolveSurface(pathname: string | null) {
  const path = (pathname ?? "").toLowerCase();
  return path === "/dashboard" || path.endsWith("/dashboard")
    ? "dashboard"
    : "global";
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
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SurveySubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastRequestKeyRef = useRef<string | null>(null);
  const handledCloseRef = useRef(false);
  const surveyStartedRef = useRef<string | null>(null);
  const suppressed = paused || isSuppressedPath(pathname);
  const isSurveyPopup = popup?.campaignType === "feedback_survey" && popup.survey;
  const surface = resolveSurface(pathname);

  const trackEvent = useCallback(
    (eventType: Exclude<SmartPopupEventType, "impression">) => {
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
    (eventType: Exclude<SmartPopupEventType, "impression">) => {
      if (handledCloseRef.current) {
        setOpen(false);
        return;
      }
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
          surface,
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
            surface,
          }),
        });

        if (!commitRes.ok || controller.signal.aborted) return;
        const committed = (await commitRes.json()) as SmartPopupResponse;
        if (!committed.popup) return;

        handledCloseRef.current = false;
        setPopup(committed.popup);
        setAnswers({});
        setSubmitted(false);
        setSubmitResult(null);
        setSubmitError(null);
        surveyStartedRef.current = null;
        setOpen(true);
      } catch {
        // Popup eligibility is opportunistic; failures should never block the page.
      }
    }, 950);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locale, pathname, suppressed, surface]);

  useEffect(() => {
    if (!open || !popup || !isSurveyPopup) return;
    if (surveyStartedRef.current === popup.key) return;
    surveyStartedRef.current = popup.key;
    trackEvent("survey_started");
  }, [isSurveyPopup, open, popup, trackEvent]);

  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter((value) => {
        if (Array.isArray(value)) return value.length > 0;
        return value !== "";
      }).length,
    [answers]
  );

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function getCloseEvent() {
    if (submitted) return "survey_submitted" as const;
    if (isSurveyPopup && answeredCount > 0) return "survey_abandoned" as const;
    return "dismissed" as const;
  }

  async function submitSurvey(survey: SmartPopupSurveyPayload) {
    if (!popup || submitting) return;
    setSubmitError(null);

    const missing = survey.questions.find((question) => {
      if (!question.required) return false;
      const value = answers[question.id];
      if (Array.isArray(value)) return value.length === 0;
      return value == null || value === "";
    });

    if (missing) {
      setSubmitError("Please answer every required question before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/client/smart-popups/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignKey: popup.key,
          surveyVersionId: survey.versionId,
          impressionEventId:
            typeof popup.metadata.impressionEventId === "string"
              ? popup.metadata.impressionEventId
              : undefined,
          locale,
          route: pathname,
          surface: popup.surface,
          answers: survey.questions.map((question) => ({
            questionId: question.id,
            value: answers[question.id] ?? "",
          })),
          context: {
            answeredCount,
          },
        }),
      });
      const payload = (await res.json()) as SurveySubmitResponse;
      if (!res.ok || payload.error) {
        throw new Error(payload.error ?? "Unable to submit feedback.");
      }
      handledCloseRef.current = true;
      setSubmitted(true);
      setSubmitResult(payload);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to submit feedback."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestion(question: LocalizedSurveyQuestion) {
    const value = answers[question.id];

    if (question.type === "rating" || question.type === "nps") {
      const min = question.min ?? (question.type === "nps" ? 0 : 1);
      const max = question.max ?? (question.type === "nps" ? 10 : 5);
      const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {values.map((rating) => {
              const selected = value === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setAnswer(question.id, rating)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border text-sm font-extrabold transition",
                    selected
                      ? "border-[#4D86F7] bg-[#4D86F7] text-white shadow-sm"
                      : "border-[#DEE8F8] bg-white text-[#415069] hover:border-[#A9C6FB] hover:bg-[#F7FAFE]"
                  )}
                >
                  {rating}
                </button>
              );
            })}
          </div>
          {(question.minLabel || question.maxLabel) ? (
            <div className="flex justify-between gap-3 text-xs font-semibold text-[#718096]">
              <span>{question.minLabel}</span>
              <span>{question.maxLabel}</span>
            </div>
          ) : null}
        </div>
      );
    }

    if (question.type === "single_choice" || question.type === "multi_choice") {
      const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      return (
        <div className="grid gap-2">
          {(question.options ?? []).map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (question.type === "single_choice") {
                    setAnswer(question.id, option.id);
                    return;
                  }
                  setAnswer(
                    question.id,
                    active
                      ? selected.filter((item) => item !== option.id)
                      : [...selected, option.id]
                  );
                }}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                  active
                    ? "border-[#4D86F7] bg-[#EDF4FF] text-[#0B1424]"
                    : "border-[#DEE8F8] bg-white text-[#415069] hover:border-[#A9C6FB]"
                )}
              >
                <span>{option.label}</span>
                {active ? <CheckCircle2 className="h-4 w-4 text-[#4D86F7]" /> : null}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(event) => setAnswer(question.id, event.target.value)}
        placeholder={question.placeholder}
        className="min-h-24 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 py-2 text-sm text-[#162033] outline-none transition placeholder:text-[#8A96A8] focus:border-[#4D86F7] focus:ring-2 focus:ring-[#A9C6FB]/40"
      />
    );
  }

  if (!popup) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeWithEvent(getCloseEvent());
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
          onClick={() => closeWithEvent(getCloseEvent())}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#64748b] shadow-sm transition hover:bg-[#edf3ff] hover:text-[#1d4ed8]"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{popup.dismissLabel}</span>
        </button>

        {isSurveyPopup && popup.survey ? (
          <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto px-6 pb-6 pt-6">
            {submitted ? (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16833A]">
                  <Gift className="h-8 w-8" />
                </div>
                <DialogTitle className="mt-5 text-2xl font-bold leading-tight tracking-normal text-[#172554]">
                  {submitResult?.thankYou?.title ?? popup.survey.thankYou.title}
                </DialogTitle>
                <DialogDescription className="mt-3 text-base leading-6 text-[#52627a]">
                  {submitResult?.thankYou?.body ?? popup.survey.thankYou.body}
                </DialogDescription>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#EDF4FF] px-4 py-2 text-sm font-extrabold text-[#3E78EC]">
                  <CheckCircle2 className="h-4 w-4" />
                  +{submitResult?.rewardCredits ?? popup.survey.rewardCredits} Credits
                </div>
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 h-11 w-full rounded-2xl"
                >
                  Done
                </Button>
              </div>
            ) : (
              <>
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

                <div className="mt-5 rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 py-2 text-sm font-semibold text-[#415069]">
                  Complete this feedback to earn {popup.survey.rewardCredits} Credits.
                </div>

                <div className="mt-5 space-y-5">
                  {popup.survey.questions.map((question, index) => (
                    <div key={question.id} className="space-y-2">
                      <div>
                        <p className="text-sm font-extrabold text-[#172554]">
                          {index + 1}. {question.label}
                          {question.required ? <span className="text-[#EF6A6A]"> *</span> : null}
                        </p>
                        {question.description ? (
                          <p className="mt-1 text-xs leading-5 text-[#718096]">
                            {question.description}
                          </p>
                        ) : null}
                      </div>
                      {renderQuestion(question)}
                    </div>
                  ))}
                </div>

                {submitError ? (
                  <div className="mt-4 rounded-lg border border-[#F5C2C2] bg-[#FFF1F1] px-3 py-2 text-sm font-semibold text-[#A33A3A]">
                    {submitError}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-2">
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => submitSurvey(popup.survey!)}
                    className="h-12 justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white shadow-[0_18px_32px_-24px_rgba(29,78,216,0.95)] hover:bg-primary/90"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                    Submit feedback
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => closeWithEvent(getCloseEvent())}
                      className="h-10 rounded-2xl border-[#dbe7ff] bg-white text-[#475569] hover:bg-[#f5f8ff]"
                    >
                      {popup.dismissLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => closeWithEvent("dont_show_again")}
                      className="h-10 rounded-2xl text-[#64748b] hover:bg-[#f5f8ff] hover:text-[#1d4ed8]"
                    >
                      {popup.dontShowAgainLabel}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
