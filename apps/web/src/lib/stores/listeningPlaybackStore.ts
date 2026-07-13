"use client";

import { create } from "zustand";

interface ListeningPlaybackState {
  hydratedAttempts: Record<string, true>;
  playedParts: Record<string, true>;
  hydrateAttempt: (attemptId: string) => void;
  markPlayed: (attemptId: string, partId: string) => void;
}

const STORAGE_VERSION = 1;

export function listeningPlaybackKey(attemptId: string, partId: string): string {
  return `${attemptId}:${partId}`;
}

function storageKey(attemptId: string): string {
  return `ielts-listening-played-${attemptId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && window.localStorage != null;
}

function readPlayedParts(attemptId: string): Record<string, true> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(attemptId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const candidate = parsed as Record<string, unknown>;
    if (!Array.isArray(candidate.partIds)) return {};
    return Object.fromEntries(
      candidate.partIds
        .filter((partId): partId is string => typeof partId === "string" && partId.length > 0)
        .map((partId) => [listeningPlaybackKey(attemptId, partId), true] as const),
    );
  } catch {
    return {};
  }
}

function persistPlayedParts(attemptId: string, playedParts: Record<string, true>): void {
  if (!canUseStorage()) return;
  try {
    const prefix = `${attemptId}:`;
    const partIds = Object.keys(playedParts)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .filter((partId) => partId.length > 0);
    window.localStorage.setItem(
      storageKey(attemptId),
      JSON.stringify({ version: STORAGE_VERSION, partIds }),
    );
  } catch {
    // Playback still stays one-way for this mounted page if storage is blocked.
  }
}

export const useListeningPlaybackStore = create<ListeningPlaybackState>((set, get) => ({
  hydratedAttempts: {},
  playedParts: {},

  hydrateAttempt: (attemptId) =>
    set((state) => {
      if (state.hydratedAttempts[attemptId]) return state;
      return {
        hydratedAttempts: { ...state.hydratedAttempts, [attemptId]: true },
        playedParts: { ...state.playedParts, ...readPlayedParts(attemptId) },
      };
    }),

  markPlayed: (attemptId, partId) => {
    const key = listeningPlaybackKey(attemptId, partId);
    if (get().playedParts[key]) return;
    set((state) => ({
      playedParts: { ...state.playedParts, [key]: true },
    }));
    persistPlayedParts(attemptId, get().playedParts);
  },
}));
