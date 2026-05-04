"use client";

import { useState, useEffect, use } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultActionButton } from "@/components/feedback/result-action-button";
import { DebateClashMapPanel } from "@/components/feedback/debate-clash-map-panel";
import { DebateVerdictPanel } from "@/components/feedback/debate-verdict-panel";
import { SessionReviewShell } from "@/components/feedback/session-review-shell";
import { SessionResultDashboard } from "@/components/feedback/session-result-dashboard";
import { SessionTranscriptPanel } from "@/components/feedback/session-transcript-panel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { storage, supabaseStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import type { DebateSession } from "@/types";

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const tResult = useTranslations("sessionResult");
  const tHistory = useTranslations("dashboard.history");
  const [session, setSession] = useState<DebateSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    setTopic,
    setSide,
    setPracticeTrack,
    setMode,
    setPrepTime,
    setSpeechTime,
    setAiDifficulty,
    startSession: storeStartSession,
  } = useSessionStore();

  useEffect(() => {
    const loadSession = async () => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      let s: DebateSession | null = null;
      if (authData.user) {
        s = await supabaseStorage.getSession(id, authData.user.id);
      } else {
        s = storage.getSession(id);
      }
      if (s) {
        setSession(s);
      } else {
        setNotFound(true);
      }
      setMounted(true);
    };
    loadSession();
  }, [id]);

  const handleRetry = () => {
    if (!session) return;
    const { resetSession } = useSessionStore.getState();
    const practiceTrack =
      session.practiceTrack ?? session.feedback?.practiceTrack ?? "debate";
    resetSession();
    setTopic(session.topic);
    setPracticeTrack(practiceTrack);
    setSide(session.side);
    setMode(session.mode);
    setPrepTime(session.prepTime);
    setSpeechTime(session.speechTime);
    if (practiceTrack === "debate" && session.mode === "full" && session.aiDifficulty) {
      setAiDifficulty(session.aiDifficulty);
    }
    storeStartSession();
    router.push("/practice/session");
  };

  const handleDelete = async () => {
    if (!session) return;
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      await supabaseStorage.deleteSession(session.id, authData.user.id);
    } else {
      storage.deleteSession(session.id);
    }
    router.push("/history");
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <h1 className="text-2xl font-bold text-on-surface">
          {tResult("notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {tResult("notFoundBody")}
        </p>
        <Link href="/history" className="mt-6">
          <Button
            variant="outline"
            className="gap-2 border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant"
          >
            <ArrowLeft className="h-4 w-4" />
            {tResult("backToHistory")}
          </Button>
        </Link>
      </div>
    );
  }

  if (!session) return null;

  const practiceTrack = session.practiceTrack ?? session.feedback?.practiceTrack ?? "debate";
  const feedback = session.feedback
    ? {
        ...session.feedback,
        practiceTrack: session.feedback.practiceTrack ?? practiceTrack,
      }
    : null;
  const sessionWithNormalizedFeedback = feedback
    ? {
        ...session,
        feedback,
      }
    : session;
  const coachPrompt =
    practiceTrack === "speaking"
      ? `I just reviewed my speaking practice on "${session.topic.title}" (${session.side} side). I scored ${feedback?.totalScore ?? "N/A"}/100 (${feedback?.overallBand ?? "Unrated"}). Can you help me improve my clarity, structure, and delivery?`
      : `I just reviewed my debate on "${session.topic.title}" (${session.side} side, ${session.mode} mode). I scored ${feedback?.totalScore ?? "N/A"}/100 (${feedback?.overallBand ?? "Unrated"}). Can you help me analyze my stance, argument depth, weighing, and rebuttals?`;
  const isFullRoundDebate =
    practiceTrack === "debate" && session.mode === "full" && Boolean(session.rounds?.length);

  return (
    <div className="min-h-screen bg-background">
      {feedback ? (
        <SessionReviewShell
          verdict={
            isFullRoundDebate ? (
              <DebateVerdictPanel session={sessionWithNormalizedFeedback} />
            ) : undefined
          }
          overall={
            <SessionResultDashboard
              session={sessionWithNormalizedFeedback}
              backHref="/history"
              backLabel={tResult("backToHistory")}
              shareUrl={`/history/${session.id}`}
              showInlineReviewControls={false}
              className="max-w-none px-0 py-0"
              actionBar={
                <div className="flex flex-wrap gap-3">
                  <ResultActionButton onClick={handleRetry} tone="primary">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {tResult("actions.retryTopic")}
                  </ResultActionButton>
                  <Link
                    href={`/chat?message=${encodeURIComponent(
                      coachPrompt
                    )}&context=practice-feedback&contextId=${session.id}`}
                  >
                    <ResultActionButton tone="coach">
                      <Sparkles className="mr-2 h-4 w-4" />
                      {tResult("actions.askCoach")}
                    </ResultActionButton>
                  </Link>
                  <ResultActionButton
                    onClick={() => setShowDelete(true)}
                    tone="danger"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {tResult("actions.deleteSession")}
                  </ResultActionButton>
                </div>
              }
            />
          }
          transcript={
            <SessionTranscriptPanel
              session={sessionWithNormalizedFeedback}
              annotations={feedback.transcriptAnnotations}
              backHref="/history"
              backLabel={tResult("backToHistory")}
              emptyLabel={tResult("detail.emptyTranscript")}
              suggestionLabel={tResult("annotations.suggestion")}
              unmatchedLabel={tResult("annotations.unmatched")}
              roundLabel={(roundNumber) =>
                tResult("annotations.round", { round: roundNumber })
              }
            />
          }
          clashMap={
            isFullRoundDebate ? (
              <DebateClashMapPanel session={sessionWithNormalizedFeedback} />
            ) : undefined
          }
        />
      ) : (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              {tResult("noFeedback")}
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title={tHistory("delete_title")}
        description={tHistory("delete_description")}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
