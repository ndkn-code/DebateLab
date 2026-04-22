import type {
  DebateDuelPhase,
  DebateDuelRoomView,
  DebateDuelSide,
  DebateDuelSpeechType,
} from "@/types";

export const DUEL_ENTRY_COST = 200;
export const DUEL_XP_REWARD = 40;
export const DUEL_POLL_INTERVAL_MS = 3000;

export interface DuelPhaseDescriptor {
  phase: DebateDuelPhase;
  label: string;
  durationSeconds: (room: DebateDuelRoomView) => number;
  activeSide: DebateDuelSide | null;
  speechType: DebateDuelSpeechType | null;
  roundNumber: number | null;
}

export const DUEL_PHASES: DuelPhaseDescriptor[] = [
  {
    phase: "prep",
    label: "Shared Prep",
    durationSeconds: (room) => room.config.prepTimeSeconds,
    activeSide: null,
    speechType: null,
    roundNumber: null,
  },
  {
    phase: "proposition-opening",
    label: "Proposition Opening",
    durationSeconds: (room) => room.config.openingTimeSeconds,
    activeSide: "proposition",
    speechType: "opening",
    roundNumber: 1,
  },
  {
    phase: "opposition-opening",
    label: "Opposition Opening",
    durationSeconds: (room) => room.config.openingTimeSeconds,
    activeSide: "opposition",
    speechType: "opening",
    roundNumber: 2,
  },
  {
    phase: "rebuttal-prep",
    label: "Rebuttal Prep",
    durationSeconds: (room) =>
      Math.max(30, Math.min(room.config.prepTimeSeconds, 60)),
    activeSide: null,
    speechType: null,
    roundNumber: null,
  },
  {
    phase: "proposition-rebuttal",
    label: "Proposition Rebuttal",
    durationSeconds: (room) => room.config.rebuttalTimeSeconds,
    activeSide: "proposition",
    speechType: "rebuttal",
    roundNumber: 3,
  },
  {
    phase: "opposition-rebuttal",
    label: "Opposition Rebuttal",
    durationSeconds: (room) => room.config.rebuttalTimeSeconds,
    activeSide: "opposition",
    speechType: "rebuttal",
    roundNumber: 4,
  },
];

export function getPhaseDescriptor(phase: DebateDuelPhase) {
  return DUEL_PHASES.find((item) => item.phase === phase) ?? null;
}

export function getNextDuelPhase(phase: DebateDuelPhase): DebateDuelPhase {
  if (phase === "lobby") return "prep";
  if (phase === "prep") return "proposition-opening";
  if (phase === "proposition-opening") return "opposition-opening";
  if (phase === "opposition-opening") return "rebuttal-prep";
  if (phase === "rebuttal-prep") return "proposition-rebuttal";
  if (phase === "proposition-rebuttal") return "opposition-rebuttal";
  if (phase === "opposition-rebuttal") return "judging";
  if (phase === "judging") return "completed";
  return "completed";
}

export function getCurrentPhaseDuration(room: DebateDuelRoomView) {
  const descriptor = getPhaseDescriptor(room.currentPhase);
  return descriptor ? descriptor.durationSeconds(room) : 0;
}

export function getPhaseRemainingSeconds(room: DebateDuelRoomView, now = Date.now()) {
  if (!room.phaseStartedAt) return getCurrentPhaseDuration(room);
  const duration = getCurrentPhaseDuration(room);
  const elapsed = Math.floor((now - new Date(room.phaseStartedAt).getTime()) / 1000);
  return Math.max(0, duration - elapsed);
}
