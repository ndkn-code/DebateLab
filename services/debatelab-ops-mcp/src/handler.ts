import type http from "node:http";
import { verifyOpsMcpCaller } from "./auth.js";
import type { OpsMcpEnvironment } from "./config.js";
import { handleStatelessMcpRequest } from "./mcp.js";
import { checkReadiness } from "./readiness.js";
import type { OpsRepository } from "./repository.js";

export const MAX_MCP_BODY_BYTES = 64 * 1024;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_BODY_BYTES) {
    throw new HttpError(413, "REQUEST_BODY_TOO_LARGE");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_MCP_BODY_BYTES) {
      throw new HttpError(413, "REQUEST_BODY_TOO_LARGE");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON");
  }
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export type HttpDependencies = {
  repository: OpsRepository;
  environment?: OpsMcpEnvironment;
  verifyCaller?: (authorization: string | undefined) => Promise<void>;
  handleMcp?: (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    body: unknown,
  ) => Promise<void>;
};

export async function handleHttpRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  dependencies: HttpDependencies,
): Promise<void> {
  const environment = dependencies.environment ?? process.env;
  const method = request.method ?? "GET";
  const path = new URL(request.url ?? "/", "http://ops-mcp.local").pathname;
  try {
    if (method === "GET" && path === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (method === "GET" && path === "/readyz") {
      const readiness = await checkReadiness(
        dependencies.repository,
        environment,
      );
      sendJson(response, readiness.ready ? 200 : 503, readiness);
      return;
    }
    if (path !== "/mcp") {
      sendJson(response, 404, { ok: false, code: "NOT_FOUND" });
      return;
    }
    if (method !== "POST") {
      response.setHeader("allow", "POST");
      sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    try {
      await (dependencies.verifyCaller
        ? dependencies.verifyCaller(request.headers.authorization)
        : verifyOpsMcpCaller(request.headers.authorization, environment));
    } catch {
      throw new HttpError(401, "UNAUTHORIZED");
    }
    const body = await readJsonBody(request);
    if (dependencies.handleMcp) {
      await dependencies.handleMcp(request, response, body);
    } else {
      await handleStatelessMcpRequest(request, response, body, {
        repository: dependencies.repository,
        environment,
      });
    }
  } catch (error) {
    if (response.headersSent) {
      response.end();
      return;
    }
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR";
    // Do not log request bodies, MCP arguments, prompts, or provider content.
    console.error("DebateLab ops MCP request failed", {
      path,
      method,
      status,
      code,
    });
    sendJson(response, status, { ok: false, code });
  }
}
