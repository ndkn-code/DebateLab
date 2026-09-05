"use client";
// Local-only harness: copy into [locale]/duel-entry-qa/page.tsx for Ego QA,
// then remove that route. It is never included in the application build.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { KeyedMutator } from "swr";
import { DuelLobbySetupView } from "@/components/debates/duel-setup-flow";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";
import type {
  DebateDuelRoomView,
  DebateDuelRoomResponse,
  DebateTopic,
} from "@/types";
const now = "2026-09-05T17:00:00Z";
const base: DebateDuelRoomView = {
  view: "room",
  id: "00000000-0000-4000-8000-000000000004",
  shareCode: "QA1234",
  topicKey: "qa-original",
  topicTitle: "QA — Schools should offer a weekly student-led discussion.",
  topicCategory: "Education",
  topicCategoryKey: "education",
  topicDifficulty: "beginner",
  topicDescription: "Original QA motion; no classroom invitation is sent.",
  practiceLanguage: "en",
  duelKind: "custom",
  rated: false,
  aiOpponent: false,
  integrityStatus: "clean",
  status: "lobby",
  currentPhase: "lobby",
  sideAssignmentMode: "random",
  creatorSidePreference: null,
  config: {
    prepTimeSeconds: 120,
    openingTimeSeconds: 180,
    rebuttalTimeSeconds: 120,
    entryCost: 200,
  },
  phaseStartedAt: null,
  startedAt: null,
  completedAt: null,
  expiresAt: "2099-09-05T18:00:00Z",
  createdAt: now,
  creatorId: "qa-creator",
  participants: [
    {
      id: "qa-p1",
      userId: "qa-creator",
      displayName: "QA Linh Nguyễn",
      avatarUrl: null,
      role: null,
      joinedAt: now,
      readyAt: null,
      creditsChargedAt: null,
      completedAt: null,
    },
  ],
  speeches: [],
  judgment: null,
  viewer: {
    id: "qa-creator",
    isCreator: true,
    isParticipant: true,
    participantId: "qa-p1",
    role: null,
  },
  canJoin: false,
  canReady: true,
  canStart: false,
};
export default function DuelEntryQa() {
  const params = useSearchParams();
  const [room, setRoom] = useState<DebateDuelRoomView>(() => {
    const value = structuredClone(base);
    const role = params.get("role");
    if (role === "guest" || role === "observer") {
      value.viewer = {
        id: "qa-guest",
        isCreator: false,
        isParticipant: false,
        participantId: null,
        role: null,
      };
      value.canJoin = role === "guest";
      value.canReady = false;
    }
    if (role === "ready" || role === "participant") {
      value.participants[0].readyAt = now;
      value.participants.push({
        id: "qa-p2",
        userId: "qa-opponent",
        displayName: "QA Minh Trần",
        avatarUrl: null,
        role: null,
        joinedAt: now,
        readyAt: role === "ready" ? now : null,
        creditsChargedAt: null,
        completedAt: null,
      });
      if (role === "ready") value.canStart = true;
      else
        value.viewer = {
          id: "qa-opponent",
          isCreator: false,
          isParticipant: true,
          participantId: "qa-p2",
          role: null,
        };
    }
    return value;
  });
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    const qa = {
      requests: [] as {
        path: string;
        method: string;
        body: Record<string, unknown>;
      }[],
      ticket: null as Record<string, unknown> | null,
      holdAi: false,
      holdPoll: false,
      failCancel: false,
      releaseAi: undefined as undefined | (() => void),
      releasePoll: undefined as undefined | (() => void),
    };
    Object.assign(window, { __duelQa: qa });
    window.fetch = async (input, init) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      if (!path.includes("/api/debate-duels/")) return nativeFetch(input, init);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      qa.requests.push({ path, method, body });
      if (path.includes("matchmaking/ticket")) {
        if (method === "POST")
          qa.ticket = {
            id: "00000000-0000-4000-8000-000000000003",
            status: "queued",
            topicCategory: "Education",
            topicCategoryKey: "education",
            topicDifficulty: "beginner",
            practiceLanguage: "vi",
            config: base.config,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            shareCode: null,
            matchedDuelId: null,
            matchedTicketId: null,
            matchedAt: null,
            cancelledAt: null,
          };
        if (method === "DELETE") {
          if (qa.failCancel)
            return Response.json(
              { error: "QA cancellation failure" },
              { status: 503 },
            );
          if (qa.ticket?.status !== "matched") qa.ticket = null;
        }
        const ticket = structuredClone(qa.ticket);
        if (method === "GET" && qa.holdPoll)
          await new Promise<void>((resolve) => {
            qa.releasePoll = resolve;
          });
        return Response.json({ ticket });
      }
      if (path.includes("ai-backfill")) {
        if (qa.holdAi)
          await new Promise<void>((resolve) => {
            qa.releaseAi = resolve;
          });
        return Response.json({
          ...base,
          shareCode: "QAAI01",
          aiOpponent: true,
          status: "in_progress",
        });
      }
      if (path.endsWith("/ready")) {
        const next = structuredClone(base);
        next.participants[0].readyAt = body.ready
          ? new Date().toISOString()
          : null;
        return Response.json(next);
      }
      return Response.json(
        { error: "Unhandled local QA action" },
        { status: 400 },
      );
    };
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);
  const mutate = (async (data: DebateDuelRoomResponse) => {
    if (data && data.view === "room") setRoom(data);
    return data;
  }) as KeyedMutator<DebateDuelRoomResponse>;
  const topic = {
    id: "qa-original",
    title: base.topicTitle,
    category: "Education",
    categoryKey: "education",
    difficulty: "beginner",
    context: base.topicDescription,
    topicKey: "qa-original",
    practiceLanguage: "en",
    isActive: true,
  } as DebateTopic;
  return (
    <>
      <p data-qa-worktree="4bed" className="type-caption p-2">
        LOCAL QA FIXTURE · worktree 4bed · no real invitations
      </p>
      {params.get("view") === "queue" ? (
        <DuelMatchmakingPage initialTopics={[topic]} />
      ) : (
        <DuelLobbySetupView room={room} mutate={mutate} />
      )}
    </>
  );
}
