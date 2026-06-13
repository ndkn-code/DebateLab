"use client";

import type { ElementType, ReactNode } from "react";
import { useId, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
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
import { deductOrbsAction } from "@/app/actions/orbs";
import {
  clampDurationSeconds,
  secondsToMinutes,
  type DurationConfig,
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
} from "@/lib/practice-durations";
import { useSessionStore } from "@/store/session-store";
import { getDisplayMotionBrief } from "@/lib/motion-brief";
import { getTopicCategoryKey } from "@/lib/topics";
import { cn } from "@/lib/utils";
import type { DebateTopic } from "@/types";

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

function BeginSessionTransition({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] overflow-hidden bg-primary"
          aria-hidden="true"
        >
          <motion.div
            initial={{ scale: 2.4, opacity: 0.35 }}
            animate={{ scale: 0.72, opacity: 0.95 }}
            exit={{ scale: 0.32, opacity: 0 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.12)_20%,rgba(255,255,255,0)_52%)]"
          />
          <motion.div
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1.35, opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 top-1/2 h-[34vmax] w-[34vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-on-primary/35"
          />
          <motion.div
            initial={{ scale: 1.05, opacity: 0.55, rotate: 0 }}
            animate={{ scale: 0.72, opacity: 0, rotate: 18 }}
            transition={{ duration: 0.74, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-[-8%] bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.16)_48%,transparent_56%)]"
          />
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
      className="grid gap-1 rounded-2xl bg-surface-container p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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
              "relative flex min-h-[42px] items-center justify-center gap-1.5 rounded-[12px] px-2 py-2 type-body-sm font-semibold transition-colors duration-150",
              isActive
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface",
              option.disabled &&
                "cursor-not-allowed opacity-45 hover:text-on-surface-variant"
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={`segment-${groupId}`}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 rounded-[12px] bg-surface-container-lowest shadow-token-card ring-1 ring-primary/25"
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

function ConfigField({ label, children }: { label: string; children: ReactNode }) {
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
    onChange(clampDurationSeconds(bounded + direction * config.stepSeconds, config));

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
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
          className="flex size-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
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
          className="flex size-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

const DIFFICULTY_CHIP_STYLES = {
  easy: "bg-[#E5F6EC] text-[#1E9E54] dark:bg-[#34C759]/15 dark:text-[#5DD984]",
  medium: "bg-[#FFF3DC] text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]",
  hard: "bg-[#FFEAEA] text-[#D6494E] dark:bg-[#FF5A5F]/15 dark:text-[#FF9398]",
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
  const motionBrief = getDisplayMotionBrief(topic, locale === "vi" ? "vi" : "en");
  const categoryKey = getTopicCategoryKey(topic);
  const difficultyChip = getDifficultyChip(topic.difficulty);

  const handleBegin = async () => {
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
    const result = await deductOrbsAction(practiceTrack);
    setIsDeducting(false);

    if (!result.success) {
      onBalanceChange(result.newBalance);
      setShowOrbModal(true);
      return;
    }

    onBalanceChange(result.newBalance);
    setTopic(topic);
    startSession();
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
            "relative min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-7 sm:px-8",
            layout === "desktop" && "lg:px-9 lg:pt-9"
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
                <CategoryVisual category={categoryKey} size="lg" />
                <button
                  type="button"
                  aria-label={isBookmarked ? t("remove_bookmark") : t("save_topic")}
                  onClick={() => onToggleBookmark(topic.id)}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full transition-all hover:bg-surface-container active:scale-90",
                    isBookmarked
                      ? "text-primary"
                      : "text-on-surface-variant hover:text-primary"
                  )}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="h-[21px] w-[21px]" />
                  ) : (
                    <Bookmark className="h-[21px] w-[21px]" />
                  )}
                </button>
              </div>

              <Heading level={2} className="mt-5">
                {topic.title}
              </Heading>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-container px-3 py-1.5 type-caption font-semibold leading-none text-on-surface-variant">
                  {topic.category}
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1.5 type-caption font-semibold leading-none",
                    DIFFICULTY_CHIP_STYLES[difficultyChip.tone]
                  )}
                >
                  {t(difficultyChip.labelKey)}
                </span>
              </div>

              <div className="mt-7 rounded-2xl bg-surface-container p-5">
                <div className="flex items-center gap-2 type-label font-bold text-on-surface">
                  <Scale className="h-4 w-4 text-primary" />
                  {t("session.motion_brief")}
                </div>
                <Text variant="body-sm" className="mt-3 text-on-surface-variant">
                  {motionBrief.scope}
                </Text>
                <Text variant="caption" className="mt-2.5 text-on-surface-variant/85">
                  {motionBrief.modelClarification}
                </Text>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 space-y-7">
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
                unitLabel={(minutes) => t("duration_minutes", { count: minutes })}
                onChange={setPrepTime}
              />
              <TimeStepper
                label={t("speech_time")}
                value={speechTime}
                config={SOLO_SPEECH_DURATION}
                unitLabel={(minutes) => t("duration_minutes", { count: minutes })}
                onChange={setSpeechTime}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
              <Text variant="label" as="p" className="font-bold text-on-surface">
                {t("ai_hints")}
              </Text>
              <Switch checked={aiHints} onCheckedChange={setAiHints} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-outline-variant bg-surface-container-lowest px-6 py-4 sm:px-8 lg:px-9">
          <div
            className="flex items-center gap-2"
            aria-label={`${t("session_cost")}: ${orbCost} ${t("credits_label")}`}
          >
            <Image
              src={CREDIT_ICON_SRC}
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
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
                className="type-heading-lg font-extrabold leading-none tabular-nums text-on-surface"
              >
                {orbCost}
              </motion.span>
            </AnimatePresence>
          </div>

          <Button
            onClick={handleBegin}
            disabled={isDeducting || showBeginTransition}
            className="h-12 flex-1 rounded-2xl type-body font-bold sm:max-w-[230px]"
          >
            {isDeducting || showBeginTransition ? t("starting") : t("begin_session")}
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
      <BeginSessionTransition show={showBeginTransition} />
    </>
  );
}
