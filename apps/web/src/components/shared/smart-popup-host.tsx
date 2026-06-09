"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
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

type ReminderOptInResponse = {
  ok?: boolean;
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
  portalContainer?: HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null;
  onOpenChange?: (open: boolean) => void;
  onClose: () => void;
  children: ReactNode;
}

export function SmartPopupFrame({
  open = true,
  closeLabel,
  placement = "center",
  portalContainer,
  onOpenChange,
  onClose,
  children,
}: SmartPopupFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-smart-popup-frame
        portalContainer={portalContainer}
        className={cn(
          "max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-4rem)] max-w-[calc(100vw-4rem)] overflow-hidden rounded-[28px] border border-outline-variant bg-white p-0 text-on-surface-variant shadow-token-card sm:w-[600px] sm:max-w-[600px]",
          placement === "top" &&
            "top-4 translate-y-0 sm:top-[7vh] sm:max-h-[calc(100dvh-14vh)]"
        )}
      >
        <button
          type="button"
          data-smart-popup-close
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-white/95 text-on-surface-variant shadow-token-card transition hover:bg-surface-container hover:text-on-surface-variant"
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
      <span className="absolute left-7 top-10 flex h-8 w-8 -rotate-12 items-center justify-center text-warning drop-shadow-token-card">
        <Star className="h-8 w-8 fill-current" />
      </span>
      <span className="absolute left-[88px] top-5 h-2.5 w-2.5 rounded-full bg-primary/80 shadow-token-primary" />
      <span className="absolute right-[92px] top-2 h-2 w-2 rounded-full bg-primary-fixed" />
      <span className="absolute right-7 top-9 flex h-8 w-8 items-center justify-center text-primary">
        <Star className="h-8 w-8" />
      </span>
      <span className="absolute left-[48px] top-2 h-2 w-2 rounded-full bg-primary" />
      <span className="absolute right-[54px] top-0 h-6 w-1.5 rotate-[35deg] rounded-full bg-primary" />
      <span className="absolute right-[36px] top-5 h-6 w-1.5 rotate-[60deg] rounded-full bg-primary" />
      <span
        className={cn(
          "absolute left-1/2 top-8 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-token-card",
          isReward ? "bg-warning" : "bg-success"
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
      className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-surface-container px-4 py-3 text-left shadow-token-primary"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-white text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-on-surface-variant">
          {fact.label}
        </span>
        {fact.value ? (
          <span className="mt-0.5 block truncate text-base font-extrabold text-on-surface">
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
  primaryIcon?: ReactNode;
  disabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}

export function SmartPopupActions({
  primaryLabel,
  secondaryLabel,
  primaryIcon,
  disabled,
  onPrimary,
  onSecondary,
}: SmartPopupActionsProps) {
  return (
    <div className="mx-auto mt-5 flex max-w-[440px] flex-col gap-3 sm:mt-6">
      <Button
        type="button"
        disabled={disabled}
        data-smart-popup-primary
        onClick={onPrimary}
        className="h-14 justify-center gap-3 rounded-[18px] bg-primary text-base font-extrabold text-white shadow-token-card hover:bg-primary-dim active:translate-y-0.5 active:shadow-token-card"
      >
        {primaryLabel}
        {primaryIcon ?? <ArrowRight className="h-5 w-5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        data-smart-popup-secondary
        onClick={onSecondary}
        className="h-11 rounded-[18px] text-sm font-extrabold text-primary hover:bg-primary-container hover:text-primary"
      >
        {secondaryLabel}
      </Button>
    </div>
  );
}

export function SmartPopupIllustration({
  src,
  alt,
  tone = "default",
}: {
  src: string;
  alt: string;
  tone?: "default" | "reward";
}) {
  return (
    <div
      className={cn(
        "relative mx-auto mb-4 h-[132px] w-[172px] overflow-hidden rounded-[22px] sm:mb-5 sm:h-[150px] sm:w-[196px]",
        tone === "reward" ? "bg-warning/10" : "bg-primary-container/70"
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="196px"
        className="object-contain p-1.5"
        priority
      />
    </div>
  );
}

interface FeatureNudgePopupProps {
  popup: SmartPopupPayload;
  ctaLoading?: boolean;
  ctaError?: string | null;
  onCta: () => void;
  onDismiss: () => void;
}

export function FeatureNudgePopup({
  popup,
  ctaLoading,
  ctaError,
  onCta,
  onDismiss,
}: FeatureNudgePopupProps) {
  return (
    <div className="text-center">
      <SmartPopupIllustration src={popup.imageSrc} alt={popup.imageAlt} />
      {popup.eyebrow ? (
        <p className="text-sm font-extrabold text-primary">{popup.eyebrow}</p>
      ) : null}
      <DialogTitle className="mt-2 text-[2rem] font-extrabold leading-[1.08] tracking-normal text-on-surface sm:text-[2.125rem]">
        {popup.title}
      </DialogTitle>
      <DialogDescription className="mx-auto mt-3 max-w-[440px] text-base font-medium leading-7 text-on-surface-variant">
        {popup.body}
      </DialogDescription>
      {popup.facts.length > 0 ? (
        <div className="mx-auto mt-5 grid max-w-[420px] grid-cols-1 gap-3 sm:grid-cols-2">
          {popup.facts.map((fact, index) => (
            <SmartPopupFact key={`${fact.icon}-${fact.label}-${index}`} fact={fact} />
          ))}
        </div>
      ) : null}
      {ctaError ? (
        <div className="mx-auto mt-4 max-w-[420px] rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface-variant">
          {ctaError}
        </div>
      ) : null}
      <SmartPopupActions
        primaryLabel={ctaLoading ? "Saving..." : popup.ctaLabel}
        secondaryLabel={popup.dismissLabel}
        primaryIcon={
          ctaLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )
        }
        disabled={ctaLoading}
        onPrimary={onCta}
        onSecondary={onDismiss}
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
}

export function SurveyPopup({
  popup,
  survey,
  submitting,
  submitError,
  renderQuestion,
  onSubmit,
  onDismiss,
}: SurveyPopupProps) {
  const rewardLabel =
    survey.rewardCredits > 0 ? ` +${survey.rewardCredits} Credits` : "";
  const submitLabel = submitting ? "Submitting..." : `${popup.ctaLabel}${rewardLabel}`;

  return (
    <div>
      <div className="text-center">
        <SmartPopupIllustration
          src={popup.imageSrc}
          alt={popup.imageAlt}
          tone="reward"
        />
        {popup.eyebrow ? (
          <p className="text-sm font-extrabold text-primary">{popup.eyebrow}</p>
        ) : null}
        <DialogTitle className="mt-2 text-[1.9rem] font-extrabold leading-[1.08] tracking-normal text-on-surface sm:text-[2.05rem]">
          {popup.title}
        </DialogTitle>
        <DialogDescription className="mx-auto mt-3 max-w-[430px] text-base font-medium leading-7 text-on-surface-variant">
          {popup.body}
        </DialogDescription>
      </div>

      <div className="mt-5 space-y-4">
        {survey.questions.map((question, index) => (
          <div key={question.id} className="space-y-2">
            <div>
              <p className="text-sm font-extrabold text-on-surface-variant">
                {index + 1}. {question.label}
                {question.required ? <span className="text-error"> *</span> : null}
              </p>
              {question.description ? (
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
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
          className="mt-4 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface-variant"
        >
          {submitError}
        </div>
      ) : null}

      <SmartPopupActions
        primaryLabel={submitLabel}
        secondaryLabel={popup.dismissLabel}
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
      <p className="text-sm font-extrabold text-on-surface-variant">Feedback received</p>
      <DialogTitle className="mt-2 text-[2rem] font-extrabold leading-[1.08] tracking-normal text-on-surface sm:text-[2.125rem]">
        {title}
      </DialogTitle>
      <DialogDescription className="mx-auto mt-3 max-w-[420px] text-base font-medium leading-7 text-on-surface-variant">
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
        className="mt-6 h-14 w-full justify-center rounded-[18px] bg-primary text-base font-extrabold text-white shadow-token-card hover:bg-primary-dim"
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
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [ctaLoading, setCtaLoading] = useState(false);
  const lastRequestKeyRef = useRef<string | null>(null);
  const handledCloseRef = useRef(false);
  const surveyStartedRef = useRef<string | null>(null);
  const suppressed = paused || isSuppressedPath(pathname);
  const isSurveyPopup = popup?.campaignType === "feedback_survey" && popup.survey;
  const isReminderOptIn = popup?.popupKind === "reminder_opt_in";
  const surface = resolveSurface(pathname);

  const trackEvent = useCallback(
    (
      eventType: Exclude<SmartPopupEventType, "impression">,
      metadata: Record<string, unknown> = {}
    ) => {
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
          metadata: {
            ...popup.metadata,
            actionSource: "smart_popup",
            ...metadata,
          },
        }),
      }).catch(() => undefined);
    },
    [pathname, popup]
  );

  const closeWithEvent = useCallback(
    (
      eventType: Exclude<SmartPopupEventType, "impression">,
      metadata: Record<string, unknown> = {}
    ) => {
      if (handledCloseRef.current) {
        setOpen(false);
        return;
      }
      handledCloseRef.current = true;
      trackEvent(eventType, metadata);
      setOpen(false);
    },
    [trackEvent]
  );

  useEffect(() => {
    if (!suppressed || !open || !popup) return;
    const timer = window.setTimeout(
      () => closeWithEvent("dismissed", { dismissMethod: "suppressed_route" }),
      0
    );
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
        setCtaError(null);
        setCtaLoading(false);
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
    trackEvent("survey_started", { actionSource: "survey_form" });
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

  async function handlePrimaryCta() {
    if (!popup || ctaLoading) return;

    if (!isReminderOptIn) {
      closeWithEvent("cta_clicked", {
        actionSource: "primary_button",
        ctaOutcome: "navigate",
      });
      router.push(popup.ctaHref);
      return;
    }

    setCtaError(null);
    setCtaLoading(true);
    try {
      const res = await fetch("/api/client/smart-popups/reminder-opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignKey: popup.key,
          locale,
          route: pathname,
          surface: popup.surface,
          metadata: popup.metadata,
        }),
      });
      const payload = (await res.json()) as ReminderOptInResponse;
      if (!res.ok || payload.error) {
        throw new Error(payload.error ?? "Unable to enable reminders.");
      }
      closeWithEvent("cta_clicked", {
        actionSource: "primary_button",
        ctaOutcome: "reminder_email_opt_in",
      });
    } catch (error) {
      setCtaError(
        error instanceof Error ? error.message : "Unable to enable reminders."
      );
    } finally {
      setCtaLoading(false);
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
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-outline-variant bg-white text-on-surface-variant hover:border-primary-fixed hover:bg-background"
                  )}
                >
                  {rating}
                </button>
              );
            })}
          </div>
          {(question.minLabel || question.maxLabel) ? (
            <div className="flex justify-between gap-3 text-xs font-semibold text-on-surface-variant">
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
                    ? "border-primary bg-primary-container text-on-surface"
                    : "border-outline-variant bg-white text-on-surface-variant hover:border-primary-fixed"
                )}
              >
                <span>{option.label}</span>
                {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
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
        className="min-h-24 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary-fixed/40"
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
      onClose={() =>
        closeWithEvent(getCloseEvent(), { dismissMethod: "close_button" })
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeWithEvent(getCloseEvent(), { dismissMethod: "modal_close" });
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
            onDismiss={() =>
              closeWithEvent(getCloseEvent(), {
                dismissMethod: "secondary_button",
              })
            }
          />
        )
      ) : (
        <FeatureNudgePopup
          popup={popup}
          ctaLoading={ctaLoading}
          ctaError={ctaError}
          onCta={handlePrimaryCta}
          onDismiss={() =>
            closeWithEvent("dismissed", {
              dismissMethod: "secondary_button",
            })
          }
        />
      )}
    </SmartPopupFrame>
  );
}
