import http from "node:http";
import { MAX_BODY_BYTES, parsePubSubEnvelope } from "./contracts.mjs";
import {
  NonRetryableNotificationError,
  processNotificationMessage,
  reconcileNotificationMessages,
} from "./processor.mjs";

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleRequest(request, response, dependencies) {
  if (request.method === "GET" && request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/") {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const envelope = parsePubSubEnvelope(await readJsonBody(request));
    const outcome = envelope.message.mode === "reconcile"
      ? await reconcileNotificationMessages(envelope.message, dependencies)
      : await processNotificationMessage(envelope.message, dependencies);
    console.info("Notification delivery completed", {
      messageId: envelope.messageId,
      deliveryAttempt: envelope.deliveryAttempt,
      jobId: envelope.message.jobId,
      outcome,
    });
    response.writeHead(204);
    response.end();
  } catch (error) {
    const nonRetryable = error instanceof NonRetryableNotificationError;
    console.error("Notification delivery failed", {
      retryable: !nonRetryable,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // A 2xx acknowledges malformed/obsolete jobs. A 500 asks Pub/Sub to retry
    // transient Supabase/provider/lease-completion failures and eventually DLQ.
    response.writeHead(nonRetryable ? 204 : 500, { "content-type": "application/json" });
    response.end(nonRetryable ? undefined : JSON.stringify({ ok: false }));
  }
}

const port = Number(process.env.PORT ?? 8080);
const server = http.createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, "0.0.0.0", () => {
  console.info(`Notification delivery worker listening on ${port}`);
});

function shutdown(signal) {
  console.info(`Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
