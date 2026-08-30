import http from "node:http";
import { routeWorkerRequest } from "./handler";

const MAX_BODY_BYTES = 64 * 1024;

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleHttpRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  try {
    const method = request.method ?? "GET";
    const path = new URL(request.url ?? "/", "http://worker.local").pathname;
    const body = method === "POST" ? await readJsonBody(request) : undefined;
    const result = await routeWorkerRequest({
      method,
      path,
      authorization: request.headers.authorization,
      body,
    });
    response.writeHead(result.status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(result.status === 204 ? undefined : JSON.stringify(result.body ?? {}));
  } catch (error) {
    console.error("AI grading worker request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    response.writeHead(500, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify({ ok: false }));
  }
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8080);
  const server = http.createServer((request, response) => {
    void handleHttpRequest(request, response);
  });
  server.listen(port, "0.0.0.0", () => {
    console.info(`AI grading worker listening on ${port}`);
  });
  const shutdown = (signal: string) => {
    console.info(`Received ${signal}; shutting down.`);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
