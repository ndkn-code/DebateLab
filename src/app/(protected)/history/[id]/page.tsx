"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreHero } from "@/components/feedback/score-hero";
import { CategoryCards } from "@/components/feedback/category-cards";
import { FeedbackSections } from "@/components/feedback/feedback-sections";
import { DebateTimeline } from "@/components/feedback/debate-timeline";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { storage, supabaseStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";
import type { DebateSession } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<DebateSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { setTopic, startSession: storeStartSession } = useSessionStore();

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
    resetSession();
    setTopic(session.topic);
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
        <h1 className="text-2xl font-bold text-on-surface">Session Not Found</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          This session may have been deleted or doesn&apos;t exist.
        </p>
        <Link href="/history" className="mt-6">
          <Button
            variant="outline"
            className="gap-2 border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Button>
        </Link>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Session Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-xl font-bold text-on-surface sm:text-2xl">
            {session.topic.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold",
                session.side === "proposition"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              )}
            >
              {session.side === "proposition" ? "FOR" : "AGAINST"}
            </span>
            <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
              {session.mode === "full" ? "Full Round" : "Quick Practice"}
            </span>
            <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
              {session.topic.category}
            </span>
            {session.aiDifficulty && (
              <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-xs capitalize text-on-surface-variant">
                {session.aiDifficulty} AI
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(session.date)} at {formatTime(session.date)}
            </span>
            {session.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(session.duration)}
              </span>
            )}
          </div>
        </motion.div>

        {/* Score & Feedback */}
        {session.feedback ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            <ScoreHero feedback={session.feedback} />

            <div>
              <h2 className="mb-4 text-lg font-semibold text-on-surface">
                Category Breakdown
              </h2>
              <CategoryCards feedback={session.feedback} />
            </div>

            {/* Debate Timeline (Full Round only) */}
            {session.mode === "full" && session.rounds && session.rounds.length > 0 && (
              <DebateTimeline rounds={session.rounds} />
            )}

            <FeedbackSections
              feedback={session.feedback}
              transcript={session.transcript}
            />
          </motion.div>
        ) : (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              No feedback available for this session.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 border-t border-outline-variant/10 pt-8 sm:flex-row">
          <Link href="/history">
            <Button
              variant="outline"
              className="w-full gap-2 border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to History
            </Button>
          </Link>
          <Button
            onClick={handleRetry}
            className="gap-2 bg-primary text-white hover:bg-primary-dim"
          >
            <RotateCcw className="h-4 w-4" />
            Retry This Topic
          </Button>
          <Button
            onClick={() => setShowDelete(true)}
            variant="outline"
            className="gap-2 border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete Session
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Session"
        description="Are you sure you want to delete this session? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
