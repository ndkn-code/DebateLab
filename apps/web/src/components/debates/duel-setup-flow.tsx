"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { KeyedMutator } from "swr";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  Loader2,
  Lock,
  Users,
} from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";
import { getCategoryLabel, getTopicCategoryKey } from "@/lib/topics";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { DUEL_ENTRY_COST } from "@/lib/debate-duels/shared";
import { copyDuelInvite, getDuelLobbyAction } from "./duel-lobby-state";
import type {
  DebateDuelParticipant,
  DebateDuelRoomResponse,
  DebateDuelRoomView,
  DebateDuelTopicDifficulty,
} from "@/types";

export function formatMinutes(seconds: number) {
  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}
export function formatDifficulty(
  difficulty: DebateDuelTopicDifficulty,
  labels: { easy?: string; medium?: string; hard?: string } = {},
) {
  return difficulty === "beginner"
    ? (labels.easy ?? "Easy")
    : difficulty === "intermediate"
      ? (labels.medium ?? "Medium")
      : (labels.hard ?? "Hard");
}

export function DuelFlowStepper({
  mode,
}: {
  mode: "configure" | "invite" | "start";
}) {
  const t = useTranslations("duelSetup");
  const active = mode === "configure" ? 0 : mode === "invite" ? 1 : 2;
  return (
    <ol aria-label={t("flowLabel")} className="grid grid-cols-3 gap-3">
      {(["configure", "invite", "start"] as const).map((step, index) => (
        <li
          key={step}
          aria-current={index === active ? "step" : undefined}
          className="flex min-w-0 items-center gap-2 type-caption text-on-surface-variant"
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              index === active
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface",
            )}
          >
            {index < active ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              index + 1
            )}
          </span>
          <span className={index === active ? "text-on-surface" : undefined}>
            {t(`steps.${step}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DuelRoundTimeline({
  prepTimeSeconds,
  openingTimeSeconds,
  rebuttalTimeSeconds,
  activeIndex,
}: {
  prepTimeSeconds: number;
  openingTimeSeconds: number;
  rebuttalTimeSeconds: number;
  activeIndex?: number;
}) {
  const t = useTranslations("duelSetup");
  const rounds = [
    ["sharedPrep", prepTimeSeconds],
    ["propOpening", openingTimeSeconds],
    ["oppOpening", openingTimeSeconds],
    ["rebuttalPrep", Math.max(30, Math.min(prepTimeSeconds, 60))],
    ["propRebuttal", rebuttalTimeSeconds],
    ["oppRebuttal", rebuttalTimeSeconds],
  ] as const;
  return (
    <ol className="divide-y divide-outline-variant">
      {rounds.map(([label, seconds], index) => (
        <li
          key={label}
          aria-current={activeIndex === index ? "step" : undefined}
          className="flex items-center justify-between gap-3 py-3 type-body"
        >
          <span className="flex min-w-0 items-center gap-3 text-on-surface">
            <span className="type-caption text-on-surface-variant">
              {index + 1}
            </span>
            {t(`timeline.${label}`)}
          </span>
          <span className="shrink-0 type-caption text-on-surface-variant">
            {t("minutes", { count: seconds / 60 })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SeatCard({
  participant,
  viewerId,
  creatorId,
  index,
  aiOpponent,
}: {
  participant?: DebateDuelParticipant;
  viewerId: string;
  creatorId: string;
  index: number;
  aiOpponent?: boolean;
}) {
  const t = useTranslations("duelSetup");
  const isViewer = participant?.userId === viewerId;
  const isAi = !!aiOpponent && participant?.userId !== creatorId;
  return (
    <div className="min-w-0 rounded-control border border-outline-variant bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="type-caption text-on-surface-variant">
          {t("debaterNumber", { number: index + 1 })}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-1 type-caption",
            participant?.readyAt
              ? "bg-success-container text-on-success-container"
              : "bg-surface-container-high text-on-surface-variant",
          )}
        >
          {participant
            ? t(participant.readyAt ? "seat.ready" : "notReady")
            : t("seat.openSeat")}
        </span>
      </div>
      <p className="break-words type-title text-on-surface">
        {participant ? participant.displayName : t("seat.waitingOpponent")}
        {isViewer ? ` (${t("you")})` : ""}
      </p>
      {participant ? (
        <p className="mt-2 type-body text-on-surface-variant">
          {t(isAi ? "aiOpponent" : "humanOpponent")}
          {participant.userId === creatorId ? ` · ${t("creator")}` : ""}
        </p>
      ) : (
        <p className="mt-2 type-body text-on-surface-variant">
          {t("seat.shareCode")}
        </p>
      )}
      <p className="mt-2 type-caption text-on-surface-variant">
        {participant?.role
          ? t(`side.${participant.role}`)
          : t("seat.sidePending")}
      </p>
    </div>
  );
}

// Momentum surface. Invitation behavior is partially forked from Lumist's
// ChallengeLobby: a persistent credential plus guarded clipboard feedback.
export function DuelLobbySetupView({
  room,
  mutate,
  onEditSetup,
}: {
  room: DebateDuelRoomView;
  mutate: KeyedMutator<DebateDuelRoomResponse>;
  onEditSetup?: () => void;
}) {
  const t = useTranslations("duelSetup");
  const locale = useLocale();
  const router = useRouter();
  const invitePath = `/${locale}/debates/${room.shareCode}`;
  const [inviteUrl, setInviteUrl] = useState(invitePath);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionVersion = useRef(0);
  const busy = useRef(false);
  const copyVersion = useRef(0);
  useEffect(() => {
    setInviteUrl(`${window.location.origin}${invitePath}`);
    return () => {
      actionVersion.current += 1;
      copyVersion.current += 1;
    };
  }, [invitePath]);
  const readyCount = room.participants.filter(
    (participant) => participant.readyAt,
  ).length;
  const bothReady = room.participants.length === 2 && readyCount === 2;
  const viewerReady = !!room.participants.find(
    (participant) => participant.userId === room.viewer.id,
  )?.readyAt;
  const action = getDuelLobbyAction({
    canJoin: room.canJoin,
    canReady: room.canReady,
    canStart: room.canStart,
    isParticipant: room.viewer.isParticipant,
    isCreator: room.viewer.isCreator,
    ready: viewerReady,
    bothReady,
  });
  const actionAvailable = ["join", "start", "ready", "unready"].includes(
    action,
  );
  const category = getCategoryLabel(
    getTopicCategoryKey({
      id: room.id, title: room.topicTitle, difficulty: room.topicDifficulty,
      category: room.topicCategory,
      categoryKey: room.topicCategoryKey ?? undefined,
    }),
    coercePracticeLanguage(locale),
  );
  const copyInvite = async () => {
    const version = ++copyVersion.current;
    setCopyStatus("idle");
    const copied = await copyDuelInvite(inviteUrl, navigator.clipboard);
    if (copyVersion.current === version)
      setCopyStatus(copied ? "copied" : "failed");
  };
  const primaryAction = async () => {
    if (!actionAvailable || busy.current) return;
    busy.current = true;
    setPending(true);
    setActionError(null);
    const version = ++actionVersion.current;
    const endpoint = action === "unready" ? "ready" : action;
    try {
      const response = await fetch(
        `/api/debate-duels/${room.shareCode}/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...(action === "ready" || action === "unready"
            ? { body: JSON.stringify({ ready: action === "ready" }) }
            : {}),
        },
      );
      const payload = (await response.json()) as DebateDuelRoomResponse;
      if (version !== actionVersion.current) return;
      if (!response.ok || payload.view !== "room")
        throw new Error("room action failed");
      await mutate(payload, { revalidate: false });
      if (version === actionVersion.current && payload.status !== "lobby")
        router.push(`/debates/${payload.shareCode}`);
    } catch {
      if (version === actionVersion.current)
        setActionError(t("roomError", { code: "DUEL-LOBBY-01" }));
    } finally {
      if (version === actionVersion.current) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const leave = () => {
    actionVersion.current += 1;
    router.push("/debates");
  };
  return (
    <div className="min-h-full bg-background">
      <PageContainer size="wide" className="py-6">
        <Button variant="ghost" onClick={leave} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          {t("arena")}
        </Button>
        <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <header>
            <h1 className="type-heading-xl text-on-surface">
              {t(
                bothReady
                  ? "heading.ready"
                  : room.duelKind === "matchmaking"
                    ? "heading.matched"
                    : "heading.created",
              )}
            </h1>
            <p className="mt-2 type-body text-on-surface-variant">
              {t(
                bothReady
                  ? "readyDescription"
                  : room.duelKind === "matchmaking"
                    ? "matchedDescription"
                    : "createdDescription",
              )}
            </p>
          </header>
          <DuelFlowStepper mode={bothReady ? "start" : "invite"} />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 space-y-6">
            <section className="rounded-control border border-outline-variant bg-surface p-5">
              <p className="type-caption text-on-surface-variant">
                {category} · {t(`difficulty.${room.topicDifficulty}`)} ·{" "}
                {t(room.practiceLanguage === "vi" ? "vietnamese" : "english")}
              </p>
              <h2 className="mt-3 break-words type-heading-md text-on-surface">
                {room.topicTitle}
              </h2>
              {room.topicDescription && (
                <p className="mt-3 break-words type-body text-on-surface-variant">
                  {room.topicDescription}
                </p>
              )}
            </section>
            <section aria-label={t("participants")}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="type-title text-on-surface">
                  {t("participants")}
                </h2>
                <span
                  className="type-body text-on-surface-variant"
                  role="status"
                >
                  {t("readyCount", { count: readyCount })}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((index) => (
                  <SeatCard
                    key={index}
                    participant={room.participants[index]}
                    viewerId={room.viewer.id}
                    creatorId={room.creatorId}
                    index={index}
                    aiOpponent={room.aiOpponent}
                  />
                ))}
              </div>
            </section>
            {room.duelKind !== "matchmaking" && (
              <section
                className="rounded-control border border-outline-variant bg-surface p-5"
                aria-labelledby="duel-invite-title"
              >
                <h2
                  id="duel-invite-title"
                  className="type-title text-on-surface"
                >
                  {t("inviteTitle")}
                </h2>
                <p className="mt-2 type-body text-on-surface-variant">
                  {t("share.helper")}
                </p>
                <div className="mt-4 grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <div className="min-w-0 space-y-3">
                    <label
                      className="block type-caption text-on-surface-variant"
                      htmlFor="duel-room-url"
                    >
                      {t("share.urlLabel")}
                    </label>
                    <Input
                      id="duel-room-url"
                      readOnly
                      value={inviteUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="min-w-0 type-body"
                    />
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label
                          className="mb-1 block type-caption text-on-surface-variant"
                          htmlFor="duel-room-code"
                        >
                          {t("share.codeLabel")}
                        </label>
                        <Input
                          id="duel-room-code"
                          readOnly
                          value={room.shareCode}
                          onFocus={(event) => event.currentTarget.select()}
                          className="type-title"
                        />
                      </div>
                      <Button variant="outline" onClick={copyInvite}>
                        <Copy className="h-4 w-4" />
                        {t("share.copy")}
                      </Button>
                    </div>
                    <p
                      role="status"
                      className={cn(
                        "type-caption",
                        copyStatus === "failed"
                          ? "text-error"
                          : "text-on-surface-variant",
                      )}
                    >
                      {t(
                        copyStatus === "copied"
                          ? "share.copied"
                          : copyStatus === "failed"
                            ? "share.copyFailed"
                            : "share.manualFallback",
                      )}
                    </p>
                  </div>
                  <div className="justify-self-start rounded-control border border-outline-variant bg-surface-container-low p-3 text-center">
                    <QRCodeSVG
                      value={inviteUrl}
                      size={112}
                      level="M"
                      title={t("scanToJoin")}
                    />
                    <p className="mt-2 type-caption text-on-surface-variant">
                      {t("scanToJoin")}
                    </p>
                  </div>
                </div>
              </section>
            )}
            <section className="space-y-3">
              {actionError && (
                <p
                  role="alert"
                  className="rounded-control bg-error-container p-3 type-body text-on-error-container"
                >
                  {actionError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {onEditSetup && room.viewer.isCreator && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={onEditSetup}
                  >
                    {t("editSetup")}
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={pending || !actionAvailable}
                  onClick={primaryAction}
                  className="h-auto min-h-10 whitespace-normal py-2"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  {pending ? t("working") : t(`actions.${action}`)}
                </Button>
              </div>
              <p className="flex items-start gap-2 type-caption text-on-surface-variant">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                {t("chargeNotice", { cost: room.config.entryCost })}
              </p>
            </section>
          </main>
          <DuelPreviewSidebar
            topicTitle={room.topicTitle}
            topicCategory={category}
            prepTimeSeconds={room.config.prepTimeSeconds}
            openingTimeSeconds={room.config.openingTimeSeconds}
            rebuttalTimeSeconds={room.config.rebuttalTimeSeconds}
            entryCost={room.config.entryCost}
          />
        </div>
      </PageContainer>
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
  const t = useTranslations("duelSetup");
  return (
    <aside
      id="duel-preview"
      className="min-w-0 rounded-control border border-outline-variant bg-surface p-5"
    >
      <h2 className="type-title text-on-surface">{t("previewTitle")}</h2>
      <p className="mt-3 type-caption text-on-surface-variant">
        {topicCategory}
      </p>
      <p className="mt-1 break-words type-body text-on-surface">{topicTitle}</p>
      <h3 className="mt-5 flex items-center gap-2 type-body text-on-surface">
        <Clock3 className="h-4 w-4" />
        {t("timelineTitle")}
      </h3>
      <DuelRoundTimeline
        prepTimeSeconds={prepTimeSeconds}
        openingTimeSeconds={openingTimeSeconds}
        rebuttalTimeSeconds={rebuttalTimeSeconds}
      />
      <div className="mt-3 border-t border-outline-variant pt-4">
        <p className="type-body text-on-surface">
          {t("entryCost", { cost: entryCost })}
        </p>
        <p className="mt-2 type-caption text-on-surface-variant">
          {t("judgeDescription")}
        </p>
      </div>
    </aside>
  );
}
