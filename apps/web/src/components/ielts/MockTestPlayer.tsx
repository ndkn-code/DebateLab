"use client";

/**
 * Top-level timed mock player (WS-2.1). Orchestrates the sitting on top of the
 * WS-0.3 attempt substrate: start → enter sections (server clock) → answer
 * (debounced server upserts, deadline-enforced) → pause/resume → submit
 * sections → finish → objective grade → band. The results UI is intentionally
 * minimal here (full review is WS-2.2).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  MockStructure,
  AttemptState,
} from "@/lib/api/ielts/mock-repository";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type { AttemptGrade } from "@/lib/scoring/ielts/grade-objective";
import {
  assessmentModePolicy,
  type AssessmentMode,
} from "@/lib/ielts/assessment-mode";
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
import { MockBandSummary, MockIntroCard } from "./MockPlayerStates";
import { IeltsPlayerExperienceProvider } from "./player-experience-context";
import {
  IELTS_PLAYER_EXPERIENCE_COPY,
  type IeltsPlayerExperience,
  type IeltsPlayerLocale,
} from "./player-experience";

type Phase = "intro" | "running" | "done";

export function MockTestPlayer({
  structure,
  initialState,
  assignmentId,
  returnHref,
  returnLabel,
  experience = "exam_simulation",
}: {
  structure: MockStructure;
  /** Snapshot-backed state used when refreshing/resuming an existing sitting. */
  initialState?: AttemptState;
  /** When present, the sitting is stamped to this class assignment (WS-5.3). */
  assignmentId?: string;
  /** Optional post-submit path used by onboarding diagnostics. */
  returnHref?: string;
  returnLabel?: string;
  experience?: IeltsPlayerExperience;
}) {
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const t = useTranslations("ielts.player");
  const locale: IeltsPlayerLocale = params.locale === "vi" ? "vi" : "en";
  const experienceCopy = IELTS_PLAYER_EXPERIENCE_COPY[locale][experience];
  const [phase, setPhase] = useState<Phase>(initialState ? "running" : "intro");
  const [state, setState] = useState<AttemptState | null>(initialState ?? null);
  const [activeStructure, setActiveStructure] = useState<MockStructure>(
    initialState?.structure ?? structure,
  );
  const [responses, setResponses] = useState<IeltsResponseMap>(() =>
    Object.fromEntries(
      (initialState?.responses ?? []).map((row) => [
        row.question_id,
        row.response,
      ]),
    ),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pending = useRef<Map<string, { sectionId: string; value: unknown }>>(
    new Map(),
  );
  const lastAnswerToastAt = useRef(0);
  const answerSaveErrorShown = useRef(false);
  const hydrateAnnotations = useMockAnnotationsStore(
    (store) => store.hydrateAttempt,
  );
  const clearAnnotations = useMockAnnotationsStore(
    (store) => store.clearActiveAttempt,
  );

  const sections = state?.sections ?? [];
  const section = sections[activeIndex];
  const attemptId = state?.attempt.id ?? null;
  const assessmentMode: AssessmentMode =
    state?.attempt.assessment_mode ?? activeStructure.test.assessment_mode;
  const modePolicy = assessmentModePolicy(assessmentMode);

  useEffect(() => {
    if (!attemptId) return undefined;
    hydrateAnnotations(attemptId);
    return () => clearAnnotations();
  }, [attemptId, hydrateAnnotations, clearAnnotations]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : t("toastActionFailed");
        setError(message);
        showToast(message, "error");
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const hydrate = (next: AttemptState) => {
    setState(next);
    if (next.structure) setActiveStructure(next.structure);
    setResponses(
      Object.fromEntries(
        next.responses.map((row) => [row.question_id, row.response]),
      ),
    );
  };

  // Persist one question's latest value; keep it pending on failure so a later
  // flush retries (the optimistic value stays on screen meanwhile).
  const persistOne = useCallback(
    async (questionId: string) => {
      const item = pending.current.get(questionId);
      if (!item || !attemptId) return;
      try {
        await saveResponse({
          attemptId,
          sectionId: item.sectionId,
          questionId,
          response: item.value,
        });
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
    },
    [attemptId, t],
  );

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
        : await startMockAttempt({ testId: activeStructure.test.id });
      hydrate(started);
      setActiveIndex(0);
      setPhase("running");
      // Keep the immutable attempt addressable so a refresh resumes against
      // its snapshot instead of reconstructing from the live test.
      router.replace(
        `/${params.locale}/ielts/mock/${activeStructure.test.slug}?attempt=${started.attempt.id}`,
      );
      const first = started.sections[0];
      if (first) {
        setState(
          await enterSection({
            attemptId: started.attempt.id,
            sectionId: first.id,
          }),
        );
      }
    });

  const handleSwitch = (index: number) =>
    run(async () => {
      const target = sections[index];
      if (!target || !attemptId) return;
      if (!modePolicy.canNavigateToSubmittedSection) {
        if (index !== activeIndex + 1 || section?.submitted_at === null) return;
      }
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
      action: (input: {
        attemptId: string;
        sectionId: string;
      }) => Promise<AttemptState>,
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
      const result = await submitMockAttempt({
        attemptId,
        feedbackLanguage: locale,
      });
      setState(result.state);
      showToast(
        experience === "speaking_rehearsal"
          ? experienceCopy.submitted
          : t("toastMockSubmitted"),
        "success",
      );
      // Diagnostic sittings (onboarding / study-plan) pass a returnHref and must
      // funnel back there — the plan, not the raw results page. Self-serve mocks
      // (no returnHref) go to full results.
      const destination =
        returnHref ?? `/${params.locale}/ielts/attempts/${attemptId}/results`;
      if (assessmentMode === "simulation") {
        // Simulation results can remain in `grading` until Writing finishes;
        // never flash a partial overall band as if the exam were complete.
        router.push(destination);
        return;
      }
      setGrade(result.grade);
      setPhase("done");
      router.push(destination);
    });
  };

  if (phase === "intro") {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-4 py-8">
        <MockIntroCard
          title={activeStructure.test.title}
          experience={experience}
          locale={locale}
          busy={busy}
          error={error}
          onStart={handleStart}
        />
      </div>
    );
  }

  if (phase === "done" && grade) {
    const resultsHref = attemptId
      ? `/${params.locale}/ielts/attempts/${attemptId}/results`
      : null;
    return (
      <MockBandSummary
        grade={grade}
        resultsHref={resultsHref}
        returnHref={returnHref}
        returnLabel={returnLabel}
        experience={experience}
        locale={locale}
      />
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background"
      data-ielts-exam="player"
    >
      {error ? (
        <p className="absolute left-1/2 top-3 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl bg-error-container px-4 py-3 text-sm font-semibold text-error shadow-lg">
          {error}
        </p>
      ) : null}

      {section ? (
        <IeltsPlayerExperienceProvider value={experience}>
          <MockSectionView
            key={section.id}
            section={section}
            structure={activeStructure}
            responses={responses}
            busy={busy}
            testTitle={activeStructure.test.title}
            sections={sections}
            assessmentMode={assessmentMode}
            activeSectionIndex={activeIndex}
            onAnswer={handleAnswer}
            onSwitchSection={handleSwitch}
            onPause={sectionAction(pauseSection)}
            onResume={sectionAction(resumeSection)}
            onSubmitSection={sectionAction(
              submitSection,
              t("toastSectionSubmitted"),
            )}
            onExpire={handleExpire}
            onFinish={handleFinish}
          />
        </IeltsPlayerExperienceProvider>
      ) : null}
    </div>
  );
}
