import assert from "node:assert/strict";
import {
  ChatProductContextError,
  isDebateCompatibleMobileCoachContext,
  resolveServerActiveChatProduct,
} from "./chat-product-context";

assert.equal(
  resolveServerActiveChatProduct({ activeProduct: "debate" }),
  "debate",
);
assert.equal(
  resolveServerActiveChatProduct({
    activeProduct: "ielts",
    requestedProduct: "ielts",
  }),
  "ielts",
);
assert.throws(
  () =>
    resolveServerActiveChatProduct({
      activeProduct: "debate",
      requestedProduct: "ielts",
    }),
  (error) =>
    error instanceof ChatProductContextError &&
    error.code === "CHAT_PRODUCT_CONTEXT_MISMATCH" &&
    error.status === 409,
);
assert.equal(isDebateCompatibleMobileCoachContext("practice-feedback"), true);
assert.equal(isDebateCompatibleMobileCoachContext(" IELTS-home "), false);
assert.throws(
  () =>
    resolveServerActiveChatProduct({
      activeProduct: "debate",
      requestedProduct: "other",
    }),
  (error) =>
    error instanceof ChatProductContextError &&
    error.code === "CHAT_PRODUCT_CONTEXT_INVALID" &&
    error.status === 400,
);
