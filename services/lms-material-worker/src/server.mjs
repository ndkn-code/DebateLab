import http from "node:http";
import { parsePubSubEnvelope } from "./contracts.mjs";
import { processMaterialVersion } from "./processor.mjs";

const MAX_BODY_BYTES = 64 * 1024;

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

export async function handleRequest(request, response) {
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
    const outcome = await processMaterialVersion(envelope.message.versionId);
    if (outcome === "lease_active") {
      throw new Error("LMS_MATERIAL_LEASE_ACTIVE");
    }
    console.info("Material processing delivery completed", {
      messageId: envelope.messageId,
      deliveryAttempt: envelope.deliveryAttempt,
      materialId: envelope.message.materialId,
      versionId: envelope.message.versionId,
      outcome,
    });
    response.writeHead(204);
    response.end();
  } catch (error) {
    console.error("Material processing delivery failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false }));
  }
}

const port = Number(process.env.PORT ?? 8080);
const server = http.createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, "0.0.0.0", () => {
  console.info(`LMS material worker listening on ${port}`);
});

function shutdown(signal) {
  console.info(`Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
