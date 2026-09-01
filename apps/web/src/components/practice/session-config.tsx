"use client";

import type { ElementType, ReactNode } from "react";
import { useId, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  AlertCircle,
  Loader2,
  Minus,
  Plus,
  Scale,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Heading, Text } from "@/components/ui/typography";
import { CategoryVisual } from "@/components/practice/category-visual";
import { CREDIT_ICON_SRC } from "@/components/dashboard/dashboard-stats-panel";
import { OutOfOrbsModal } from "@/components/shared/out-of-orbs-modal";
import { deductOrbsAction, getOrbBalanceAction } from "@/app/actions/orbs";
import {
  clampDurationSeconds,
  secondsToMinutes,
  type DurationConfig,
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
} from "@/lib/practice-durations";
import { useSessionStore } from "@/store/session-store";
import { getDisplayMotionBrief } from "@/lib/motion-brief";
import {
  clearLocalPracticeSessionDraft,
  clearStoredPracticeDraftId,
  setPendingPracticeSessionHandoff,
  type PracticeSessionDraftPayload,
} from "@/lib/practice-session-drafts";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import { getTopicCategoryKey } from "@/lib/topics";
import { cn } from "@/lib/utils";
import type { DebateRound, DebateTopic } from "@/types";

interface SessionConfigProps {
  topic: DebateTopic;
  isBookmarked: boolean;
  onToggleBookmark: (topicId: string) => void;
  orbBalance: number | null;
  referralCode: string;
  onBalanceChange: (balance: number) => void;
  layout?: "desktop" | "mobile";
  showcaseMode?: boolean;
}

function BeginSessionTransition({
  show,
  label,
}: {
  show: boolean;
  label: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-primary/95 p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-h-10 items-center gap-3 rounded-xl border border-on-primary/20 bg-surface px-4 py-3 text-on-surface shadow-token-card">
            <Loader2
              className={cn(
                "size-4 text-primary",
                !reduceMotion && "animate-spin",
              )}
              aria-hidden
            />
            <span className="type-label font-semibold">{label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SegmentOption<Value extends string> {
  value: Value;
  label: string;
  icon?: ElementType;
  disabled?: boolean;
}

function SegmentedControl<Value extends string>({
  value,
  options,
  onChange,
}: {
  value: Value;
  options: Array<SegmentOption<Value>>;
  onChange: (next: Value) => void;
}) {
  const groupId = useId();

  return (
    <div
      className="grid gap-1 rounded-control bg-surface-container p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex min-h-8 items-center justify-center gap-1.5 rounded-[8px] px-2 py-1 type-body-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface",
              option.disabled &&
                "cursor-not-allowed opacity-45 hover:text-on-surface-variant",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={`segment-${groupId}`}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 rounded-[8px] bg-surface-container-lowest shadow-none ring-1 ring-secondary/30"
              />
            ) : null}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon ? <Icon className="h-[15px] w-[15px]" /> : null}
              <span className="truncate">{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ConfigField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <Text variant="label" as="p" className="font-bold text-on-surface">
        {label}
      </Text>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function TimeStepper({
  label,
  value,
  config,
  unitLabel,
  onChange,
}: {
  label: string;
  value: number;
  config: DurationConfig;
  unitLabel: (minutes: number) => string;
  onChange: (seconds: number) => void;
}) {
  const bounded = clampDurationSeconds(value, config);
  const minutes = secondsToMinutes(bounded);

  const step = (direction: 1 | -1) =>
    onChange(
      clampDurationSeconds(bounded + direction * config.stepSeconds, config),
    );

  return (
    <div className="rounded-control border border-outline-variant bg-surface-container-lowest p-3">
      <Text variant="label" as="p" className="font-bold text-on-surface">
        {label}
      </Text>
      <div className="mt-3 flex items-center justify-between gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={() => step(-1)}
          disabled={bounded <= config.minSeconds}
          aria-label={`− ${label}`}
          className="flex size-8 items-center justify-center rounded-[8px] bg-surface-container text-on-surface-variant transition-colors hover:bg-secondary-container hover:text-secondary disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Minus className="h-4 w-4" />
        </motion.button>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={minutes}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.16 }}
            className="type-body font-extrabold tabular-nums text-on-surface"
          >
            {unitLabel(minutes)}
          </motion.span>
        </AnimatePresence>

        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={() => step(1)}
          disabled={bounded >= config.maxSeconds}
          aria-label={`+ ${label}`}
          className="flex size-8 items-center justify-center rounded-[8px] bg-surface-container text-on-surface-variant transition-colors hover:bg-secondary-container hover:text-secondary disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

const DIFFICULTY_CHIP_STYLES = {
  easy: "bg-success-container text-success-dim dark:text-success",
  medium: "bg-warning-container text-on-warning-container",
  hard: "bg-error-container text-error-dim dark:text-error",
} as const;

function getDifficultyChip(difficulty: DebateTopic["difficulty"]) {
  if (difficulty === "advanced") {
    return { tone: "hard", labelKey: "card_hard" } as const;
  }

  if (difficulty === "intermediate") {
    return { tone: "medium", labelKey: "card_medium" } as const;
  }

  return { tone: "easy", labelKey: "card_easy" } as const;
}

export function SessionConfig({
  topic,
  isBookmarked,
  onToggleBookmark,
  orbBalance,
  referralCode,
  onBalanceChange,
  layout = "desktop",
  showcaseMode = false,
}: SessionConfigProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.practice");
  const locale = useLocale();
  const [showOrbModal, setShowOrbModal] = useState(false);
  const [isDeducting, setIsDeducting] = useState(false);
  const [showBeginTransition, setShowBeginTransition] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const {
    side,
    practiceTrack,
    mode,
    prepTime,
    speechTime,
    aiHints,
    aiDifficulty,
    setSide,
    setPracticeTrack,
    setMode,
    setPrepTime,
    setSpeechTime,
    setAiHints,
    setAiDifficulty,
    setTopic,
    startSession,
  } = useSessionStore();

  const orbCost = practiceTrack === "debate" ? 200 : 100;
  const motionBrief = getDisplayMotionBrief(
    topic,
    locale === "vi" ? "vi" : "en",
  );
  const categoryKey = getTopicCategoryKey(topic);
  const difficultyChip = getDifficultyChip(topic.difficulty);

  const handleBegin = async () => {
    setStartError(null);
    if (showcaseMode) {
      setShowBeginTransition(true);
      window.setTimeout(() => setShowBeginTransition(false), 900);
      return;
    }

    if (orbBalance !== null && orbBalance < orbCost) {
      setShowOrbModal(true);
      return;
    }

    setIsDeducting(true);
    let result: Awaited<ReturnType<typeof deductOrbsAction>>;
    try {
      result = await deductOrbsAction(practiceTrack);
    } catch (error) {
      console.error("Practice session start failed", {
        cause: error,
        practiceTrack,
        supportCode: "PRACTICE-START-01",
      });
      trackAnalyticsEvent({
        eventName: "practice_session_start_failed",
        featureArea: "practice",
        route: window.location.pathname,
        metadata: {
          practice_track: practiceTrack,
          support_code: "PRACTICE-START-01",
        },
      });

      try {
        const verifiedBalance = await getOrbBalanceAction();
        const chargeWasApplied =
          orbBalance !== null && verifiedBalance === orbBalance - orbCost;
        onBalanceChange(verifiedBalance);
        if (chargeWasApplied) {
          result = { success: true, newBalance: verifiedBalance };
        } else {
          setStartError(
            locale === "vi"
              ? "Chưa thể bắt đầu. Hãy thử lại. Mã hỗ trợ: PRACTICE-START-01."
              : "We couldn’t start this practice. Try again. Support code: PRACTICE-START-01.",
          );
          return;
        }
      } catch (balanceError) {
        console.error(
          "Practice start balance verification failed",
          balanceError,
        );
        setStartError(
          locale === "vi"
            ? "Chưa thể xác nhận phiên luyện tập. Hãy tải lại trang trước khi thử lại. Mã hỗ trợ: PRACTICE-START-01."
            : "We couldn’t confirm the practice start. Refresh before trying again. Support code: PRACTICE-START-01.",
        );
        return;
      } finally {
        setIsDeducting(false);
      }
    }
    setIsDeducting(false);

    if (!result.success) {
      onBalanceChange(result.newBalance);
      if (result.error === "Insufficient Credits") {
        setShowOrbModal(true);
      } else {
        console.error("Practice session start rejected", {
          reason: result.error,
          practiceTrack,
          supportCode: "PRACTICE-START-02",
        });
        trackAnalyticsEvent({
          eventName: "practice_session_start_failed",
          featureArea: "practice",
          route: window.location.pathname,
          metadata: {
            practice_track: practiceTrack,
            support_code: "PRACTICE-START-02",
          },
        });
        setStartError(
          locale === "vi"
            ? "Chưa thể bắt đầu. Hãy thử lại. Mã hỗ trợ: PRACTICE-START-02."
            : "We couldn’t start this practice. Try again. Support code: PRACTICE-START-02.",
        );
      }
      return;
    }

    onBalanceChange(result.newBalance);
    setTopic(topic);
    startSession();
    const sessionState = useSessionStore.getState();
    const resolvedSide =
      sessionState.side === "random" ? "proposition" : sessionState.side;
    const handoffPayload: PracticeSessionDraftPayload = {
      selectedTopic: sessionState.selectedTopic ?? topic,
      side: resolvedSide,
      practiceTrack: sessionState.practiceTrack,
      practiceLanguage: sessionState.practiceLanguage,
      mode: sessionState.mode,
      prepTime: sessionState.prepTime,
      speechTime: sessionState.speechTime,
      aiDifficulty: sessionState.aiDifficulty,
      currentPhase: sessionState.currentPhase,
      currentRound: sessionState.currentRound,
      prepNotes: sessionState.prepNotes,
      transcript: sessionState.transcript,
      rounds: sessionState.rounds as DebateRound[],
      debateMemory: sessionState.debateMemory,
      sessionStartTime: sessionState.sessionStartTime,
    };
    clearStoredPracticeDraftId();
    clearLocalPracticeSessionDraft();
    setPendingPracticeSessionHandoff(handoffPayload);
    trackAnalyticsEvent({
      eventName: "practice_session_handoff_written",
      featureArea: "practice",
      route: window.location.pathname,
      metadata: {
        practice_track: handoffPayload.practiceTrack,
        practice_language: handoffPayload.practiceLanguage,
        mode: handoffPayload.mode,
        phase: handoffPayload.currentPhase,
      },
    });
    setShowBeginTransition(true);
    window.setTimeout(() => {
      router.push("/practice/session");
    }, 700);
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 sm:px-5",
            layout === "desktop" && "lg:px-6 lg:pt-5",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start justify-between gap-4">
                <CategoryVisual category={categoryKey} size="sm" />
                <button
                  type="button"
                  aria-label={
                    isBookmarked ? t("remove_bookmark") : t("save_topic")
                  }
                  onClick={() => onToggleBookmark(topic.id)}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isBookmarked
                      ? "text-primary"
                      : "text-on-surface-variant hover:text-primary",
                  )}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="h-[21px] w-[21px]" />
                  ) : (
                    <Bookmark className="h-[21px] w-[21px]" />
                  )}
                </button>
              </div>

              <Heading level={2} className="mt-3 type-title">
                {topic.title}
              </Heading>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-5 items-center rounded-[6px] bg-primary-container px-2 type-caption font-semibold leading-none text-on-primary-container">
                  {locale === "vi"
                    ? "Luyện tập · Có phản hồi"
                    : "Practice · Feedback on"}
                </span>
                <span className="inline-flex h-5 items-center rounded-[6px] bg-surface-container px-2 type-caption font-semibold leading-none text-on-surface-variant">
                  {topic.category}
                </span>
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-[6px] px-2 type-caption font-semibold leading-none",
                    DIFFICULTY_CHIP_STYLES[difficultyChip.tone],
                  )}
                >
                  {t(difficultyChip.labelKey)}
                </span>
              </div>

              <div className="mt-3 rounded-control border border-outline-variant bg-surface-container-low p-3">
                <div className="flex items-center gap-2 type-label font-bold text-on-surface">
                  <Scale className="h-4 w-4 text-primary" />
                  {t("session.motion_brief")}
                </div>
                <Text
                  variant="body-sm"
                  className="mt-1.5 text-on-surface-variant"
                >
                  {motionBrief.scope}
                </Text>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 space-y-4">
            <ConfigField label={t("practice_track")}>
              <SegmentedControl
                value={practiceTrack}
                onChange={setPracticeTrack}
                options={[
                  { value: "speaking", label: t("speaking_practice") },
                  { value: "debate", label: t("debate_practice") },
                ]}
              />
            </ConfigField>

            <ConfigField label={t("session_mode")}>
              <SegmentedControl
                value={practiceTrack === "speaking" ? "quick" : mode}
                onChange={(next) => {
                  if (practiceTrack === "debate" || next === "quick") {
                    setMode(next);
                  }
                }}
                options={[
                  { value: "quick", label: t("quick_practice") },
                  {
                    value: "full",
                    label: t("full_round"),
                    disabled: practiceTrack === "speaking",
                  },
                ]}
              />
            </ConfigField>

            <ConfigField label={t("ai_difficulty")}>
              <SegmentedControl
                value={aiDifficulty}
                onChange={setAiDifficulty}
                options={[
                  { value: "easy", label: t("easy") },
                  { value: "medium", label: t("medium") },
                  { value: "hard", label: t("hard") },
                ]}
              />
            </ConfigField>

            <ConfigField label={t("your_side")}>
              <SegmentedControl
                value={side}
                onChange={setSide}
                options={[
                  { value: "random", label: t("random") },
                  { value: "proposition", label: t("side_affirmative") },
                  { value: "opposition", label: t("side_negative") },
                ]}
              />
            </ConfigField>

            <div className="grid gap-4 sm:grid-cols-2">
              <TimeStepper
                label={t("prep_time")}
                value={prepTime}
                config={SOLO_PREP_DURATION}
                unitLabel={(minutes) =>
                  t("duration_minutes", { count: minutes })
                }
                onChange={setPrepTime}
              />
              <TimeStepper
                label={t("speech_time")}
                value={speechTime}
                config={SOLO_SPEECH_DURATION}
                unitLabel={(minutes) =>
                  t("duration_minutes", { count: minutes })
                }
                onChange={setSpeechTime}
              />
            </div>

            <div className="flex min-h-10 items-center justify-between gap-4 rounded-control border border-outline-variant bg-surface px-3 py-1.5">
              <Text
                id="ai-hints-label"
                variant="label"
                as="p"
                className="font-bold text-on-surface"
              >
                {t("ai_hints")}
              </Text>
              <Switch
                aria-labelledby="ai-hints-label"
                checked={aiHints}
                onCheckedChange={setAiHints}
              />
            </div>
          </div>
        </div>

        {startError ? (
          <div
            className="mx-4 mb-2 flex items-start gap-2 rounded-control border border-error/25 bg-error-container px-3 py-2 type-caption text-on-error-container"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{startError}</span>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-outline-variant bg-surface px-4 py-3 sm:px-5 lg:px-6">
          <div
            className="flex items-center gap-2"
            aria-label={`${t("session_cost")}: ${orbCost} ${t("credits_label")}`}
          >
            <Image
              src={CREDIT_ICON_SRC}
              alt=""
              width={24}
              height={24}
              className="size-6 shrink-0 object-contain"
              unoptimized
              aria-hidden="true"
            />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={orbCost}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="type-label font-semibold tabular-nums text-on-surface"
              >
                {orbCost}
              </motion.span>
            </AnimatePresence>
          </div>

          <Button
            onClick={handleBegin}
            disabled={isDeducting || showBeginTransition}
            className="h-8 flex-1 rounded-control type-body font-bold sm:max-w-[230px]"
          >
            {isDeducting || showBeginTransition
              ? t("starting")
              : t("begin_session")}
            <ArrowRight className="ml-1.5 h-[18px] w-[18px] transition-transform group-hover/button:translate-x-0.5" />
          </Button>
        </div>
      </div>

      <OutOfOrbsModal
        open={showOrbModal}
        onClose={() => setShowOrbModal(false)}
        referralCode={referralCode}
        orbBalance={orbBalance ?? 0}
        orbCost={orbCost}
      />
      <BeginSessionTransition
        show={showBeginTransition}
        label={t("starting")}
      />
    </>
  );
}
