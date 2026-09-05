import { URL } from "node:url";
import { createServer } from "node:http";

const rawBodies = new WeakMap();
const MAX_BODY = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (res, status, value, headers = {}) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), ...headers });
  res.end(body);
};
const clientError = (res, status, message = "Request rejected") => json(res, status, { error: message });

const readJson = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = []; let tooLarge = false;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) { tooLarge = true; return; }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (tooLarge) return reject(Object.assign(new Error("body too large"), { status: 413 }));
    if (size === 0) return reject(Object.assign(new Error("JSON body required"), { status: 400 }));
    try { const raw=Buffer.concat(chunks).toString("utf8"); const body=JSON.parse(raw); if(!body || typeof body!=="object" || Array.isArray(body)) throw new Error("Invalid JSON object"); rawBodies.set(body,raw); resolve(body); } catch { reject(Object.assign(new Error("invalid JSON"), { status: 400 })); }
  });
  req.on("error", reject);
});

const requireUuid = (value, name) => {
  if (typeof value !== "string" || !UUID.test(value)) throw Object.assign(new Error(`${name} invalid`), { status: 400 });
  return value;
};
const auth = async (req, deps) => {
  const token = req.headers["x-thinkfy-user-token"];
  if (typeof token !== "string" || !token) throw Object.assign(new Error("unauthorized"), { status: 401 });
  const user = await deps.authenticate(token);
  if (!user || typeof user.id !== "string") throw Object.assign(new Error("unauthorized"), { status: 401 });
  return user;
};
const safeHeaders = (headers, prefix) => Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase().startsWith(prefix)));

export async function handleRequest(req, res, deps) {
  try {
    const url = new URL(req.url || "/", "http://center.local");
    const method = req.method || "GET";
    if (method === "POST" && Number(req.headers["content-length"] || 0) > MAX_BODY) return clientError(res, 413, "Request body too large");
    if (method === "GET" && url.pathname === "/healthz") return json(res, 200, { ok: true });
    if (method === "POST" && url.pathname === "/oauth/google/start") {
      const user = await auth(req, deps); const body = await readJson(req); const clubId = requireUuid(body.clubId, "clubId");
      return json(res, 200, await deps.oauth.start({ clubId, actorId: user.id, ...(body.input?.existingCalendars === true ? {scopes:["https://www.googleapis.com/auth/calendar.app.created","https://www.googleapis.com/auth/drive.file","https://www.googleapis.com/auth/calendar.events","https://www.googleapis.com/auth/calendar.calendarlist.readonly"]} : {}) }));
    }
    if (method === "GET" && url.pathname === "/oauth/google/callback") {
      const state = url.searchParams.get("state"); const code = url.searchParams.get("code");
      if (!state || !code) return res.writeHead(303, { location: `${deps.appOrigin}/vi/dashboard/teacher/center?connection=failed` }).end();
      try {
        const result = await deps.oauth.callback({ state, code });
        const clubId = requireUuid(result?.clubId, "clubId");
        return res.writeHead(303, { location: `${deps.appOrigin}/vi/dashboard/teacher/center?organization=${encodeURIComponent(clubId)}` }).end();
      } catch { return res.writeHead(303, { location: `${deps.appOrigin}/vi/dashboard/teacher/center?connection=failed` }).end(); }
    }
    const callback = url.pathname.match(/^\/callbacks\/(zalopay|google|zbs)(?:\/([0-9a-f-]{36}))?$/i);
    if (method === "POST" && callback) {
      if (callback[1] === "google") { await deps.callbacks.google(safeHeaders(req.headers, "x-goog-")); res.writeHead(204).end(); return; }
      const body = await readJson(req);
      if (callback[1] === "zalopay") { requireUuid(callback[2], "connectionId"); return json(res, 200, await deps.callbacks.zalopay({ connectionId: callback[2], body })); }
      return json(res, 200, await deps.callbacks.zbs({ connectionId: requireUuid(callback[2],"connectionId"), body, rawBody:rawBodies.get(body), headers: req.headers }));
    }
    if (method === "POST" && url.pathname === "/tasks") {
      const body = await readJson(req); const encoded = body?.message?.data;
      if (typeof encoded !== "string") return clientError(res, 400);
      let event; try { event = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")); } catch { return clientError(res, 400); }
      requireUuid(event?.eventId, "eventId"); await deps.processEvent(event.eventId); return json(res, 200, { ok: true });
    }
    if (method === "POST" && url.pathname === "/reconcile") { return json(res, 200, await deps.reconcile()); }
    if (method === "POST" && (url.pathname === "/resources/list" || url.pathname === "/resources/bind" || url.pathname === "/resources/picker" || url.pathname === "/resources/sync")) {
      const user = await auth(req, deps); const body = await readJson(req); const clubId = requireUuid(body.clubId, "clubId");
      if (url.pathname === "/resources/list") return json(res, 200, await deps.resources.list({ clubId, actorId: user.id }));
      if (url.pathname === "/resources/picker") return json(res, 200, await deps.resources.picker({ clubId, actorId: user.id }));
      if (!body.input || typeof body.input !== "object" || Array.isArray(body.input)) return clientError(res, 400);
      if(url.pathname === "/resources/sync") return json(res,200,await deps.resources.sync({clubId,actorId:user.id,input:body.input}));
      return json(res, 200, await deps.resources.bind({ clubId, actorId: user.id, input: body.input }));
    }
    return clientError(res, 404, "Not found");
  } catch (error) {
    if (error?.status === 413) return clientError(res, 413, "Request body too large");
    if (error?.status === 400) return clientError(res, 400);
    if (error?.status === 401) return clientError(res, 401, "Unauthorized");
    if (error?.status === 404) return clientError(res, 404, "Not found");
    return clientError(res, 500, "Internal server error");
  }
}

export function createCenterServer(deps) {
  if (!deps || typeof deps !== "object") throw new TypeError("deps required");
  const origin = new URL(deps.appOrigin);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) throw new TypeError("appOrigin must be an HTTPS origin");
  deps.appOrigin = origin.origin;
  return createServer((req, res) => handleRequest(req, res, deps));
}
