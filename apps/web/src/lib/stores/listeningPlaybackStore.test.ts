import assert from "node:assert/strict";
import {
  listeningPlaybackKey,
  useListeningPlaybackStore,
} from "./listeningPlaybackStore";

class MemoryLocalStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  clear(): void {
    this.values.clear();
  }
}

const localStorage = new MemoryLocalStorage();

Object.defineProperty(globalThis, "window", {
  value: { localStorage },
  configurable: true,
});

function resetStore(): void {
  useListeningPlaybackStore.setState({
    hydratedAttempts: {},
    playedParts: {},
  });
  localStorage.clear();
}

resetStore();
const attemptId = "attempt-1";
const firstPartId = "listening-part-1";
const secondPartId = "listening-part-2";

useListeningPlaybackStore.getState().hydrateAttempt(attemptId);
assert.equal(useListeningPlaybackStore.getState().hydratedAttempts[attemptId], true);
useListeningPlaybackStore.getState().markPlayed(attemptId, firstPartId);
useListeningPlaybackStore.getState().markPlayed(attemptId, firstPartId);
useListeningPlaybackStore.getState().markPlayed(attemptId, secondPartId);

assert.equal(
  useListeningPlaybackStore.getState().playedParts[
    listeningPlaybackKey(attemptId, firstPartId)
  ],
  true,
);
assert.deepEqual(
  JSON.parse(localStorage.getItem(`ielts-listening-played-${attemptId}`) ?? "{}"),
  { version: 1, partIds: [firstPartId, secondPartId] },
);

useListeningPlaybackStore.setState({
  hydratedAttempts: {},
  playedParts: {},
});
useListeningPlaybackStore.getState().hydrateAttempt(attemptId);
assert.deepEqual(useListeningPlaybackStore.getState().playedParts, {
  [listeningPlaybackKey(attemptId, firstPartId)]: true,
  [listeningPlaybackKey(attemptId, secondPartId)]: true,
});

const corruptAttemptId = "attempt-corrupt";
localStorage.setItem(`ielts-listening-played-${corruptAttemptId}`, "not-json");
useListeningPlaybackStore.getState().hydrateAttempt(corruptAttemptId);
assert.equal(useListeningPlaybackStore.getState().hydratedAttempts[corruptAttemptId], true);

console.log("listeningPlaybackStore tests passed");
