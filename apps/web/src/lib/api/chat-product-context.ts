import type { ChatProductContext } from "./chat";

export type ChatProductContextErrorCode =
  | "CHAT_PRODUCT_CONTEXT_INVALID"
  | "CHAT_PRODUCT_CONTEXT_MISMATCH";

export class ChatProductContextError extends Error {
  constructor(
    readonly code: ChatProductContextErrorCode,
    readonly status: 400 | 409,
  ) {
    super(code);
    this.name = "ChatProductContextError";
  }
}

/** Server-active product is authoritative for every conversation operation. */
export function resolveServerActiveChatProduct(params: {
  activeProduct: ChatProductContext;
  requestedProduct?: string | null;
}): ChatProductContext {
  if (
    params.requestedProduct !== undefined &&
    params.requestedProduct !== null &&
    params.requestedProduct !== "debate" &&
    params.requestedProduct !== "ielts"
  ) {
    throw new ChatProductContextError("CHAT_PRODUCT_CONTEXT_INVALID", 400);
  }
  if (
    params.requestedProduct !== undefined &&
    params.requestedProduct !== null &&
    params.requestedProduct !== params.activeProduct
  ) {
    throw new ChatProductContextError("CHAT_PRODUCT_CONTEXT_MISMATCH", 409);
  }
  return params.activeProduct;
}

export function isDebateCompatibleMobileCoachContext(
  context: string | null | undefined,
): boolean {
  return !context?.trim().toLowerCase().startsWith("ielts");
}
