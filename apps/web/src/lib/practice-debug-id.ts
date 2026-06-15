export const PRACTICE_DEBUG_ID_STORAGE_KEY = "practiceSpeechDebugId";

function createDebugId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPracticeDebugId(prefix = "practice") {
  return createDebugId(prefix);
}

export function getPracticeDebugId(prefix = "practice") {
  if (typeof window === "undefined") {
    return createPracticeDebugId(prefix);
  }

  const stored = window.sessionStorage.getItem(PRACTICE_DEBUG_ID_STORAGE_KEY);
  if (stored) return stored;

  const debugId = createPracticeDebugId(prefix);
  window.sessionStorage.setItem(PRACTICE_DEBUG_ID_STORAGE_KEY, debugId);
  return debugId;
}

export function setPracticeDebugId(debugId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PRACTICE_DEBUG_ID_STORAGE_KEY, debugId);
}

export function clearPracticeDebugId() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PRACTICE_DEBUG_ID_STORAGE_KEY);
}
