"use client";

import { useLocale } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Flame,
  Gift,
  Loader2,
  MessageCircle,
  Star,
  Target,
  X,
} from "@/components/ui/icons";
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
  SmartPopupFact,
  SmartPopupFactIcon,
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

const factIcons: Record<SmartPopupFactIcon, typeof Target> = {
  target: Target,
  chart: BarChart3,
  clock: Clock3,
  gift: Gift,
  book: BookOpen,
  chat: MessageCircle,
  flame: Flame,
};

interface SmartPopupFrameProps {
  open?: boolean;
  closeLabel: string;
  placement?: "center" | "top";
  onOpenChange?: (open: boolean) => void;
  onClose: () => void;
  children: ReactNode;
}

export function SmartPopupFrame({
  open = true,
  closeLabel,
  placement = "center",
  onOpenChange,
  onClose,
  children,
}: SmartPopupFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-smart-popup-frame
        className={cn(
          "max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[28px] border border-[#D6E3FA] bg-white p-0 text-[#172554] shadow-[0_32px_90px_-52px_rgba(11,20,36,0.75)] sm:w-[600px] sm:max-w-[600px]",
          placement === "top" &&
            "top-4 translate-y-0 sm:top-[7vh] sm:max-h-[calc(100dvh-14vh)]"
        )}
      >
        <button
          type="button"
          data-smart-popup-close
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#DEE8F8] bg-white/95 text-[#64748B] shadow-[0_12px_24px_-18px_rgba(11,20,36,0.75)] transition hover:bg-[#F1F6FD] hover:text-[#1D4ED8]"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{closeLabel}</span>
        </button>
        <div
          className={cn(
            "max-h-[calc(100dvh-1.5rem)] overflow-y-auto px-5 pb-5 pt-7 sm:px-14 sm:pb-8 sm:pt-9",
            placement === "top" && "sm:max-h-[calc(100dvh-14vh)]"
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CelebrationCluster({ tone = "default" }: { tone?: "default" | "reward" }) {
  const isReward = tone === "reward";
  return (
    <div className="relative mx-auto mb-4 h-[92px] w-[230px] sm:mb-5">
      <span className="absolute left-7 top-10 flex h-8 w-8 -rotate-12 items-center justify-center text-[#F5B942] drop-shadow-[0_8px_12px_rgba(245,185,66,0.25)]">
        <Star className="h-8 w-8 fill-current" />
      </span>
      <span className="absolute left-[88px] top-5 h-2.5 w-2.5 rounded-full bg-[#4D86F7]/80 shadow-[0_0_0_6px_rgba(77,134,247,0.10)]" />
      <span className="absolute right-[92px] top-2 h-2 w-2 rounded-full bg-[#A9C6FB]" />
      <span className="absolute right-7 top-9 flex h-8 w-8 items-center justify-center text-[#4D86F7]">
        <Star className="h-8 w-8" />
      </span>
      <span className="absolute left-[48px] top-2 h-2 w-2 rounded-full bg-[#4D86F7]" />
      <span className="absolute right-[54px] top-0 h-6 w-1.5 rotate-[35deg] rounded-full bg-[#4D86F7]" />
      <span className="absolute right-[36px] top-5 h-6 w-1.5 rotate-[60deg] rounded-full bg-[#4D86F7]" />
      <span
        className={cn(
          "absolute left-1/2 top-8 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-[0_18px_34px_-22px_rgba(16,185,129,0.95)]",
          isReward ? "bg-[#F5B942]" : "bg-[#34C759]"
        )}
      >
        {isReward ? <Gift className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
      </span>
    </div>
  );
}

export function SmartPopupFact({ fact }: { fact: SmartPopupFact }) {
  const Icon = factIcons[fact.icon] ?? Target;
  return (
    <div
      data-smart-popup-fact
      className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-[#F3F7FF] px-4 py-3 text-left shadow-[inset_0_-1px_0_rgba(77,134,247,0.08)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#BFD4FF] bg-white text-[#4D86F7]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-[#415069]">
          {fact.label}
        </span>
        {fact.value ? (
          <span className="mt-0.5 block truncate text-base font-extrabold text-[#0B1424]">
            {fact.value}
          </span>
        ) : null}
      </span>
    </div>
  );
}

interface SmartPopupActionsProps {
  primaryLabel: string;
  secondaryLabel: string;
  dontShowLabel: string;
  primaryIcon?: ReactNode;
  disabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onDontShow: () => void;
}

export function SmartPopupActions({
  primaryLabel,
  secondaryLabel,
  dontShowLabel,
  primaryIcon,
  disabled,
  onPrimary,
  onSecondary,
  onDontShow,
}: SmartPopupActionsProps) {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:mt-6">
      <Button
        type="button"
        disabled={disabled}
        data-smart-popup-primary
        onClick={onPrimary}
        className="h-14 justify-center gap-3 rounded-[18px] bg-[#4D86F7] text-base font-extrabold text-white shadow-[inset_0_-5px_0_#2F62D8,0_20px_38px_-28px_rgba(29,78,216,0.95)] hover:bg-[#3E78EC] active:translate-y-0.5 active:shadow-[inset_0_-2px_0_#2F62D8,0_14px_28px_-26px_rgba(29,78,216,0.95)]"
      >
        {primaryLabel}
        {primaryIcon ?? <ArrowRight className="h-5 w-5" />}
      </Button>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-smart-popup-secondary
          onClick={onSecondary}
          className="h-12 rounded-[18px] border-[#D6E3FA] bg-white text-sm font-extrabold text-[#4B5B74] hover:bg-[#F5F8FF] hover:text-[#1D4ED8]"
        >
          {secondaryLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          data-smart-popup-suppress
          onClick={onDontShow}
          className="h-12 rounded-[18px] text-sm font-bold text-[#64748B] hover:bg-[#F5F8FF] hover:text-[#1D4ED8]"
        >
          {dontShowLabel}
        </Button>
      </div>
    </div>
  );
}

interface FeatureNudgePopupProps {
  popup: SmartPopupPayload;
  onCta: () => void;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

export function FeatureNudgePopup({
  popup,
  onCta,
  onDismiss,
  onDontShowAgain,
}: FeatureNudgePopupProps) {
  return (
    <div className="text-center">
      <CelebrationCluster />
      {popup.eyebrow ? (
        <p className="text-sm font-extrabold text-[#2F62D8]">{popup.eyebrow}</p>
      ) : null}
      <DialogTitle className="mt-2 text-[2rem] font-extrabold leading-[1.08] tracking-normal text-[#0B1424] sm:text-[2.125rem]">
        {popup.title}
      </DialogTitle>
      <DialogDescription className="mx-auto mt-3 max-w-[440px] text-base font-medium leading-7 text-[#52627A]">
        {popup.body}
      </DialogDescription>
      {popup.facts.length > 0 ? (
        <div className="mx-auto mt-5 grid max-w-[420px] grid-cols-1 gap-3 sm:grid-cols-2">
          {popup.facts.map((fact, index) => (
            <SmartPopupFact key={`${fact.icon}-${fact.label}-${index}`} fact={fact} />
          ))}
        </div>
      ) : null}
      <SmartPopupActions
        primaryLabel={popup.ctaLabel}
        secondaryLabel={popup.dismissLabel}
        dontShowLabel={popup.dontShowAgainLabel}
        onPrimary={onCta}
        onSecondary={onDismiss}
        onDontShow={onDontShowAgain}
      />
    </div>
  );
}

interface SurveyPopupProps {
  popup: SmartPopupPayload;
  survey: SmartPopupSurveyPayload;
  submitting?: boolean;
  submitError?: string | null;
  renderQuestion: (question: LocalizedSurveyQuestion) => ReactNode;
  onSubmit: () => void;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

export function SurveyPopup({
  popup,
  survey,
  submitting,
  submitError,
  renderQuestion,
  onSubmit,
  onDismiss,
  onDontShowAgain,
}: SurveyPopupProps) {
  const rewardLabel =
    survey.rewardCredits > 0 ? ` +${survey.rewardCredits} Credits` : "";
  const submitLabel = submitting ? "Submitting..." : `${popup.ctaLabel}${rewardLabel}`;

  return (
    <div>
      <div className="text-center">
        <CelebrationCluster tone="reward" />
        {popup.eyebrow ? (
          <p className="text-sm font-extrabold text-[#2F62D8]">{popup.eyebrow}</p>
        ) : null}
        <DialogTitle className="mt-2 text-[1.9rem] font-extrabold leading-[1.08] tracking-normal text-[#0B1424] sm:text-[2.05rem]">
          {popup.title}
        </DialogTitle>
        <DialogDescription className="mx-auto mt-3 max-w-[430px] text-base font-medium leading-7 text-[#52627A]">
          {popup.body}
        </DialogDescription>
      </div>

      <div className="mt-5 space-y-4">
        {survey.questions.map((question, index) => (
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
        <div
          data-smart-popup-error
          className="mt-4 rounded-xl border border-[#F5C2C2] bg-[#FFF1F1] px-3 py-2 text-sm font-semibold text-[#A33A3A]"
        >
          {submitError}
        </div>
      ) : null}

      <SmartPopupActions
        primaryLabel={submitLabel}
        secondaryLabel={popup.dismissLabel}
        dontShowLabel={popup.dontShowAgainLabel}
        primaryIcon={
          submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )
        }
        disabled={submitting}
        onPrimary={onSubmit}
        onSecondary={onDismiss}
        onDontShow={onDontShowAgain}
      />
    </div>
  );
}

interface SurveyThankYouProps {
  title: string;
  body: string;
  rewardCredits: number;
  doneLabel?: string;
  onDone: () => void;
}

export function SurveyThankYou({
  title,
  body,
  rewardCredits,
  doneLabel = "Done",
  onDone,
}: SurveyThankYouProps) {
  return (
    <div className="text-center">
      <CelebrationCluster tone="reward" />
      <p className="text-sm font-extrabold text-[#2F62D8]">Feedback received</p>
      <DialogTitle className="mt-2 text-[2rem] font-extrabold leading-[1.08] tracking-normal text-[#0B1424] sm:text-[2.125rem]">
        {title}
      </DialogTitle>
      <DialogDescription className="mx-auto mt-3 max-w-[420px] text-base font-medium leading-7 text-[#52627A]">
        {body}
      </DialogDescription>
      <div className="mx-auto mt-5 max-w-[260px]">
        <SmartPopupFact
          fact={{
            icon: "gift",
            label: "Reward",
            value: `+${rewardCredits} Credits`,
          }}
        />
      </div>
      <Button
        type="button"
        data-smart-popup-primary
        onClick={onDone}
        className="mt-6 h-14 w-full justify-center rounded-[18px] bg-[#4D86F7] text-base font-extrabold text-white shadow-[inset_0_-5px_0_#2F62D8,0_20px_38px_-28px_rgba(29,78,216,0.95)] hover:bg-[#3E78EC]"
      >
        {doneLabel}
      </Button>
    </div>
  );
}

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
    <SmartPopupFrame
      open={open}
      closeLabel={popup.dismissLabel}
      placement={isSurveyPopup ? "top" : "center"}
      onClose={() => closeWithEvent(getCloseEvent())}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeWithEvent(getCloseEvent());
        } else {
          setOpen(true);
        }
      }}
    >
      {isSurveyPopup && popup.survey ? (
        submitted ? (
          <SurveyThankYou
            title={submitResult?.thankYou?.title ?? popup.survey.thankYou.title}
            body={submitResult?.thankYou?.body ?? popup.survey.thankYou.body}
            rewardCredits={submitResult?.rewardCredits ?? popup.survey.rewardCredits}
            onDone={() => setOpen(false)}
          />
        ) : (
          <SurveyPopup
            popup={popup}
            survey={popup.survey}
            submitting={submitting}
            submitError={submitError}
            renderQuestion={renderQuestion}
            onSubmit={() => submitSurvey(popup.survey!)}
            onDismiss={() => closeWithEvent(getCloseEvent())}
            onDontShowAgain={() => closeWithEvent("dont_show_again")}
          />
        )
      ) : (
        <FeatureNudgePopup
          popup={popup}
          onCta={() => {
            closeWithEvent("cta_clicked");
            router.push(popup.ctaHref);
          }}
          onDismiss={() => closeWithEvent("dismissed")}
          onDontShowAgain={() => closeWithEvent("dont_show_again")}
        />
      )}
    </SmartPopupFrame>
  );
}
