"use client";

import type { ElementType, ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CircleHelp,
  Clock3,
  Mic2,
  Scale,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DurationControl } from "@/components/shared/duration-control";
import { OutOfOrbsModal } from "@/components/shared/out-of-orbs-modal";
import { deductOrbsAction } from "@/app/actions/orbs";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
} from "@/lib/practice-durations";
import { useSessionStore } from "@/store/session-store";
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
}

function FieldLabel({
  icon: Icon,
  label,
}: {
  icon: ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[0.88rem] font-semibold text-on-surface">
      <Icon className="h-[15px] w-[15px] text-primary" />
      <span>{label}</span>
      <CircleHelp className="h-[13px] w-[13px] text-[#91a0be]" />
    </div>
  );
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

function SegmentButton({
  active,
  disabled = false,
  icon: Icon,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ElementType;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[45px] items-center justify-center gap-2 rounded-[14px] border px-3 py-2.5 text-[0.9rem] font-medium transition-all",
        active
          ? "border-primary/45 bg-primary/[0.03] text-primary"
          : "border-[#e5ebf7] bg-[#f8fbff] text-[#617292]",
        !active && !disabled && "hover:border-[#cddbf8] hover:bg-white hover:text-on-surface",
        disabled &&
          "cursor-not-allowed border-[#ebf0fa] bg-[#f8fbff] text-[#a0acc3]"
      )}
    >
      <Icon className="h-[15px] w-[15px]" />
      <span>{children}</span>
    </button>
  );
}

function ConfigSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <FieldLabel icon={icon} label={label} />
      {children}
    </section>
  );
}

function SelectRow({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: ElementType;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <FieldLabel icon={icon} label={label} />
      <div className="w-[170px] shrink-0">
        <Select
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-[42px] rounded-[14px] border-[#e5ebf7] bg-white px-3.5 py-2 text-[0.9rem] text-[#475875]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function CreditPill({
  amount,
  label,
}: {
  amount: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f7ff] px-3 py-2 text-[0.95rem] font-semibold text-[#263654]">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f5b942] text-white">
        <Sparkles className="h-[11px] w-[11px]" />
      </span>
      <span>
        {amount} {label}
      </span>
    </span>
  );
}

export function SessionConfig({
  topic,
  isBookmarked,
  onToggleBookmark,
  orbBalance,
  referralCode,
  onBalanceChange,
  layout = "desktop",
}: SessionConfigProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.practice");
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
  const isDesktop = layout === "desktop";

  const handleBegin = async () => {
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
      <div
        className={cn(
          "rounded-[22px] border border-[#e4ebf8] bg-white px-7 py-6 shadow-[0_18px_38px_-34px_rgba(41,79,144,0.38)]",
          isDesktop && "xl:sticky xl:top-6"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.92rem] font-medium text-[#627394]">
              {t("selected_motion")}
            </p>
            <h2 className="mt-3 text-[1.55rem] font-semibold leading-[1.16] text-on-surface">
              {topic.title}
            </h2>
          </div>

          <button
            type="button"
            aria-label={isBookmarked ? t("remove_bookmark") : t("save_topic")}
            onClick={() => onToggleBookmark(topic.id)}
            className="shrink-0 pt-1 text-[#7b8caa] transition-colors hover:text-primary"
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-[22px] w-[22px]" />
            ) : (
              <Bookmark className="h-[22px] w-[22px]" />
            )}
          </button>
        </div>

        <div className="mt-5 border-t border-[#e7edf8] pt-5">
          <div className="space-y-5">
            <ConfigSection label={t("practice_track")} icon={Mic2}>
              <div className="grid gap-3 sm:grid-cols-2">
                <SegmentButton
                  active={practiceTrack === "speaking"}
                  icon={Mic2}
                  onClick={() => setPracticeTrack("speaking")}
                >
                  {t("speaking_practice")}
                </SegmentButton>
                <SegmentButton
                  active={practiceTrack === "debate"}
                  icon={Scale}
                  onClick={() => setPracticeTrack("debate")}
                >
                  {t("debate_practice")}
                </SegmentButton>
              </div>
            </ConfigSection>

            <ConfigSection label={t("session_mode")} icon={Zap}>
              <div className="grid gap-3 sm:grid-cols-2">
                <SegmentButton
                  active={mode === "quick" || practiceTrack === "speaking"}
                  icon={Zap}
                  onClick={() => setMode("quick")}
                >
                  {t("quick_practice")}
                </SegmentButton>
                <SegmentButton
                  active={practiceTrack === "debate" && mode === "full"}
                  disabled={practiceTrack === "speaking"}
                  icon={Sparkles}
                  onClick={
                    practiceTrack === "debate"
                      ? () => setMode("full")
                      : undefined
                  }
                >
                  {t("full_round")}
                </SegmentButton>
              </div>
            </ConfigSection>

            <SelectRow
              label={t("ai_difficulty")}
              icon={Sparkles}
              value={aiDifficulty}
              onChange={(next) => setAiDifficulty(next as typeof aiDifficulty)}
              options={[
                { value: "easy", label: t("easy") },
                { value: "medium", label: t("medium") },
                { value: "hard", label: t("hard") },
              ]}
            />

            <SelectRow
              label={t("your_side")}
              icon={Scale}
              value={side}
              onChange={(next) => setSide(next as typeof side)}
              options={[
                { value: "random", label: t("random") },
                { value: "proposition", label: t("side_affirmative") },
                { value: "opposition", label: t("side_negative") },
              ]}
            />

            <DurationControl
              label={t("prep_time")}
              icon={<Clock3 className="h-4 w-4" />}
              value={prepTime}
              config={SOLO_PREP_DURATION}
              onChange={setPrepTime}
              compact
            />

            <DurationControl
              label={t("speech_time")}
              icon={<Clock3 className="h-4 w-4" />}
              value={speechTime}
              config={SOLO_SPEECH_DURATION}
              onChange={setSpeechTime}
              compact
            />

            <div className="flex items-center justify-between gap-4">
              <FieldLabel icon={Sparkles} label={t("ai_hints")} />
              <Switch checked={aiHints} onCheckedChange={setAiHints} />
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-[#e7edf8] pt-5">
          <div className="flex items-center justify-between gap-4">
            <FieldLabel icon={Sparkles} label={t("session_cost")} />
            <CreditPill amount={String(orbCost)} label={t("credits_label")} />
          </div>

          <Button
            onClick={handleBegin}
            disabled={isDeducting || showBeginTransition}
            className="mt-5 h-[50px] w-full rounded-[0.95rem] bg-primary text-[1.02rem] font-semibold text-on-primary hover:bg-primary/92"
          >
            {isDeducting || showBeginTransition
              ? t("starting")
              : t("begin_session")}
            <ArrowRight className="ml-2 h-[18px] w-[18px]" />
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
