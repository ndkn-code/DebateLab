import { strict as assert } from "node:assert";
import test from "node:test";
import { copyDuelInvite, getDuelLobbyAction } from "./duel-lobby-state";

const baseAction = {
  canJoin: false,
  canReady: false,
  canStart: false,
  isParticipant: false,
  isCreator: false,
  ready: false,
  bothReady: false,
};

test("role-specific lobby actions respect capabilities", () => {
  assert.equal(getDuelLobbyAction({ ...baseAction, canJoin: true }), "join");
  assert.equal(
    getDuelLobbyAction({ ...baseAction, canReady: true, isParticipant: true }),
    "ready",
  );
  assert.equal(
    getDuelLobbyAction({
      ...baseAction,
      canReady: true,
      isParticipant: true,
      ready: true,
    }),
    "unready",
  );
  assert.equal(
    getDuelLobbyAction({ ...baseAction, canStart: true, isCreator: true }),
    "start",
  );
  assert.equal(
    getDuelLobbyAction({ ...baseAction, isCreator: true }),
    "waitingOpponent",
  );
  assert.equal(getDuelLobbyAction(baseAction), "waitingCreator");
});

test("clipboard denial returns a recoverable failure", async () => {
  const copied = await copyDuelInvite("https://thinkfy.test/en/debates/ABCD", {
    writeText: async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    },
  });

  assert.equal(copied, false);
});

test("missing clipboard keeps the manual link fallback available", async () => {
  assert.equal(
    await copyDuelInvite("https://thinkfy.test/en/debates/ABCD"),
    false,
  );
});
