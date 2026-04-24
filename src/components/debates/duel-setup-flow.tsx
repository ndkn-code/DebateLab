"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import type { KeyedMutator } from "swr";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  Edit3,
  Link2,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DUEL_ENTRY_COST } from "@/lib/debate-duels/shared";
import type {
  DebateDuelParticipant,
  DebateDuelRoomView,
  DebateDuelSide,
  DebateDuelTopicDifficulty,
} from "@/types";

type StepState = "complete" | "active" | "upcoming";

interface FlowStep {
  number: number;
  label: string;
  detail: string;
  state: StepState;
}

interface DuelFlowStepperProps {
  mode: "configure" | "invite" | "start";
}

function formatMinutes(seconds: number) {
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

function formatDifficulty(difficulty: DebateDuelTopicDifficulty) {
  if (difficulty === "beginner") return "Easy";
  if (difficulty === "intermediate") return "Medium";
  return "Hard";
}

function getSideLabel(side: DebateDuelSide) {
  return side === "proposition" ? "Proposition" : "Opposition";
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DuelFlowStepper({ mode }: DuelFlowStepperProps) {
  const steps: FlowStep[] = [
    {
      number: 1,
      label: "Configure",
      detail: "Room setup",
      state: mode === "configure" ? "active" : "complete",
    },
    {
      number: 2,
      label: "Invite",
      detail: "Share & get ready",
      state:
        mode === "configure"
          ? "upcoming"
          : mode === "invite"
            ? "active"
            : "complete",
    },
    {
      number: 3,
      label: "Start",
      detail: "Begin the duel",
      state: mode === "start" ? "active" : "upcoming",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
              step.state === "complete" &&
                "border-primary bg-primary text-on-primary",
              step.state === "active" &&
                "border-primary bg-primary text-on-primary shadow-[0_8px_18px_rgba(66,133,244,0.24)]",
              step.state === "upcoming" &&
                "border-outline-variant/45 bg-surface text-on-surface-variant"
            )}
          >
            {step.state === "complete" ? <Check className="h-5 w-5" /> : step.number}
          </div>
          <div className="min-w-0">
            <div
              className={cn(
                "text-sm font-semibold",
                step.state === "upcoming" ? "text-on-surface-variant" : "text-primary"
              )}
            >
              {step.label}
            </div>
            <div className="text-xs text-on-surface-variant">{step.detail}</div>
          </div>
          {index < steps.length - 1 && (
            <div className="hidden h-px flex-1 bg-outline-variant/30 sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

export function DuelRoundTimeline({
  prepTimeSeconds,
  openingTimeSeconds,
  rebuttalTimeSeconds,
  activeIndex = 0,
}: {
  prepTimeSeconds: number;
  openingTimeSeconds: number;
  rebuttalTimeSeconds: number;
  activeIndex?: number;
}) {
  const items = [
    ["Shared Prep", prepTimeSeconds],
    ["Proposition Opening", openingTimeSeconds],
    ["Opposition Opening", openingTimeSeconds],
    ["Rebuttal Prep", Math.max(30, Math.min(prepTimeSeconds, 60))],
    ["Proposition Rebuttal", rebuttalTimeSeconds],
    ["Opposition Rebuttal", rebuttalTimeSeconds],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, seconds], index) => {
        const active = index === activeIndex;
        const complete = index < activeIndex;
        return (
          <div key={label} className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  active && "border-primary bg-primary text-on-primary",
                  complete && "border-success/20 bg-success/10 text-success",
                  !active && !complete && "border-outline-variant/30 bg-surface text-on-surface-variant"
                )}
              >
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < items.length - 1 && (
                <div
                  className={cn(
                    "hidden h-0.5 flex-1 rounded-full sm:block",
                    complete ? "bg-success/40" : "bg-outline-variant/30"
                  )}
                />
              )}
            </div>
            <div className="mt-2 text-xs font-semibold leading-tight text-on-surface">
              {label}
            </div>
            <div className="mt-1 text-xs text-on-surface-variant">
              {formatMinutes(seconds)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeatCard({
  side,
  participant,
  viewerId,
  startMode,
}: {
  side: DebateDuelSide;
  participant: DebateDuelParticipant | null;
  viewerId: string;
  startMode: boolean;
}) {
  const isViewer = participant?.userId === viewerId;
  const ready = !!participant?.readyAt;
  const sideLocked = !!participant?.role;
  const status = participant
    ? !sideLocked
      ? "Side pending"
      : ready
      ? "Ready"
      : "Joined"
    : "Open seat";

  return (
    <div className="rounded-[24px] border border-outline-variant/15 bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold",
              side === "proposition"
                ? "bg-primary/10 text-primary"
                : "bg-error/10 text-error"
            )}
          >
            {side === "proposition" ? "P" : "O"}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              {participant && !sideLocked ? "Your seat" : getSideLabel(side)}
            </div>
            <div className="mt-1 text-base font-semibold text-on-surface">
              {participant
                ? `${participant.displayName}${isViewer ? " (You)" : ""}`
                : "Waiting for opponent"}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            ready && "bg-success/10 text-success",
            participant && !ready && "bg-primary/10 text-primary",
            !participant && "bg-surface-container-low text-primary"
          )}
        >
          {isViewer && ready ? "You - Ready" : status}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-on-primary">
          {participant ? getInitials(participant.displayName) || "D" : <UserRound className="h-5 w-5" />}
        </div>
        <div className="text-sm text-on-surface-variant">
          {participant
            ? startMode
              ? "Ready for shared prep."
              : !sideLocked
                ? "Side reveals when your opponent joins."
              : ready
                ? "Waiting for the other debater."
                : "Needs to mark ready."
            : "Share the room code to fill this seat."}
        </div>
      </div>
    </div>
  );
}

function MetricPill({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-outline-variant/12 bg-surface px-3 py-3 text-center text-xs font-medium text-primary">
      {children}
    </div>
  );
}

export function DuelLobbySetupView({
  room,
  mutate,
  onEditSetup,
}: {
  room: DebateDuelRoomView;
  mutate: KeyedMutator<DebateDuelRoomView>;
  onEditSetup?: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ locale?: string | string[] }>();
  const localeParam = Array.isArray(params.locale)
    ? params.locale[0]
    : params.locale;
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const invitePath = `/${localeParam || "en"}/debates/${room.shareCode}`;
  const [inviteUrl, setInviteUrl] = useState(invitePath);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setInviteUrl(`${window.location.origin}${invitePath}`);
  }, [invitePath]);

  const participantsByRole = useMemo(
    () => {
      const unassigned = room.participants.filter(
        (participant) => !participant.role
      );
      return {
        proposition:
          room.participants.find(
            (participant) => participant.role === "proposition"
          ) ??
          unassigned[0] ??
          null,
        opposition:
          room.participants.find(
            (participant) => participant.role === "opposition"
          ) ??
          unassigned[1] ??
          null,
      };
    },
    [room.participants]
  );

  const readyCount = room.participants.filter((participant) => participant.readyAt).length;
  const bothJoined = room.participants.length === 2;
  const bothReady = bothJoined && readyCount === 2;
  const startMode = bothReady;
  const viewerParticipant =
    room.participants.find((participant) => participant.userId === room.viewer.id) ?? null;
  const viewerReady = !!viewerParticipant?.readyAt;

  const runRoomAction = (path: string, body?: Record<string, unknown>) => {
    setActionError(null);
    startTransition(async () => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as DebateDuelRoomView | { error?: string };

      if (!response.ok || !("id" in payload)) {
        setActionError("error" in payload ? payload.error || "Something went wrong." : "Something went wrong.");
        return;
      }

      await mutate(payload, { revalidate: false });
      if (payload.status !== "lobby") {
        router.push(`/debates/${payload.shareCode}`);
      }
    });
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const primaryAction = () => {
    if (room.canJoin) {
      runRoomAction(`/api/debate-duels/${room.shareCode}/join`);
      return;
    }

    if (room.viewer.isParticipant && !viewerReady) {
      runRoomAction(`/api/debate-duels/${room.shareCode}/ready`, { ready: true });
      return;
    }

    if (room.viewer.isParticipant && viewerReady && !bothReady) {
      runRoomAction(`/api/debate-duels/${room.shareCode}/ready`, { ready: false });
      return;
    }

    if (room.canStart) {
      runRoomAction(`/api/debate-duels/${room.shareCode}/start`);
    }
  };

  const primaryLabel = room.canJoin
    ? "Join duel"
    : room.canStart
      ? "Start duel"
      : room.viewer.isParticipant && !viewerReady
        ? "Mark ready"
        : room.viewer.isParticipant && viewerReady && !bothReady
          ? "Unready"
          : room.viewer.isCreator
            ? "Waiting for opponent"
            : "Waiting for creator";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/debates/new")}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              1v1 Debate Arena
            </button>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
              {startMode ? "Ready to start" : "Room created"}
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
              {startMode
                ? "Both debaters are ready. Review the round flow before the duel begins."
                : "Share the code with your opponent and get both debaters ready."}
            </p>
          </div>
          <DuelFlowStepper mode={startMode ? "start" : "invite"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <main className="rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)] lg:p-6">
            {startMode ? (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-outline-variant/12 bg-surface-container-low p-5">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_170px] lg:items-center">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                        {room.topicCategory}
                      </div>
                      <h2 className="mt-2 text-2xl font-bold text-on-surface">
                        {room.topicTitle}
                      </h2>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-on-surface-variant">
                        <span className="rounded-full bg-success/10 px-3 py-1 font-medium text-success">
                          {formatDifficulty(room.topicDifficulty)}
                        </span>
                        <span>~{Math.round((room.config.prepTimeSeconds + room.config.openingTimeSeconds * 2 + room.config.rebuttalTimeSeconds * 2) / 60)} min</span>
                        <span>Structured 1v1</span>
                      </div>
                    </div>
                    <Image
                      src="/images/debates/topic-backpack.png"
                      width={170}
                      height={170}
                      alt=""
                      className="mx-auto h-32 w-32 object-contain lg:h-40 lg:w-40"
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <SeatCard
                    side="proposition"
                    participant={participantsByRole.proposition}
                    viewerId={room.viewer.id}
                    startMode={startMode}
                  />
                  <SeatCard
                    side="opposition"
                    participant={participantsByRole.opposition}
                    viewerId={room.viewer.id}
                    startMode={startMode}
                  />
                </div>

                <div className="rounded-[24px] border border-primary/40 bg-primary/6 p-5">
                  <div className="grid gap-4 md:grid-cols-[130px_minmax(0,1fr)_170px] md:items-center">
                    <Image
                      src="/images/debates/stopwatch.png"
                      width={130}
                      height={130}
                      alt=""
                      className="h-24 w-24 object-contain md:h-32 md:w-32"
                    />
                    <div>
                      <h3 className="text-xl font-bold text-on-surface">
                        Shared prep begins first
                      </h3>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        Both sides can take notes before opening speeches.
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-primary/15 bg-surface px-5 py-4 text-center">
                      <div className="text-xs font-semibold text-on-surface-variant">
                        Shared prep time
                      </div>
                      <div className="mt-1 text-4xl font-bold text-primary">
                        {formatMinutes(room.config.prepTimeSeconds).replace(" min", ":00")}
                      </div>
                      <div className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        First round
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant/12 bg-surface p-5">
                  <h3 className="font-semibold text-on-surface">Readiness checklist</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Both debaters are ready", `${readyCount}/2 ready`],
                      ["Browser & mic permissions ready", "All good"],
                      ["Side assignment locked", room.viewer.role ? getSideLabel(room.viewer.role) : "Assigned"],
                      ["Room code shared", room.shareCode],
                      ["Timers & format confirmed", "Structured 1v1"],
                      ["AI Judge armed", "Will score fairly"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-outline-variant/10 py-2 text-sm last:border-b-0">
                        <span className="inline-flex items-center gap-2 text-on-surface">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          {label}
                        </span>
                        <span className="text-on-surface-variant">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="rounded-[24px] border border-outline-variant/12 bg-surface-container-low p-5">
                    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_132px] sm:items-center">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                          Share room code
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="text-5xl font-bold tracking-[0.14em] text-on-surface">
                            {room.shareCode}
                          </div>
                          <button
                            type="button"
                            onClick={copyInvite}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface text-primary shadow-sm"
                            aria-label="Copy invite"
                          >
                            <Copy className="h-5 w-5" />
                          </button>
                        </div>
                        <p className="mt-3 text-sm text-on-surface-variant">
                          Share this code with your opponent so they can join the room.
                        </p>
                        <Button
                          type="button"
                          onClick={copyInvite}
                          className="mt-4 h-11 w-full rounded-2xl"
                        >
                          <Link2 className="h-4 w-4" />
                          {copied ? "Invite copied" : "Copy invite"}
                        </Button>
                      </div>
                      <div className="rounded-[22px] border border-outline-variant/15 bg-surface p-3 text-center shadow-sm">
                        <QRCodeSVG value={inviteUrl} size={116} level="M" />
                        <div className="mt-2 text-xs text-on-surface-variant">
                          Scan to join
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-outline-variant/12 bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                          Readiness checklist
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                          {[
                            ["Room configured", true, "Format, timers, and settings set"],
                            ["Side assignment selected", true, room.viewer.role ? `You are ${getSideLabel(room.viewer.role)}` : "Reveals when opponent joins"],
                            ["Invite copied", copied, copied ? "Share link copied" : "Copy or scan the room code"],
                            ["Opponent pending", bothJoined, bothJoined ? "Opponent joined" : "Waiting for opponent"],
                          ].map(([label, complete, detail]) => (
                            <div key={String(label)} className="flex gap-3">
                              <CheckCircle2
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  complete ? "text-success" : "text-on-surface-variant/45"
                                )}
                              />
                              <div>
                                <div className="font-medium text-on-surface">{label}</div>
                                <div className="text-xs text-on-surface-variant">{detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Image
                        src="/images/debates/trophy.png"
                        width={112}
                        height={112}
                        alt=""
                        className="hidden h-24 w-24 object-contain sm:block"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <SeatCard
                    side="proposition"
                    participant={participantsByRole.proposition}
                    viewerId={room.viewer.id}
                    startMode={startMode}
                  />
                  <SeatCard
                    side="opposition"
                    participant={participantsByRole.opposition}
                    viewerId={room.viewer.id}
                    startMode={startMode}
                  />
                </div>

                <div className="rounded-[24px] border border-outline-variant/12 bg-surface p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                    <div className="flex gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                        <ShieldCheck className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                          {room.topicCategory}
                        </div>
                        <h2 className="mt-2 text-xl font-bold text-on-surface">
                          {room.topicTitle}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                          {room.topicDescription ||
                            "Debate the same motion on two devices, then let the AI judge compare the full exchange."}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center text-sm">
                      <div className="rounded-2xl bg-success/10 px-4 py-3 text-success">
                        <div className="font-semibold">{formatDifficulty(room.topicDifficulty)}</div>
                        <div className="text-xs">Difficulty</div>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-3 text-on-surface">
                        <div className="font-semibold">
                          ~{Math.round((room.config.prepTimeSeconds + room.config.openingTimeSeconds * 2 + room.config.rebuttalTimeSeconds * 2) / 60)} min
                        </div>
                        <div className="text-xs text-on-surface-variant">Estimated length</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
              <Button
                type="button"
                variant="outline"
                onClick={
                  startMode
                    ? () =>
                        runRoomAction(`/api/debate-duels/${room.shareCode}/ready`, {
                          ready: false,
                        })
                    : onEditSetup
                }
                disabled={pending || (!startMode && !onEditSetup)}
                className="h-12 rounded-2xl border-outline-variant/25 bg-surface text-primary"
              >
                {startMode ? (
                  <>
                    <ArrowLeft className="h-4 w-4" />
                    Back to invite
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Edit setup
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={primaryAction}
                disabled={
                  pending ||
                  (!room.canJoin &&
                    !room.canStart &&
                    (!room.viewer.isParticipant || (viewerReady && bothReady)))
                }
                className="h-12 rounded-2xl text-base"
              >
                {room.canStart && <Play className="h-4 w-4" />}
                {!room.canStart && <Users className="h-4 w-4" />}
                {pending ? "Working..." : primaryLabel}
                {room.canStart && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
              <Lock className="h-3.5 w-3.5" />
              Credits are charged only when both debaters are ready and the duel starts.
            </div>

            {actionError && (
              <div className="mt-4 rounded-2xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                {actionError}
              </div>
            )}
          </main>

          <aside className="space-y-4 rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-on-surface">Duel preview</h2>
              <div className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                Live preview
              </div>
            </div>

            <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-4">
              <Image
                src="/images/debates/duel-preview.png"
                width={320}
                height={220}
                alt=""
                className="mx-auto h-32 w-full object-contain"
              />
              <div className="mt-3 rounded-[20px] border border-outline-variant/12 bg-surface p-4">
                <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
                  {room.topicCategory.split(" & ")[0]}
                </div>
                <h3 className="mt-3 text-lg font-bold leading-snug text-on-surface">
                  {room.topicTitle}
                </h3>
                <div className="mt-2 text-sm text-on-surface-variant">
                  Structured 1v1 - ~{Math.round((room.config.prepTimeSeconds + room.config.openingTimeSeconds * 2 + room.config.rebuttalTimeSeconds * 2) / 60)} min total
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-outline-variant/12 bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-on-surface">Room status</div>
                  <div className="mt-2 text-2xl font-bold text-primary">
                    {readyCount}/2 ready
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {bothReady ? "Both debaters are ready to start." : "Both debaters must be ready to start."}
                  </p>
                </div>
                <div className="rounded-2xl border border-outline-variant/12 bg-surface px-4 py-3 text-center">
                  <div className="text-xs text-on-surface-variant">Share code</div>
                  <div className="mt-1 font-bold tracking-[0.12em] text-on-surface">
                    {room.shareCode}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <DuelRoundTimeline
                  prepTimeSeconds={room.config.prepTimeSeconds}
                  openingTimeSeconds={room.config.openingTimeSeconds}
                  rebuttalTimeSeconds={room.config.rebuttalTimeSeconds}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2 text-on-surface-variant">
                  <Coins className="h-4 w-4 text-primary" />
                  Entry cost
                </span>
                <span className="font-semibold text-on-surface">
                  {room.config.entryCost} Credits each
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2 text-on-surface-variant">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Charged
                </span>
                <span className="font-semibold text-on-surface">When duel starts</span>
              </div>
            </div>

            <div className="rounded-[22px] border border-outline-variant/12 bg-surface-container-low p-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-primary">
                <Bot className="h-4 w-4" />
                AI Judge preview
              </div>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                After the final rebuttal, AI Judge scores both debaters across key areas.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-5">
                {["Burden", "Clash", "Evidence", "Logic", "Delivery"].map((metric) => (
                  <MetricPill key={metric}>{metric}</MetricPill>
                ))}
              </div>
            </div>

            {startMode && (
              <div className="rounded-[22px] border border-success/20 bg-success/8 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Fair play
                </div>
                <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Timer starts once the duel begins.
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    AI Judge scores after final rebuttal.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export function DuelPreviewSidebar({
  topicTitle,
  topicCategory,
  prepTimeSeconds,
  openingTimeSeconds,
  rebuttalTimeSeconds,
  entryCost = DUEL_ENTRY_COST,
}: {
  topicTitle: string;
  topicCategory: string;
  prepTimeSeconds: number;
  openingTimeSeconds: number;
  rebuttalTimeSeconds: number;
  entryCost?: number;
}) {
  const estimatedMinutes = Math.round(
    (prepTimeSeconds + openingTimeSeconds * 2 + rebuttalTimeSeconds * 2) / 60
  );

  return (
    <aside
      id="duel-preview"
      className="space-y-4 rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-on-surface">Duel preview</h2>
        <div className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="mr-1 inline h-3.5 w-3.5" />
          Live preview
        </div>
      </div>

      <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-4">
        <Image
          src="/images/debates/duel-preview.png"
          width={320}
          height={220}
          alt=""
          className="mx-auto h-32 w-full object-contain"
        />
        <div className="mt-3 rounded-[20px] border border-outline-variant/12 bg-surface p-4">
          <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
            {topicCategory.split(" & ")[0]}
          </div>
          <h3 className="mt-3 text-lg font-bold leading-snug text-on-surface">
            {topicTitle}
          </h3>
          <div className="mt-2 text-sm text-on-surface-variant">
            Structured 1v1 - ~{estimatedMinutes} min total
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-outline-variant/12 bg-surface-container-low p-4">
        <div className="text-sm font-semibold text-on-surface">Round timeline</div>
        <div className="mt-4">
          <DuelRoundTimeline
            prepTimeSeconds={prepTimeSeconds}
            openingTimeSeconds={openingTimeSeconds}
            rebuttalTimeSeconds={rebuttalTimeSeconds}
          />
        </div>
      </div>

      <div className="rounded-[22px] border border-outline-variant/12 bg-surface-container-low p-4">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-on-surface-variant">
              <Coins className="h-4 w-4 text-primary" />
              Entry cost
            </span>
            <span className="font-semibold text-on-surface">{entryCost} Credits</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-on-surface-variant">
              <Sparkles className="h-4 w-4 text-primary" />
              Skill matching
            </span>
            <span className="font-semibold text-success">Balanced</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-on-surface-variant">
              <Copy className="h-4 w-4 text-primary" />
              Share code
            </span>
            <span className="font-semibold text-on-surface-variant">Locked</span>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-success/20 bg-success/8 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
          <div>
            <div className="text-sm font-semibold text-on-surface">
              Readiness checklist
            </div>
            <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Format and timers set
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Side assignment selected
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Entry cost confirmed
              </div>
            </div>
          </div>
          <Image
            src="/images/debates/trophy.png"
            width={96}
            height={96}
            alt=""
            className="h-24 w-24 object-contain"
          />
        </div>
      </div>
    </aside>
  );
}

export { formatDifficulty, formatMinutes };
