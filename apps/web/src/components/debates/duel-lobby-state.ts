export interface DuelClipboard {
  writeText(value: string): Promise<void>;
}

export type DuelLobbyAction =
  | "join"
  | "ready"
  | "unready"
  | "start"
  | "waitingOpponent"
  | "waitingCreator";

export function getDuelLobbyAction(input: {
  canJoin: boolean;
  canReady: boolean;
  canStart: boolean;
  isParticipant: boolean;
  isCreator: boolean;
  ready: boolean;
  bothReady: boolean;
}): DuelLobbyAction {
  if (input.canJoin) return "join";
  if (input.canStart) return "start";
  if (input.canReady && input.isParticipant && !input.ready) return "ready";
  if (
    input.canReady &&
    input.isParticipant &&
    input.ready &&
    !input.bothReady
  ) {
    return "unready";
  }
  return input.isCreator ? "waitingOpponent" : "waitingCreator";
}

/**
 * Lumist's ChallengeLobby treats clipboard access as an optional enhancement:
 * the invite remains visible when permission is denied or the API is missing.
 * Keep that recovery contract separate from the lobby rendering so it can be
 * verified without a browser permission prompt.
 */
export async function copyDuelInvite(
  inviteUrl: string,
  clipboard?: DuelClipboard,
): Promise<boolean> {
  if (!clipboard) return false;

  try {
    await clipboard.writeText(inviteUrl);
    return true;
  } catch {
    return false;
  }
}
