"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DuelCreatePage } from "@/components/debates/duel-create-page";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";
import { AnnotatedTranscript } from "@/components/feedback/annotated-transcript";
import { SessionResultDashboard } from "@/components/feedback/session-result-dashboard";
import { PrepPhase } from "@/components/practice/prep-phase";
import { SessionConfig } from "@/components/practice/session-config";
import { SpeakingPhase } from "@/components/practice/speaking-phase";
import type { DebateSession, DebateTopic } from "@/types";
import { cn } from "@/lib/utils";

type QaTab = "setup" | "prep" | "speaking" | "feedback" | "history" | "duels";
type HistoryQaTab = "overall" | "transcript";

const mockTopic: DebateTopic = {
  id: "dev-motion-phone-ban",
  title: "This House would ban smartphones in secondary school classrooms",
  category: "Education & School Life",
  difficulty: "intermediate",
  context:
    "Schools are deciding whether phones should be locked away during class, allowed for learning tasks, or managed by individual teachers.",
  suggestedPoints: {
    proposition: [
      "Phones interrupt attention during hard tasks",
      "A shared rule is easier to enforce fairly",
      "Students need protected offline space",
    ],
    opposition: [
      "Phones can support research and accessibility",
      "Blanket bans punish responsible students",
      "Digital discipline should be taught, not avoided",
    ],
  },
};

const transcript =
  "I believe we should ban phones because they distract students from deep learning. First, when a notification appears, students lose focus and the teacher has to restart the explanation. This matters because classroom time is already limited. My second argument is fairness, because some students cannot control phone use while others can. But I need to explain why a school-wide rule is better than teacher discretion. In conclusion, the ban protects attention and makes learning time more equal.";

const annotatedSession: DebateSession = {
  id: "dev-annotated-feedback",
  date: new Date("2026-05-02T14:00:00-04:00").toISOString(),
  topic: mockTopic,
  side: "proposition",
  practiceTrack: "debate",
  mode: "quick",
  prepTime: 420,
  speechTime: 420,
  transcript,
  duration: 388,
  feedback: {
    content: {
      claimClarity: 8,
      evidenceSupport: 6,
      logicCoherence: 7,
      counterArgument: 5,
      score: 26,
    },
    structure: {
      introduction: 7,
      bodyOrganization: 7,
      conclusion: 6,
      score: 20,
    },
    language: {
      vocabulary: 7,
      grammar: 8,
      fluency: 7,
      score: 22,
    },
    persuasion: {
      audienceAwareness: 4,
      impactfulness: 4,
      score: 8,
    },
    totalScore: 76,
    overallBand: "Proficient",
    practiceTrack: "debate",
    summary:
      "The stance is clear and the case has a usable attention/fairness line. The next jump is to prove the mechanism and compare why a school-wide rule beats softer alternatives.",
    strengths: [
      "The opening stance is immediate and judge-friendly.",
      "The attention impact is easy to understand.",
      "The conclusion links back to the motion.",
    ],
    improvements: [
      "Add a concrete classroom example or evidence trend.",
      "Explain why teacher discretion is weaker than a school-wide rule.",
      "Weigh attention loss against digital-learning benefits.",
    ],
    sampleArguments: [
      "A school-wide ban creates predictable norms, which reduces enforcement conflict and preserves class time.",
      "The fairest policy protects students who struggle with impulse control instead of assuming everyone can self-regulate.",
      "Limited classroom time means even small distractions compound into lost learning across a term.",
    ],
    caseSummary:
      "The case argues that phone bans protect attention and fairness, but the policy mechanism needs more depth.",
    stanceFeedback:
      "The stance is clear from the first sentence and remains stable throughout the speech.",
    argumentBreakdowns: [
      {
        name: "Attention protection",
        summary:
          "Phones create interruptions that pull students and teachers away from learning.",
        whatWorked:
          "The argument names a concrete classroom harm and links it to limited class time.",
        missingLayer:
          "The mechanism needs a fuller chain from notification to lost explanation time to lower learning outcomes.",
        betterVersion:
          "Attention protection: notifications break concentration, teachers spend time resetting the room, and repeated resets reduce learning time for everyone; because the motion is about classrooms, preserving attention should outweigh convenience.",
      },
      {
        name: "Fair enforcement",
        summary:
          "A shared rule may be fairer than leaving phone control to individual students.",
        whatWorked:
          "The speaker notices that students have different levels of self-control.",
        missingLayer:
          "The speech does not yet explain why school-wide rules beat teacher discretion.",
        betterVersion:
          "Fair enforcement: one consistent rule prevents unequal teacher-by-teacher enforcement, protects students with weaker self-control, and makes expectations predictable for the whole school.",
      },
    ],
    missingLayers: [
      "Mechanism from distraction to learning loss",
      "Comparison against teacher discretion",
      "Evidence for scale of the harm",
    ],
    weighingFeedback:
      "The speech starts weighing classroom time, but it needs a direct comparison against the benefits of phone-based learning.",
    clashFeedback:
      "The opposition's best reply is responsible educational phone use, so the case should answer why that benefit is smaller or can happen outside class.",
    strongerRebuilds: [
      "A stronger rebuild would compare worlds: in the ban world, attention is protected by a consistent norm; in the no-ban world, every teacher negotiates distractions alone, which makes learning less predictable.",
    ],
    transcriptAnnotations: [
      {
        quote:
          "we should ban phones because they distract students from deep learning",
        tag: "stance",
        severity: "strength",
        feedback:
          "This states the side and core burden immediately, so the judge knows what the speech is trying to prove.",
        suggestion:
          "Keep this first, then add one sentence previewing the two mechanisms: attention and fairness.",
      },
      {
        quote:
          "when a notification appears, students lose focus and the teacher has to restart the explanation",
        tag: "mechanism",
        severity: "improvement",
        feedback:
          "The mechanism is visible, but it stops before proving how often this harm happens or how big the learning loss becomes.",
        suggestion:
          "Add a concrete example: one interruption becomes a two-minute reset, repeated across classes and weeks.",
      },
      {
        quote:
          "I need to explain why a school-wide rule is better than teacher discretion",
        tag: "clash",
        severity: "warning",
        feedback:
          "This correctly identifies the missing comparison, but it remains meta-commentary instead of an argued rebuttal.",
        suggestion:
          "Turn it into clash: teacher discretion creates unequal rules, while a school-wide policy creates predictable expectations.",
      },
      {
        quote: "phones are harmless during every lesson",
        tag: "evidence",
        severity: "warning",
        feedback:
          "This quote is intentionally absent from the QA transcript so unmatched annotation fallback cards are covered.",
        suggestion:
          "When the quote cannot be highlighted, keep the feedback visible as a standalone card.",
      },
    ],
    detailedFeedback: {
      contentFeedback:
        "Your content has a clear stance and two usable arguments, but the warrants need one more layer of proof.",
      structureFeedback:
        "The speech moves cleanly from stance to arguments to conclusion. Add clearer signposting before the second argument.",
      languageFeedback:
        "The language is simple and easy to follow, which helps the judge track your case.",
      persuasionFeedback:
        "The case will sound more persuasive once you compare your policy against the opposition's likely alternative.",
    },
  },
};

const legacySession: DebateSession = {
  ...annotatedSession,
  id: "dev-legacy-feedback",
  feedback: annotatedSession.feedback
    ? {
        ...annotatedSession.feedback,
        summary:
          "Legacy feedback still renders without transcript annotations, so older saved sessions stay readable.",
        transcriptAnnotations: undefined,
        argumentBreakdowns: [],
        missingLayers: [],
        strongerRebuilds: [],
        caseSummary: undefined,
        stanceFeedback: undefined,
        weighingFeedback: undefined,
        clashFeedback: undefined,
      }
    : null,
};

const tabs: Array<{ key: QaTab; label: string }> = [
  { key: "setup", label: "Solo setup" },
  { key: "prep", label: "Prep layout" },
  { key: "speaking", label: "Speaking layout" },
  { key: "feedback", label: "Feedback" },
  { key: "history", label: "History tabs" },
  { key: "duels", label: "Duel timers" },
];

function isQaTab(value: string | null): value is QaTab {
  return tabs.some((tab) => tab.key === value);
}

export function DevPracticeQaPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: QaTab = isQaTab(requestedTab) ? requestedTab : "setup";
  const requestedHistoryTab = searchParams.get("historyTab");
  const initialHistoryTab: HistoryQaTab =
    requestedHistoryTab === "transcript" ? "transcript" : "overall";
  const defaultShowTranscript = searchParams.get("openTranscript") === "1";
  const [activeTab, setActiveTab] = useState<QaTab>(initialTab);
  const [historyTab, setHistoryTab] =
    useState<HistoryQaTab>(initialHistoryTab);
  const [prepNotes, setPrepNotes] = useState(
    "Define the clash: attention protection vs flexible educational phone use."
  );

  return (
    <main className="min-h-screen bg-[#F7FAFE]">
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[#DEE8F8] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4D86F7]">
            Localhost QA
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#0B1424]">
            Practice timing, layout, and feedback verification
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-semibold",
                  activeTab === tab.key
                    ? "border-[#4D86F7] bg-[#EEF4FF] text-[#3E78EC]"
                    : "border-[#DEE8F8] bg-white text-[#415069] hover:bg-[#F7FAFE]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "setup" && (
        <div className="mx-auto max-w-xl px-4 pb-10 sm:px-6 lg:px-8">
          <SessionConfig
            topic={mockTopic}
            isBookmarked={false}
            onToggleBookmark={() => undefined}
            orbBalance={9999}
            referralCode="LOCALQA"
            onBalanceChange={() => undefined}
          />
        </div>
      )}

      {activeTab === "prep" && (
        <PrepPhase
          topic={mockTopic}
          side="proposition"
          practiceTrack="debate"
          aiHintsEnabled
          timeLeft={420}
          totalTime={420}
          progress={0.38}
          isRunning
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          onSkip={() => undefined}
        />
      )}

      {activeTab === "speaking" && (
        <SpeakingPhase
          topic={mockTopic}
          side="proposition"
          timeLeft={392}
          totalTime={420}
          progress={0.42}
          isRunning
          isRecording
          transcript="I believe we should ban phones because they distract students from deep learning. First, when a notification appears, students lose focus"
          interimTranscript=" and the teacher has to restart the explanation."
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          audioStream={null}
          speechError={null}
          onPause={() => undefined}
          onResume={() => undefined}
          onEnd={() => undefined}
          isPaused={false}
          hasReceivedSpeech
        />
      )}

      {activeTab === "feedback" && (
        <div className="space-y-8 pb-12">
          <SessionResultDashboard
            session={annotatedSession}
            backHref="/practice"
            backLabel="Back to Practice"
            defaultShowTranscript={defaultShowTranscript}
          />
          <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-[#DEE8F8] bg-white p-4">
              <h2 className="text-lg font-bold text-[#0B1424]">
                Legacy feedback compatibility
              </h2>
              <p className="mt-1 text-sm text-[#415069]">
                This second dashboard has no transcriptAnnotations field.
              </p>
            </div>
          </div>
          <SessionResultDashboard
            session={legacySession}
            backHref="/practice"
            backLabel="Back to Practice"
            defaultShowTranscript={defaultShowTranscript}
          />
        </div>
      )}

      {activeTab === "history" && (
        <div className="mx-auto grid max-w-[1720px] gap-5 px-4 pb-12 sm:px-6 lg:grid-cols-[178px_minmax(0,1fr)] lg:px-8">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-[#DEE8F8] bg-white p-2 shadow-[0_18px_45px_rgba(16,32,72,0.035)] lg:flex-col lg:overflow-visible">
              {[
                { id: "overall" as const, label: "Overall" },
                { id: "transcript" as const, label: "Transcript" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryTab(tab.id)}
                  className={cn(
                    "min-h-[48px] min-w-[132px] rounded-xl px-3 text-left text-sm font-bold transition lg:min-w-0",
                    historyTab === tab.id
                      ? "bg-[#EAF1FF] text-[#3E78EC]"
                      : "bg-white text-[#415069] hover:bg-[#F7FAFE]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0">
            {historyTab === "overall" ? (
              <SessionResultDashboard
                session={annotatedSession}
                backHref="/history"
                backLabel="Back to History"
                showInlineReviewControls={false}
                className="max-w-none px-0 py-0"
              />
            ) : (
              <AnnotatedTranscript
                transcript={annotatedSession.transcript}
                annotations={annotatedSession.feedback?.transcriptAnnotations}
                emptyLabel="No transcript was recorded for this session."
                suggestionLabel="Try this"
                unmatchedLabel="Quote not found"
                roundLabel={(round) => `Round ${round}`}
                durationSeconds={annotatedSession.duration}
              />
            )}
          </main>
        </div>
      )}

      {activeTab === "duels" && (
        <div className="space-y-8 pb-12">
          <DuelCreatePage />
          <DuelMatchmakingPage />
        </div>
      )}
    </main>
  );
}
