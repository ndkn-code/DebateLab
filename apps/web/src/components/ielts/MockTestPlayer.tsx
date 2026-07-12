"use client";

/**
 * Top-level timed mock player (WS-2.1). Orchestrates the sitting on top of the
 * WS-0.3 attempt substrate: start → enter sections (server clock) → answer
 * (debounced server upserts, deadline-enforced) → pause/resume → submit
 * sections → finish → objective grade → band. The results UI is intentionally
 * minimal here (full review is WS-2.2).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MockStructure, AttemptState } from "@/lib/api/ielts/mock-repository";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type { AttemptGrade } from "@/lib/scoring/ielts/grade-objective";
import { useMockAnnotationsStore } from "@/lib/stores/mockAnnotationsStore";
import { showToast } from "@/components/shared/toast";
import {
  enterSection,
  getAttemptState,
  pauseSection,
  resumeSection,
  saveResponse,
  startMockAttempt,
  submitMockAttempt,
  submitSection,
} from "@/app/actions/ielts/mock";
import { startAssignedMockAttempt } from "@/app/actions/ielts/assignments";
import { MockSectionView } from "./MockSectionView";
import { MockPreTestGuide } from "./MockPreTestGuide";

type Phase = "intro" | "running" | "done";
const PILL = "rounded-full px-5 py-2 text-sm font-semibold";

function bandText(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export function MockTestPlayer({
  structure,
  assignmentId,
  returnHref,
  returnLabel,
}: {
  structure: MockStructure;
  /** When present, the sitting is stamped to this class assignment (WS-5.3). */
  assignmentId?: string;
  /** Optional post-submit path used by onboarding diagnostics. */
  returnHref?: string;
  returnLabel?: string;
}) {
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const t = useTranslations("ielts.player");
  const [phase, setPhase] = useState<Phase>("intro");
  const [state, setState] = useState<AttemptState | null>(null);
  const [responses, setResponses] = useState<IeltsResponseMap>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pending = useRef<Map<string, { sectionId: string; value: unknown }>>(new Map());
  const lastAnswerToastAt = useRef(0);
  const answerSaveErrorShown = useRef(false);
  const hydrateAnnotations = useMockAnnotationsStore((store) => store.hydrateAttempt);
  const clearAnnotations = useMockAnnotationsStore((store) => store.clearActiveAttempt);

  const sections = state?.sections ?? [];
  const section = sections[activeIndex];
  const attemptId = state?.attempt.id ?? null;

  useEffect(() => {
    if (!attemptId) return undefined;
    hydrateAnnotations(attemptId);
    return () => clearAnnotations();
  }, [attemptId, hydrateAnnotations, clearAnnotations]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toastActionFailed");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }, [t]);

  const hydrate = (next: AttemptState) => {
    setState(next);
    setResponses(
      Object.fromEntries(next.responses.map((row) => [row.question_id, row.response])),
    );
  };

  // Persist one question's latest value; keep it pending on failure so a later
  // flush retries (the optimistic value stays on screen meanwhile).
  const persistOne = useCallback(async (questionId: string) => {
    const item = pending.current.get(questionId);
    if (!item) return;
    try {
      await saveResponse({ sectionId: item.sectionId, questionId, response: item.value });
      if (pending.current.get(questionId) === item) {
        pending.current.delete(questionId);
        answerSaveErrorShown.current = false;
        const now = Date.now();
        if (now - lastAnswerToastAt.current > 12000) {
          lastAnswerToastAt.current = now;
          showToast(t("toastAnswerSaved"), "success");
        }
      }
    } catch {
      if (!answerSaveErrorShown.current) {
        answerSaveErrorShown.current = true;
        showToast(t("toastAnswerSaveFailed"), "warning");
      }
      /* keep pending for retry */
    }
  }, [t]);

  // Drain all debounced saves NOW — called before every state transition so no
  // just-typed answer is lost when a section/attempt is submitted.
  const flushPending = useCallback(async () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    await Promise.all([...pending.current.keys()].map((id) => persistOne(id)));
  }, [persistOne]);

  const handleStart = () =>
    run(async () => {
      const started = assignmentId
        ? await startAssignedMockAttempt({ assignmentId })
        : await startMockAttempt({ testId: structure.test.id });
      hydrate(started);
      setActiveIndex(0);
      setPhase("running");
      const first = started.sections[0];
      if (first) {
        setState(await enterSection({ attemptId: started.attempt.id, sectionId: first.id }));
      }
    });

  const handleSwitch = (index: number) =>
    run(async () => {
      const target = sections[index];
      if (!target || !attemptId) return;
      await flushPending();
      setActiveIndex(index);
      if (target.started_at === null) {
        setState(await enterSection({ attemptId, sectionId: target.id }));
      }
    });

  const handleAnswer = (questionId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    if (!section) return;
    pending.current.set(questionId, { sectionId: section.id, value });
    const existing = timers.current.get(questionId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      questionId,
      setTimeout(() => {
        void persistOne(questionId);
      }, 600),
    );
  };

  const sectionAction =
    (
      action: (input: { attemptId: string; sectionId: string }) => Promise<AttemptState>,
      successMessage?: string,
    ) =>
    () => {
      if (!section || !attemptId) return;
      void run(async () => {
        await flushPending();
        setState(await action({ attemptId, sectionId: section.id }));
        if (successMessage) showToast(successMessage, "success");
      });
    };

  const handleExpire = () => {
    if (!attemptId) return;
    void run(async () => {
      await flushPending();
      setState(await getAttemptState({ attemptId }));
    });
  };

  const handleFinish = () => {
    if (!attemptId) return;
    void run(async () => {
      await flushPending();
      const result = await submitMockAttempt({ attemptId });
      setState(result.state);
      setGrade(result.grade);
      setPhase("done");
      showToast(t("toastMockSubmitted"), "success");
      router.push(`/${params.locale}/ielts/attempts/${attemptId}/results`);
    });
  };

  if (phase === "intro") {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-4 py-8">
        <IntroCard title={structure.test.title} busy={busy} error={error} onStart={handleStart} />
      </div>
    );
  }

  if (phase === "done" && grade) {
    const resultsHref = attemptId
      ? `/${params.locale}/ielts/attempts/${attemptId}/results`
      : null;
    return (
      <BandSummary
        grade={grade}
        resultsHref={resultsHref}
        returnHref={returnHref}
        returnLabel={returnLabel}
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {error ? (
        <p className="absolute left-1/2 top-3 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl bg-error-container px-4 py-3 text-sm font-semibold text-error shadow-lg">
          {error}
        </p>
      ) : null}

      {section ? (
        <MockSectionView
          key={section.id}
          section={section}
          structure={structure}
          responses={responses}
          busy={busy}
          testTitle={structure.test.title}
          sections={sections}
          activeSectionIndex={activeIndex}
          onAnswer={handleAnswer}
          onSwitchSection={handleSwitch}
          onPause={sectionAction(pauseSection)}
          onResume={sectionAction(resumeSection)}
          onSubmitSection={sectionAction(submitSection, t("toastSectionSubmitted"))}
          onExpire={handleExpire}
          onFinish={handleFinish}
        />
      ) : null}
    </div>
  );
}

function IntroCard({
  title,
  busy,
  error,
  onStart,
}: {
  title: string;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-outline-variant bg-surface-container p-8 text-center">
      <h1 className="text-xl font-bold text-on-surface">{title}</h1>
      <p className="text-sm text-on-surface-variant">
        Timed, exam-conditions mock. Each section is server-timed; you can pause,
        resume, and navigate within a section.
      </p>
      <MockPreTestGuide />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className={`${PILL} bg-primary text-on-primary disabled:opacity-50`}
      >
        {busy ? "Starting…" : "Start mock test"}
      </button>
    </div>
  );
}

function BandSummary({
  grade,
  resultsHref,
  returnHref,
  returnLabel,
}: {
  grade: AttemptGrade;
  resultsHref: string | null;
  returnHref?: string;
  returnLabel?: string;
}) {
  const rows: Array<[string, number | null, number | null]> = [
    ["Listening", grade.listeningRaw, grade.bands.listeningBand],
    ["Reading", grade.readingRaw, grade.bands.readingBand],
  ];
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-outline-variant bg-surface-container p-8">
      <h1 className="text-center text-xl font-bold text-on-surface">Your band</h1>
      <div className="rounded-3xl bg-primary p-6 text-center text-on-primary">
        <p className="text-xs font-semibold uppercase tracking-wide">Overall (provisional)</p>
        <p className="text-4xl font-extrabold">{bandText(grade.bands.overallBand)}</p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(([label, raw, band]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-on-surface"
          >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-sm text-on-surface-variant">
              {raw === null ? "—" : `${raw}/40`} · band{" "}
              <span className="font-bold text-on-surface">{bandText(band)}</span>
            </span>
          </div>
        ))}
      </div>
      {resultsHref ? (
        <Link
          href={resultsHref}
          className={`${PILL} bg-primary text-center text-on-primary`}
        >
          See full results &amp; review
        </Link>
      ) : null}
      {returnHref ? (
        <Link
          href={returnHref}
          className={`${PILL} bg-surface-container-high text-center text-on-surface`}
        >
          {returnLabel ?? "Continue"}
        </Link>
      ) : null}
      <p className="text-center text-xs text-on-surface-variant">
        Writing &amp; Speaking are scored separately and appear in your full
        results as they finish.
      </p>
    </div>
  );
}
