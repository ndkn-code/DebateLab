import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const mobile = readFileSync(
  resolve(root, "src/lib/api/mobile-coach.ts"),
  "utf8",
);
const chatRepository = readFileSync(
  resolve(root, "src/lib/api/chat.ts"),
  "utf8",
);
const detailRoute = readFileSync(
  resolve(root, "src/app/api/chat/conversations/[id]/route.ts"),
  "utf8",
);
const deleteAction = readFileSync(
  resolve(root, "src/app/[locale]/(protected)/chat/actions.ts"),
  "utf8",
);

assert.ok(
  (mobile.match(/\.eq\("product_context", "debate"\)/g) ?? []).length >= 4,
  "mobile list, detail, history owner lookup, and update must be Debate-scoped",
);
assert.match(
  mobile,
  /user_id: userId,[\s\S]{0,100}product_context: "debate"/,
  "mobile conversation creation must persist Debate product context",
);
assert.doesNotMatch(
  chatRepository,
  /from\("chat_messages"\)[\s\S]{0,120}\.delete\(\)/,
  "conversation deletion must not erase messages before product ownership is proven",
);
assert.ok(
  (chatRepository.match(/\.eq\("product_context", productContext\)/g) ?? [])
    .length >= 4,
  "server repository list/get/delete paths must filter their product",
);
assert.match(detailRoute, /resolveServerActiveChatProduct/);
assert.ok(
  (detailRoute.match(/\.eq\("product_context", productContext\)/g) ?? [])
    .length >= 3,
  "detail and delete must verify and mutate only the active product",
);
assert.match(
  chatRepository,
  /getConversations\([\s\S]*productContext: ChatProductContext = "debate"/,
  "the existing server-side conversation loader must require an explicit product scope",
);
assert.match(deleteAction, /getActiveSubject/);
assert.match(
  deleteAction,
  /deleteConversation\(conversationId, user\.id, productContext\)/,
  "server action must pass the server-active product to deletion",
);
