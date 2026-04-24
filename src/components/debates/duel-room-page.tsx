"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquareText,
  Mic2,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DuelLobbySetupView } from "@/components/debates/duel-setup-flow";
import { cn } from "@/lib/utils";
import { useDebateDuelRoom } from "@/hooks/use-debate-duel-room";
import {
  DUEL_PHASES,
  getCurrentPhaseDuration,
  getPhaseDescriptor,
  getPhaseRemainingSeconds,
} from "@/lib/debate-duels/shared";
import { useDeepgramTranscription } from "@/hooks/use-deepgram-transcription";
import type { DebateDuelParticipant, DebateDuelSide } from "@/types";

interface DuelRoomPageProps {
  shareCode: string;
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getSideLabel(side: DebateDuelSide | null) {
  if (side === "proposition") return "Proposition";
  if (side === "opposition") return "Opposition";
  return "Pending";
}

export function DuelRoomPage({ shareCode }: DuelRoomPageProps) {
  const router = useRouter();
  const { data: room, error, mutate, isLoading } = useDebateDuelRoom(shareCode);
  const speech = useDeepgramTranscription();
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isSubmittingSpeech, startSubmitTransition] = useTransition();
  const [isMutatingRoom, startRoomTransition] = useTransition();
  const streamRef = useRef<MediaStream | null>(null);
  const activePhaseRef = useRef<string | null>(null);
  const submittedPhaseRef = useRef<string | null>(null);

  const phaseDescriptor = room ? getPhaseDescriptor(room.currentPhase) : null;
  const activeSpeaker =
    !!room &&
    room.status === "in_progress" &&
    !!room.viewer.role &&
    phaseDescriptor?.activeSide === room.viewer.role;

  const acquireMicStream = useCallback(async () => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track && track.readyState === "live") {
        return streamRef.current;
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;
    return stream;
  }, []);

  const stopCapture = useCallback(() => {
    speech.stopListening();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [speech]);

  useEffect(() => {
    if (!room) return;
    const update = () => {
      setRemainingSeconds(getPhaseRemainingSeconds(room));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [room]);

  useEffect(() => {
    if (room?.status === "completed") {
      router.replace(`/debates/${shareCode}/result`);
    }
  }, [room?.status, router, shareCode]);

  useEffect(() => {
    if (!room || !phaseDescriptor || !activeSpeaker || remainingSeconds <= 0) {
      stopCapture();
      return;
    }

    const phaseKey = `${room.currentPhase}:${room.phaseStartedAt}`;
    if (activePhaseRef.current === phaseKey) {
      return;
    }

    activePhaseRef.current = phaseKey;
    submittedPhaseRef.current = null;
    speech.resetTranscript();

    acquireMicStream()
      .then((stream) => {
        speech.startListening(stream);
      })
      .catch(() => {
        setActionError("Microphone access is required for your active speech.");
      });

    return undefined;
  }, [
    acquireMicStream,
    activeSpeaker,
    phaseDescriptor,
    remainingSeconds,
    room,
    speech,
    stopCapture,
  ]);

  const submitSpeech = useCallback(() => {
    if (!room || !phaseDescriptor?.roundNumber) return;
    const phaseKey = `${room.currentPhase}:${room.phaseStartedAt}`;
    if (submittedPhaseRef.current === phaseKey) return;
    submittedPhaseRef.current = phaseKey;
    const transcript = speech.transcript.trim() || "[No transcript captured]";
    const phaseDuration = getCurrentPhaseDuration(room);
    const durationSeconds = Math.max(0, phaseDuration - remainingSeconds);

    startSubmitTransition(async () => {
      stopCapture();
      setActionError(null);

      const response = await fetch(
        `/api/debate-duels/${shareCode}/speeches/${phaseDescriptor.roundNumber}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            durationSeconds,
            metadata: {
              wordCount: transcript
                .replace("[No transcript captured]", "")
                .split(/\s+/)
                .filter(Boolean).length,
            },
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        submittedPhaseRef.current = null;
        setActionError(payload.error || "Failed to submit speech.");
        return;
      }

      speech.resetTranscript();
      await mutate();
    });
  }, [
    mutate,
    phaseDescriptor,
    remainingSeconds,
    room,
    shareCode,
    speech,
    startSubmitTransition,
    stopCapture,
  ]);

  useEffect(() => {
    if (!activeSpeaker || remainingSeconds > 0 || isSubmittingSpeech) {
      return;
    }

    submitSpeech();
  }, [activeSpeaker, isSubmittingSpeech, remainingSeconds, submitSpeech]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  const performRoomAction = async (
    path: string,
    body?: Record<string, unknown>
  ) => {
    setActionError(null);
    startRoomTransition(async () => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload.error || "Something went wrong.");
        return;
      }
      await mutate(payload, { revalidate: false });
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
  };

  const waitingLabel = useMemo(() => {
    if (!room || !phaseDescriptor) return "";
    if (room.status === "judging") return "AI judging in progress...";
    if (phaseDescriptor.activeSide) {
      return phaseDescriptor.activeSide === room.viewer.role
        ? "Your mic is live for this phase."
        : `${
            phaseDescriptor.activeSide === "proposition"
              ? "Proposition"
              : "Opposition"
          } is speaking now.`;
    }
    return "Prep is shared. Use your notes to tighten your case.";
  }, [phaseDescriptor, room]);

  const participantByRole = useMemo(() => {
    if (!room) {
      return {
        proposition: null as DebateDuelParticipant | null,
        opposition: null as DebateDuelParticipant | null,
      };
    }

    return {
      proposition:
        room.participants.find(
          (participant) => participant.role === "proposition"
        ) ?? null,
      opposition:
        room.participants.find(
          (participant) => participant.role === "opposition"
        ) ?? null,
    };
  }, [room]);

  const viewerParticipant = useMemo(() => {
    if (!room) return null;
    return (
      room.participants.find((participant) => participant.userId === room.viewer.id) ??
      null
    );
  }, [room]);

  const speechCount = room?.speeches.length ?? 0;
  const readyCount =
    room?.participants.filter((participant) => participant.readyAt).length ?? 0;
  const currentPhaseIndex = room
    ? DUEL_PHASES.findIndex((phase) => phase.phase === room.currentPhase)
    : -1;

  const isLobby = room?.status === "lobby";
  const isJudging = room?.status === "judging";
  const statusLabel =
    room?.status === "lobby"
      ? "Waiting room"
      : room?.status === "in_progress"
        ? "Live duel"
        : room?.status === "judging"
          ? "AI judging"
          : room?.status === "completed"
            ? "Completed"
            : room?.status.replace("_", " ");

  const statusTone =
    room?.status === "in_progress"
      ? "text-primary bg-primary/10 border-primary/20"
      : room?.status === "judging"
        ? "text-warning bg-warning/10 border-warning/20"
        : room?.status === "completed"
          ? "text-success bg-success/10 border-success/20"
          : "text-on-surface-variant bg-surface-container-low border-outline-variant/15";

  const renderParticipantCard = (side: DebateDuelSide) => {
    const participant = participantByRole[side];
    const isCurrentSpeaker =
      room?.status === "in_progress" && phaseDescriptor?.activeSide === side;
    const isViewer = participant?.userId === room?.viewer.id;
    const readyState =
      room?.status === "lobby"
        ? participant?.readyAt
          ? "Ready"
          : participant
            ? "Waiting"
            : "Open seat"
        : isJudging
          ? "Submitted"
          : isCurrentSpeaker
            ? "Live"
            : "Listening";

    const readyTone =
      readyState === "Live"
        ? "border-primary/20 bg-primary/10 text-primary"
        : readyState === "Ready" || readyState === "Submitted"
          ? "border-success/20 bg-success/10 text-success"
          : "border-outline-variant/15 bg-surface text-on-surface-variant";

    return (
      <div
        key={side}
        className={cn(
          "rounded-[24px] border px-4 py-4 transition-colors",
          isCurrentSpeaker
            ? "border-primary/28 bg-primary/6"
            : "border-outline-variant/15 bg-surface"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-sm font-semibold text-primary">
              {participant ? getInitials(participant.displayName) : side === "proposition" ? "P" : "O"}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {getSideLabel(side)}
              </div>
              <div className="mt-1 text-base font-semibold text-on-surface">
                {participant?.displayName || "Waiting for opponent"}
              </div>
            </div>
          </div>
          <div
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
              readyTone
            )}
          >
            {readyState}
          </div>
        </div>

        <p className="mt-3 text-sm text-on-surface-variant">
          {isViewer
            ? "This is you on this device."
            : participant
              ? room?.status === "lobby"
                ? "Ready up before the duel begins."
                : isCurrentSpeaker
                  ? "Currently holding the floor."
                  : "Following the live round."
              : "Share the room code to fill this seat."}
        </p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-outline-variant/20 bg-surface p-6 text-center shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
          <h1 className="text-2xl font-semibold text-on-surface">
            Duel room unavailable
          </h1>
          <p className="mt-3 text-on-surface-variant">
            {error instanceof Error
              ? error.message
              : "We couldn't load this duel room."}
          </p>
        </div>
      </div>
    );
  }

  if (room.status === "lobby") {
    return <DuelLobbySetupView room={room} mutate={mutate} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-outline-variant/15 bg-surface p-6 shadow-[0_18px_45px_rgba(11,20,66,0.06)] lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Users className="h-3.5 w-3.5" />
                1v1 Debate
              </div>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-on-surface sm:text-4xl">
                {room.topicTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                {room.topicCategory}
                {room.topicDescription ? ` · ${room.topicDescription}` : ""}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Share code
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xl font-semibold tracking-[0.14em] text-on-surface">
                    {room.shareCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/20 bg-surface text-primary transition-colors hover:bg-surface-container-lowest"
                    aria-label="Copy duel link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Status
                </div>
                <div
                  className={cn(
                    "mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize",
                    statusTone
                  )}
                >
                  {statusLabel}
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Format
                </div>
                <div className="mt-2 text-xl font-semibold text-on-surface">
                  4 speeches
                </div>
                <div className="mt-1 text-sm text-on-surface-variant">
                  Shared prep + rebuttals
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Entry cost
                </div>
                <div className="mt-2 text-xl font-semibold text-on-surface">
                  {room.config.entryCost} Credits
                </div>
                <div className="mt-1 text-sm text-on-surface-variant">
                  Charged when start succeeds
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="rounded-[30px] border border-outline-variant/15 bg-surface-container-low p-5 lg:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    <Scale className="h-3.5 w-3.5" />
                    {phaseDescriptor?.label || "Lobby"}
                  </div>
                  <h2 className="mt-4 text-3xl font-bold text-on-surface sm:text-[2.35rem]">
                    {isJudging
                      ? "AI is deciding the winner."
                      : phaseDescriptor?.label || "Ready the room"}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                    {waitingLabel}
                  </p>
                </div>

                <div className="min-w-[240px] rounded-[26px] border border-outline-variant/15 bg-surface px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    {isJudging ? "Judge state" : "Round timer"}
                  </div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-on-surface">
                    {isJudging ? "Reviewing" : formatTimer(remainingSeconds)}
                  </div>
                  <div className="mt-2 text-sm text-on-surface-variant">
                    {isJudging
                      ? "Decision appears right after the final rebuttal."
                      : phaseDescriptor?.activeSide
                        ? `${getSideLabel(phaseDescriptor.activeSide)} currently has the floor.`
                        : "Prep time is shared across both debaters."}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {renderParticipantCard("proposition")}
                {renderParticipantCard("opposition")}
              </div>

              {isLobby ? (
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-[26px] border border-outline-variant/15 bg-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-on-surface">
                          Room ready check
                        </div>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          Both debaters must join and ready up before credits are charged and the duel begins.
                        </p>
                      </div>
                      <div className="rounded-full border border-outline-variant/15 bg-surface-container-low px-4 py-2 text-sm font-medium text-on-surface">
                        {readyCount}/2 ready
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
                      {room.participants.length < 2
                        ? "Share this room code with your opponent. They can join on their own device, pick up their side, and mark ready."
                        : "Both seats are filled. Once both debaters are ready, the creator can start the duel."}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {!room.viewer.isParticipant && room.canJoin && (
                        <Button
                          onClick={() =>
                            performRoomAction(`/api/debate-duels/${shareCode}/join`)
                          }
                          disabled={isMutatingRoom}
                          className="h-11 rounded-2xl bg-primary text-on-primary hover:bg-primary/90"
                        >
                          Join duel
                        </Button>
                      )}

                      {room.viewer.isParticipant && (
                        <Button
                          onClick={() =>
                            performRoomAction(
                              `/api/debate-duels/${shareCode}/ready`,
                              {
                                ready: !viewerParticipant?.readyAt,
                              }
                            )
                          }
                          disabled={isMutatingRoom}
                          variant="outline"
                          className="h-11 rounded-2xl border-outline-variant/25 bg-surface text-on-surface"
                        >
                          {viewerParticipant?.readyAt ? "Unready" : "Mark ready"}
                        </Button>
                      )}

                      {room.canStart && (
                        <Button
                          onClick={() =>
                            performRoomAction(`/api/debate-duels/${shareCode}/start`)
                          }
                          disabled={isMutatingRoom}
                          className="h-11 rounded-2xl bg-primary text-on-primary hover:bg-primary/90"
                        >
                          Start duel
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-outline-variant/15 bg-surface p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                      <Bot className="h-4 w-4" />
                      AI judge
                    </div>
                    <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                      After the last rebuttal, DebateLab compares burden, logic, clash, weighing, evidence, and delivery before deciding the winner.
                    </p>
                    <div className="mt-5 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
                      Credits are deducted only once both debaters are ready and the duel officially starts.
                    </div>
                  </div>
                </div>
              ) : isJudging ? (
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-[26px] border border-outline-variant/15 bg-surface p-5">
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="text-lg font-semibold text-on-surface">
                          AI judging in progress
                        </h3>
                        <p className="text-sm text-on-surface-variant">
                          All speeches are locked. The system is comparing the full exchange now.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
                        <span>Submitted speeches</span>
                        <span className="font-medium text-on-surface">
                          {speechCount}/4 complete
                        </span>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-surface-container-high">
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${Math.min(100, (speechCount / 4) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-outline-variant/15 bg-surface p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                      <MessageSquareText className="h-4 w-4" />
                      Local notes
                    </div>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Keep any last notes here while the AI judge decides."
                      className="mt-4 min-h-[220px] w-full rounded-2xl border border-outline-variant/18 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                  <div className="rounded-[26px] border border-outline-variant/15 bg-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-on-surface">
                          {phaseDescriptor?.activeSide
                            ? activeSpeaker
                              ? "Your live speech panel"
                              : "Listening view"
                            : "Shared prep desk"}
                        </div>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {phaseDescriptor?.activeSide
                            ? activeSpeaker
                              ? "Speak naturally. Your transcript submits automatically when the timer ends."
                              : "Only the active speaker is recorded. Use this time to track the case and prepare your reply."
                            : "Both debaters can prep now. These notes stay only on this device."}
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container-low px-4 py-2 text-sm text-on-surface">
                        <Mic2 className="h-4 w-4 text-primary" />
                        {phaseDescriptor?.activeSide
                          ? activeSpeaker
                            ? "Mic live"
                            : "Listening"
                          : "Prep window"}
                      </div>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-outline-variant/12 bg-surface-container-low px-4 py-4">
                      <div className="mb-2 text-sm font-medium text-on-surface">
                        {phaseDescriptor?.activeSide ? "Live transcript" : "Prep focus"}
                      </div>
                      <p className="min-h-[220px] whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">
                        {phaseDescriptor?.activeSide
                          ? activeSpeaker
                            ? speech.transcript || "Start speaking when you’re ready."
                            : "Your opponent’s live transcript stays hidden during the speech. Focus on listening, tracking impacts, and preparing your notes."
                          : "Use this shared prep window to sharpen framing, organize warrants, and decide what your strongest comparative points will be."}
                      </p>
                    </div>

                    {phaseDescriptor?.activeSide && activeSpeaker && (
                      <div className="mt-4 flex justify-end">
                        <Button
                          onClick={submitSpeech}
                          disabled={isSubmittingSpeech}
                          className="h-11 rounded-2xl bg-primary text-on-primary hover:bg-primary/90"
                        >
                          {isSubmittingSpeech ? "Submitting..." : "Submit early"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[26px] border border-outline-variant/15 bg-surface p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                      <MessageSquareText className="h-4 w-4" />
                      Local notes
                    </div>
                    <p className="mt-3 text-sm text-on-surface-variant">
                      Keep rebuttal ideas, weighing, and reminders on this device only.
                    </p>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Write quick notes, impacts, or rebuttal layers here."
                      className="mt-4 min-h-[260px] w-full rounded-2xl border border-outline-variant/18 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
                    />
                  </div>
                </div>
              )}

              {actionError && (
                <div className="mt-4 rounded-2xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                  {actionError}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-4 w-4" />
                  Round flow
                </div>
                <div className="mt-5 space-y-3">
                  {DUEL_PHASES.map((phase, index) => {
                    const isActive = phase.phase === room.currentPhase;
                    const isComplete =
                      room.status === "judging" ||
                      room.status === "completed" ||
                      currentPhaseIndex > index;

                    return (
                      <div
                        key={phase.phase}
                        className={cn(
                          "rounded-[22px] border px-4 py-3 transition-colors",
                          isActive
                            ? "border-primary/20 bg-primary/8"
                            : isComplete
                              ? "border-success/16 bg-success/5"
                              : "border-outline-variant/12 bg-surface-container-low"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                                isActive
                                  ? "bg-primary text-on-primary"
                                  : isComplete
                                    ? "bg-success/12 text-success"
                                    : "bg-surface text-on-surface-variant"
                              )}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-on-surface">
                                {phase.label}
                              </div>
                              <div className="mt-1 text-xs text-on-surface-variant">
                                {formatTimer(phase.durationSeconds(room))}
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium",
                              isActive
                                ? "bg-primary/12 text-primary"
                                : isComplete
                                  ? "bg-success/12 text-success"
                                  : "bg-surface text-on-surface-variant"
                            )}
                          >
                            {isActive
                              ? "Live"
                              : isComplete
                                ? "Done"
                                : "Next"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  <Users className="h-4 w-4" />
                  Room board
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      Ready state
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-on-surface">
                      {readyCount}/2
                    </div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      Debaters ready before start
                    </div>
                  </div>

                  <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      Speech progress
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-on-surface">
                      {speechCount}/4
                    </div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      Submitted speeches
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                    <Bot className="h-4 w-4 text-primary" />
                    AI judge after the last rebuttal
                  </div>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    The verdict compares burden, mechanism, clash, weighing, evidence, and delivery across the whole duel.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
