"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DuelCreatePage } from "@/components/debates/duel-create-page";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";
import { DuelResultContent } from "@/components/debates/duel-result-page";
import { DebateClashMapPanel } from "@/components/feedback/debate-clash-map-panel";
import { DebateVerdictPanel } from "@/components/feedback/debate-verdict-panel";
import {
  SessionReviewShell,
  type SessionReviewTab,
} from "@/components/feedback/session-review-shell";
import { SessionResultDashboard } from "@/components/feedback/session-result-dashboard";
import { SessionTranscriptPanel } from "@/components/feedback/session-transcript-panel";
import { PrepPhase } from "@/components/practice/prep-phase";
import { AiRebuttalPhase } from "@/components/practice/ai-rebuttal-phase";
import { SessionConfig } from "@/components/practice/session-config";
import { SpeakingPhase } from "@/components/practice/speaking-phase";
import {
  showcaseAnnotatedSession,
  showcaseDuelRoom,
  showcaseFullRoundSession,
  showcaseLegacyDuelRoom,
  showcaseLegacySession,
  showcasePrepNotes,
  showcaseTopic,
} from "@/lib/admin-ui-showcase/fixtures";
import { cn } from "@/lib/utils";

type QaTab =
  | "setup"
  | "prep"
  | "speaking"
  | "feedback"
  | "history"
  | "duels"
  | "duel-result"
  | "ai-debate"
  | "ai-tts";

const tabs: Array<{ key: QaTab; label: string }> = [
  { key: "setup", label: "Solo setup" },
  { key: "prep", label: "Prep layout" },
  { key: "speaking", label: "Speaking layout" },
  { key: "feedback", label: "Feedback" },
  { key: "history", label: "History tabs" },
  { key: "duels", label: "Duel timers" },
  { key: "duel-result", label: "Duel result" },
  { key: "ai-debate", label: "AI debate result" },
  { key: "ai-tts", label: "AI TTS sync" },
];

const aiTtsFixtures = {
  vi: {
    topic:
      "Chúng tôi ủng hộ việc chấm dứt các cuộc thi mang tính cạnh tranh dành cho học sinh.",
    userTranscript:
      "Tôi cho rằng nên chấm dứt các cuộc thi cạnh tranh vì chúng tạo áp lực, làm học sinh học vì giải thưởng, và khiến nhiều bạn thấy mình thua kém.",
    previousRoundText:
      "Tôi cho rằng nên chấm dứt các cuộc thi cạnh tranh vì chúng tạo áp lực và làm lệch mục tiêu học tập.",
    response:
      "Cảm ơn phần mở đầu của bạn. Tuy nhiên, tôi muốn phản biện ở ba điểm. Thứ nhất, vấn đề không nằm ở cạnh tranh, mà nằm ở cách thiết kế cuộc thi. Một cuộc thi có luật rõ ràng, phản hồi tử tế và mục tiêu học tập minh bạch có thể giúp học sinh rèn khả năng quản lý thời gian, trình bày ý tưởng và chịu áp lực tích cực. Thứ hai, nếu bỏ toàn bộ cuộc thi, chúng ta cũng bỏ đi một môi trường để học sinh thử sức bên ngoài lớp học. Thứ ba, giải pháp hợp lý hơn là cải thiện tiêu chí đánh giá, hỗ trợ sức khỏe tinh thần và giảm văn hóa thành tích, thay vì cấm hẳn một công cụ có thể được dùng tốt.",
    voice: "vi-VN-Chirp3-HD-Kore",
    highlights: [
      {
        type: "claim" as const,
        quote: "vấn đề không nằm ở cạnh tranh, mà nằm ở cách thiết kế cuộc thi",
        note: "Main response frame",
      },
      {
        type: "impact" as const,
        quote:
          "rèn khả năng quản lý thời gian, trình bày ý tưởng và chịu áp lực tích cực",
        note: "Positive student outcome",
      },
    ],
  },
  en: {
    topic: "This house would end competitive academic contests for students.",
    userTranscript:
      "Competitive contests should end because they make students anxious, reward narrow achievement, and turn learning into a ranking game.",
    previousRoundText:
      "Competitive contests should end because they create anxiety and distort the purpose of learning.",
    response:
      "Thank you for the opening case. I disagree for three reasons. First, the problem is not competition itself, but poor contest design. A contest with clear rules, constructive feedback, and transparent learning goals can help students practice time management, public reasoning, and resilience under pressure. Second, removing every contest also removes a structured place where students can test ideas beyond the classroom. Third, the better remedy is to reform judging criteria, reduce unhealthy prize culture, and support student wellbeing, rather than banning a tool that can be used responsibly.",
    voice: "aura-asteria-en",
    highlights: [
      {
        type: "claim" as const,
        quote: "the problem is not competition itself, but poor contest design",
        note: "Main response frame",
      },
      {
        type: "impact" as const,
        quote:
          "practice time management, public reasoning, and resilience under pressure",
        note: "Positive student outcome",
      },
    ],
  },
};

function isQaTab(value: string | null): value is QaTab {
  return tabs.some((tab) => tab.key === value);
}

function getReviewTab(value: string | null): SessionReviewTab {
  if (value === "transcript" || value === "clash" || value === "verdict") {
    return value;
  }

  return "overall";
}

function TranscriptPanel({
  session,
  backHref,
}: {
  session: typeof showcaseAnnotatedSession;
  backHref: string;
}) {
  return (
    <SessionTranscriptPanel
      session={session}
      annotations={session.feedback?.transcriptAnnotations}
      backHref={backHref}
      backLabel={backHref === "/history" ? "Back to History" : "Back to Practice"}
      emptyLabel="No transcript was recorded for this session."
      suggestionLabel="Try this"
      unmatchedLabel="Quote not found"
      roundLabel={(round) => `Round ${round}`}
    />
  );
}

export function DevPracticeQaPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: QaTab = isQaTab(requestedTab) ? requestedTab : "setup";
  const initialHistoryTab = getReviewTab(searchParams.get("historyTab"));
  const defaultShowTranscript = searchParams.get("openTranscript") === "1";
  const showLegacyDuel = searchParams.get("duelLegacy") === "1";
  const [activeTab, setActiveTab] = useState<QaTab>(initialTab);
  const [prepNotes, setPrepNotes] = useState(showcasePrepNotes);
  const ttsFixtureLanguage = searchParams.get("ttsLang") === "en" ? "en" : "vi";
  const aiTtsFixture = aiTtsFixtures[ttsFixtureLanguage];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-outline-variant bg-white p-4">
          <p className="type-eyebrow text-primary">
            Localhost QA
          </p>
          <h1 className="mt-2 text-2xl font-bold text-on-surface">
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
                    ? "border-primary bg-primary-container text-primary-dim"
                    : "border-outline-variant bg-white text-on-surface-variant hover:bg-background"
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
            topic={showcaseTopic}
            isBookmarked={false}
            onToggleBookmark={() => undefined}
            orbBalance={9999}
            referralCode="LOCALQA"
            onBalanceChange={() => undefined}
            showcaseMode
          />
        </div>
      )}

      {activeTab === "prep" && (
        <PrepPhase
          topic={showcaseTopic}
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
          topic={showcaseTopic}
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
          <SessionReviewShell
            overall={
              <SessionResultDashboard
                session={showcaseAnnotatedSession}
                backHref="/practice"
                backLabel="Back to Practice"
                showInlineReviewControls={false}
                className="max-w-none px-0 py-0"
              />
            }
            transcript={
              <TranscriptPanel
                session={showcaseAnnotatedSession}
                backHref="/practice"
              />
            }
          />
          <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-outline-variant bg-white p-4">
              <h2 className="text-lg font-bold text-on-surface">
                Legacy feedback compatibility
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                This second dashboard has no transcriptAnnotations field.
              </p>
            </div>
          </div>
          <SessionResultDashboard
            session={showcaseLegacySession}
            backHref="/practice"
            backLabel="Back to Practice"
            defaultShowTranscript={defaultShowTranscript}
            showInlineReviewControls={false}
          />
        </div>
      )}

      {activeTab === "history" && (
        <SessionReviewShell
          initialTab={initialHistoryTab}
          className="pb-12"
          overall={
            <SessionResultDashboard
              session={showcaseAnnotatedSession}
              backHref="/history"
              backLabel="Back to History"
              showInlineReviewControls={false}
              className="max-w-none px-0 py-0"
            />
          }
          transcript={
            <TranscriptPanel
              session={showcaseAnnotatedSession}
              backHref="/history"
            />
          }
        />
      )}

      {activeTab === "duels" && (
        <div className="space-y-8 pb-12">
          <DuelCreatePage initialTopics={[showcaseTopic]} showcaseMode />
          <DuelMatchmakingPage initialTopics={[showcaseTopic]} showcaseMode />
        </div>
      )}

      {activeTab === "duel-result" && (
        <DuelResultContent
          room={showLegacyDuel ? showcaseLegacyDuelRoom : showcaseDuelRoom}
          initialTab={initialHistoryTab}
        />
      )}

      {activeTab === "ai-debate" && (
        <SessionReviewShell
          initialTab={initialHistoryTab}
          className="pb-12"
          verdict={<DebateVerdictPanel session={showcaseFullRoundSession} />}
          overall={
            <SessionResultDashboard
              session={showcaseFullRoundSession}
              backHref="/history"
              backLabel="Back to History"
              showInlineReviewControls={false}
              className="max-w-none px-0 py-0"
            />
          }
          transcript={
            <TranscriptPanel
              session={showcaseFullRoundSession}
              backHref="/history"
            />
          }
          clashMap={<DebateClashMapPanel session={showcaseFullRoundSession} />}
        />
      )}

      {activeTab === "ai-tts" && (
        <AiRebuttalPhase
          topic={aiTtsFixture.topic}
          side="opposition"
          userTranscript={aiTtsFixture.userTranscript}
          roundLabel="AI Rebuttal"
          difficulty="medium"
          practiceTrack="debate"
          practiceLanguage={ttsFixtureLanguage}
          previousRounds={[
            {
              label: "Opening",
              speaker: "student",
              text: aiTtsFixture.previousRoundText,
            },
          ]}
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          onComplete={() => undefined}
          onGenerated={() => undefined}
          initialResponse={aiTtsFixture.response}
          initialHighlights={aiTtsFixture.highlights}
          ttsVoice={aiTtsFixture.voice}
        />
      )}
    </main>
  );
}
