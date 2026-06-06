"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import {
  Check,
  Loader2,
  MessageSquareText,
  Sparkles,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type {
  AiQualityFairness,
  AiQualityOutputType,
  AiQualityReasonTag,
  AiQualityUsefulness,
} from "@/lib/ai/quality-model";
import type { PracticeLanguage } from "@/types";

const REASON_LABELS: Record<
  AiQualityReasonTag,
  { en: string; vi: string }
> = {
  too_generic: { en: "Too generic", vi: "Quá chung chung" },
  missed_argument: { en: "Missed my argument", vi: "Bỏ sót ý của mình" },
  wrong_winner: { en: "Wrong winner", vi: "Chọn sai bên thắng" },
  score_felt_wrong: { en: "Score felt wrong", vi: "Điểm chưa hợp lý" },
  vietnamese_sounded_weird: {
    en: "Vietnamese sounded weird",
    vi: "Tiếng Việt chưa tự nhiên",
  },
  hallucinated_evidence: { en: "Invented evidence", vi: "Bịa dẫn chứng" },
  too_harsh: { en: "Too harsh", vi: "Quá gắt" },
  too_easy: { en: "Too easy", vi: "Quá dễ" },
  latency_too_slow: { en: "Too slow", vi: "Quá chậm" },
};

interface AiQualityRatingWidgetProps {
  runId: string | null | undefined;
  outputType: AiQualityOutputType;
  locale: PracticeLanguage;
  className?: string;
}

function copy(locale: PracticeLanguage) {
  const vi = locale === "vi";
  return {
    rebuttalTitle: vi ? "Phản biện này hữu ích không?" : "Was this rebuttal useful?",
    judgingTitle: vi ? "Phần chấm này công bằng không?" : "Was this judging fair?",
    yes: vi ? "Có" : "Yes",
    somewhat: vi ? "Tạm được" : "Somewhat",
    no: vi ? "Không" : "No",
    tooHarsh: vi ? "Quá gắt" : "Too harsh",
    fair: vi ? "Công bằng" : "Fair",
    tooGenerous: vi ? "Quá dễ" : "Too generous",
    useful: vi ? "Hữu ích" : "Useful",
    notUseful: vi ? "Không hữu ích" : "Not useful",
    off: vi ? "Điểm nào chưa ổn?" : "What felt off?",
    comment: vi ? "Ghi chú thêm..." : "Optional comment...",
    send: vi ? "Gửi" : "Send",
    thanks: vi ? "Cảm ơn bạn đã góp ý." : "Thanks for the signal.",
    skip: vi ? "Đóng" : "Dismiss",
  };
}

export function AiQualityRatingWidget({
  runId,
  outputType,
  locale,
  className,
}: AiQualityRatingWidgetProps) {
  const pathname = usePathname();
  const text = copy(locale);
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [usefulness, setUsefulness] = useState<AiQualityUsefulness | null>(null);
  const [fairness, setFairness] = useState<AiQualityFairness | null>(null);
  const [reasonTags, setReasonTags] = useState<AiQualityReasonTag[]>([]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setDismissed(false);
    setSubmitted(false);
    setSubmitting(false);
    setExpanded(false);
    setUsefulness(null);
    setFairness(null);
    setReasonTags([]);
    setComment("");
  }, [runId]);

  useEffect(() => {
    if (!submitted) return;
    const timeout = window.setTimeout(() => setDismissed(true), 1600);
    return () => window.clearTimeout(timeout);
  }, [submitted]);

  const isJudging = outputType !== "rebuttal";
  const title = isJudging ? text.judgingTitle : text.rebuttalTitle;
  const shouldShowReasons = useMemo(
    () =>
      expanded ||
      usefulness === "somewhat" ||
      usefulness === "no" ||
      (fairness !== null && fairness !== "fair"),
    [expanded, fairness, usefulness]
  );

  if (!runId || dismissed) return null;

  const submit = async (next: {
    usefulness?: AiQualityUsefulness | null;
    fairness?: AiQualityFairness | null;
    forceExpanded?: boolean;
  } = {}) => {
    const nextUsefulness = next.usefulness ?? usefulness;
    const nextFairness = next.fairness ?? fairness;

    if (next.forceExpanded) {
      setExpanded(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/ai-quality/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          usefulness: nextUsefulness,
          fairness: nextFairness,
          reasonTags,
          comment,
          locale,
          route: pathname,
        }),
      });
      if (!response.ok) throw new Error("Unable to save rating");
      setSubmitted(true);
    } catch {
      setExpanded(true);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReason = (tag: AiQualityReasonTag) => {
    setReasonTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  };

  return (
    <aside
      className={cn(
        "fixed bottom-3 left-3 right-3 z-50 sm:bottom-5 sm:left-auto sm:right-5 sm:w-[360px]",
        className
      )}
      aria-live="polite"
    >
      <div className="rounded-2xl border border-outline-variant/20 bg-surface/95 p-3 shadow-token-card backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {submitted ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  {submitted ? text.thanks : title}
                </p>
                {!submitted && (
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    {isJudging
                      ? locale === "vi"
                        ? "Một chạm là đủ để tụi mình chỉnh judge tốt hơn."
                        : "One tap helps calibrate the judge."
                      : locale === "vi"
                        ? "Một chạm là đủ để tụi mình chỉnh AI tốt hơn."
                        : "One tap helps tune the AI opponent."}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
                aria-label={text.skip}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!submitted && (
              <div className="mt-3 space-y-3">
                {isJudging ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["too_harsh", text.tooHarsh],
                        ["fair", text.fair],
                        ["too_generous", text.tooGenerous],
                      ].map(([value, label]) => (
                        <ChoiceButton
                          key={value}
                          active={fairness === value}
                          onClick={() => {
                            setFairness(value as AiQualityFairness);
                            if (value !== "fair") setExpanded(true);
                          }}
                        >
                          {label}
                        </ChoiceButton>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["yes", text.useful],
                        ["somewhat", text.somewhat],
                        ["no", text.notUseful],
                      ].map(([value, label]) => (
                        <ChoiceButton
                          key={value}
                          active={usefulness === value}
                          onClick={() => {
                            setUsefulness(value as AiQualityUsefulness);
                            if (value !== "yes") setExpanded(true);
                          }}
                        >
                          {label}
                        </ChoiceButton>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <ChoiceButton onClick={() => submit({ usefulness: "yes" })}>
                      {text.yes}
                    </ChoiceButton>
                    <ChoiceButton
                      active={usefulness === "somewhat"}
                      onClick={() => {
                        setUsefulness("somewhat");
                        setExpanded(true);
                      }}
                    >
                      {text.somewhat}
                    </ChoiceButton>
                    <ChoiceButton
                      active={usefulness === "no"}
                      onClick={() => {
                        setUsefulness("no");
                        setExpanded(true);
                      }}
                    >
                      {text.no}
                    </ChoiceButton>
                  </div>
                )}

                {shouldShowReasons && (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-on-surface">
                      <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                      {text.off}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(REASON_LABELS) as AiQualityReasonTag[]).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleReason(tag)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                            reasonTags.includes(tag)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/30"
                          )}
                        >
                          {REASON_LABELS[tag][locale]}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder={text.comment}
                      className="mt-3 min-h-16 w-full resize-none rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/50"
                      maxLength={1200}
                    />
                  </div>
                )}

                {(isJudging || shouldShowReasons) && (
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={submitting || (!usefulness && !fairness && !reasonTags.length && !comment)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {text.send}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChoiceButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-xl border px-2 text-xs font-semibold transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-outline-variant/20 bg-surface-container-low text-on-surface hover:border-primary/30"
      )}
    >
      {children}
    </button>
  );
}
