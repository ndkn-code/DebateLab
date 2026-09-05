export type MatchmakingRequestKind = "entry" | "poll" | "ai" | "cancel";

export type MatchmakingRequest = {
  kind: MatchmakingRequestKind;
  ticketId: string | null;
  version: number;
};

/** Guards async queue work when a ticket is cancelled, replaced, or unmounted. */
export function createMatchmakingRequestGuard() {
  let version = 0;
  let activeTicketId: string | null = null;

  const invalidate = () => {
    version += 1;
    activeTicketId = null;
  };

  const activateTicket = (ticketId: string) => {
    version += 1;
    activeTicketId = ticketId;
    return version;
  };

  const begin = (kind: MatchmakingRequestKind): MatchmakingRequest => ({
    kind,
    ticketId: activeTicketId,
    version,
  });

  const isCurrent = (request: MatchmakingRequest) =>
    request.version === version && request.ticketId === activeTicketId;

  return { activateTicket, begin, invalidate, isCurrent };
}
