import type { DebateSession } from "@/types";

const STORAGE_KEY = "debatelab_sessions";
const MAX_SESSIONS = 50;

export const storage = {
  saveSession(session: DebateSession): void {
    const sessions = this.getSessions();
    sessions.unshift(session);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS))
    );
  },

  getSessions(): DebateSession[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as DebateSession[]) : [];
  },

  getSession(id: string): DebateSession | null {
    return this.getSessions().find((s) => s.id === id) ?? null;
  },

  deleteSession(id: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },
};
