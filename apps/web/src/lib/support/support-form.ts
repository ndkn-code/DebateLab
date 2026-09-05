export const SUPPORT_FORM_TIMEOUT_MS = 8_000;

export type SupportFormState = "loading" | "ready" | "error";
export type SupportFormEvent = "load" | "error" | "timeout" | "retry";

export function reduceSupportFormState(
  state: SupportFormState,
  event: SupportFormEvent,
): SupportFormState {
  if (event === "load") return state === "error" ? "error" : "ready";
  if (event === "error" || event === "timeout") return "error";
  return "loading";
}
