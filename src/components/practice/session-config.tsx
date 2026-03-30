"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  Clock,
  Mic2,
  Lightbulb,
  Zap,
  Layers,
  Shuffle,
  ThumbsUp,
  ThumbsDown,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { OrbBalance } from "@/components/shared/orb-balance";
import { OutOfOrbsModal } from "@/components/shared/out-of-orbs-modal";
import { deductOrbsAction, getOrbBalanceAction } from "@/app/actions/orbs";
import { createClient } from "@/lib/supabase/client";
import type { DebateTopic } from "@/types";

interface SessionConfigProps {
  topic: DebateTopic;
  onClose: () => void;
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-all",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
      )}
    >
      {children}
    </button>
  );
}

export function SessionConfig({ topic, onClose }: SessionConfigProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.practice");
  const {
    side,
    mode,
    prepTime,
    speechTime,
    aiHints,
    aiDifficulty,
    setSide,
    setMode,
    setPrepTime,
    setSpeechTime,
    setAiHints,
    setAiDifficulty,
    setTopic,
    startSession,
  } = useSessionStore();

  const [orbBalance, setOrbBalance] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [showOrbModal, setShowOrbModal] = useState(false);
  const [isDeducting, setIsDeducting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const balance = await getOrbBalanceAction();
      setOrbBalance(balance);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("id", user.id)
          .single();
        setReferralCode(data?.referral_code ?? "");
      }
    };
    load();
  }, []);

  const orbCost = mode === "quick" ? 1 : 2;

  const handleBegin = async () => {
    if (orbBalance !== null && orbBalance < orbCost) {
      setShowOrbModal(true);
      return;
    }

    setIsDeducting(true);
    const result = await deductOrbsAction(mode);
    setIsDeducting(false);

    if (!result.success) {
      setOrbBalance(result.newBalance);
      setShowOrbModal(true);
      return;
    }

    setOrbBalance(result.newBalance);
    setTopic(topic);
    startSession();
    router.push("/practice/session");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-outline-variant/10 bg-surface-container-lowest/95 backdrop-blur-xl lg:absolute lg:inset-auto lg:right-0 lg:top-0 lg:h-full lg:w-[400px] lg:rounded-l-2xl lg:rounded-t-none lg:border-l lg:border-t-0"
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-bold text-on-surface">
                {t("session_config")}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">
                {topic.title}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close session configuration"
              className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-on-surface">
              <Layers className="h-4 w-4 text-primary" />
              {t("mode")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton
                active={mode === "quick"}
                onClick={() => setMode("quick")}
              >
                <Zap className="mr-1.5 inline h-3.5 w-3.5" />
                {t("quick_practice")}
              </OptionButton>
              <OptionButton
                active={mode === "full"}
                onClick={() => setMode("full")}
              >
                <Layers className="mr-1.5 inline h-3.5 w-3.5" />
                {t("full_round")}
              </OptionButton>
            </div>
            <p className="mt-1.5 text-xs text-on-surface-variant">
              {mode === "quick"
                ? t("quick_desc")
                : t("full_desc")}
            </p>
          </div>

          {/* AI Difficulty — only for Full Round */}
          {mode === "full" && (
            <div className="mb-6">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-on-surface">
                <Bot className="h-4 w-4 text-primary" />
                {t("ai_difficulty")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <OptionButton
                  active={aiDifficulty === "easy"}
                  onClick={() => setAiDifficulty("easy")}
                >
                  {t("easy")}
                </OptionButton>
                <OptionButton
                  active={aiDifficulty === "medium"}
                  onClick={() => setAiDifficulty("medium")}
                >
                  {t("medium")}
                </OptionButton>
                <OptionButton
                  active={aiDifficulty === "hard"}
                  onClick={() => setAiDifficulty("hard")}
                >
                  {t("hard")}
                </OptionButton>
              </div>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                {aiDifficulty === "easy"
                  ? t("easy_desc")
                  : aiDifficulty === "medium"
                    ? t("medium_desc")
                    : t("hard_desc")}
              </p>
            </div>
          )}

          {/* Side */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-on-surface">
              <Shuffle className="h-4 w-4 text-primary" />
              {t("your_side")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton
                active={side === "random"}
                onClick={() => setSide("random")}
              >
                <Shuffle className="mr-1 inline h-3.5 w-3.5" />
                {t("random")}
              </OptionButton>
              <OptionButton
                active={side === "proposition"}
                onClick={() => setSide("proposition")}
              >
                <ThumbsUp className="mr-1 inline h-3.5 w-3.5" />
                {t("for")}
              </OptionButton>
              <OptionButton
                active={side === "opposition"}
                onClick={() => setSide("opposition")}
              >
                <ThumbsDown className="mr-1 inline h-3.5 w-3.5" />
                {t("against")}
              </OptionButton>
            </div>
          </div>

          {/* Prep Time */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-on-surface">
              <Clock className="h-4 w-4 text-primary" />
              {t("prep_time")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[60, 120, 180].map((val) => (
                <OptionButton
                  key={val}
                  active={prepTime === val}
                  onClick={() => setPrepTime(val)}
                >
                  {val / 60} min
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Speech Time */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-on-surface">
              <Mic2 className="h-4 w-4 text-primary" />
              {t("speech_time")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[120, 180, 240].map((val) => (
                <OptionButton
                  key={val}
                  active={speechTime === val}
                  onClick={() => setSpeechTime(val)}
                >
                  {val / 60} min
                </OptionButton>
              ))}
            </div>
          </div>

          {/* AI Hints */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
                <Lightbulb className="h-4 w-4 text-primary" />
                {t("ai_hints")}
              </label>
              <button
                role="switch"
                aria-checked={aiHints}
                aria-label="Toggle AI hints during preparation"
                onClick={() => setAiHints(!aiHints)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  aiHints ? "bg-primary" : "bg-outline-variant"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    aiHints && "translate-x-5"
                  )}
                />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-on-surface-variant">
              {t("ai_hints_desc")}
            </p>
          </div>

          {/* Orb Cost Indicator */}
          {orbBalance !== null && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-2.5">
              <span className="text-sm text-on-surface-variant">Session cost</span>
              <OrbBalance balance={orbCost} size="sm" showLabel />
            </div>
          )}

          {/* Begin Button */}
          <Button
            onClick={handleBegin}
            disabled={isDeducting}
            className="w-full gap-2 bg-primary py-6 text-base font-semibold text-on-primary hover:bg-primary/90"
          >
            {isDeducting ? (
              "Starting..."
            ) : (
              <>
                {t("begin_session")}
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>

          {/* Current balance */}
          {orbBalance !== null && (
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-on-surface-variant">
              <span>Your balance:</span>
              <OrbBalance balance={orbBalance} size="sm" />
            </div>
          )}
        </div>

        {/* Out of Orbs Modal */}
        <OutOfOrbsModal
          open={showOrbModal}
          onClose={() => setShowOrbModal(false)}
          referralCode={referralCode}
          orbBalance={orbBalance ?? 0}
          orbCost={orbCost}
        />
      </motion.div>
    </AnimatePresence>
  );
}
