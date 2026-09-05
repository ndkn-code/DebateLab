import test from "node:test";
import assert from "node:assert/strict";
import { createCenterServer } from "./server.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const deps = () => ({ appOrigin: "https://thinkfy.net", authenticate: async () => ({ id }), oauth: { start: async (x) => x, callback: async () => ({ clubId: id }) }, callbacks: { zalopay: async ({ body }) => body, google: async () => {}, zbs: async ({ body }) => body }, processEvent: async () => {}, reconcile: async () => ({ processed: 0 }), resources: { list: async (x) => x, bind: async (x) => x } });
const request = (server, path, options = {}) => new Promise((resolve, reject) => { const r = server.address(); const req = fetch(`http://127.0.0.1:${r.port}${path}`, { redirect: "manual", ...options }); req.then(resolve, reject); });

test("health and OAuth start authenticate the user", async () => {
  const d = deps(); let actor; d.oauth.start = async (x) => { actor = x; return { url: "https://accounts.google.com" }; };
  const s = createCenterServer(d).listen(0); await new Promise((r) => s.once("listening", r));
  const h = await request(s, "/healthz"); assert.equal(h.status, 200);
  const o = await request(s, "/oauth/google/start", { method: "POST", headers: { "content-type": "application/json", "x-thinkfy-user-token": "token" }, body: JSON.stringify({ clubId: id }) });
  assert.equal(o.status, 200); assert.deepEqual(actor, { clubId: id, actorId: id }); s.close();
});

test("callback redirects contain no provider error details and task envelope is decoded", async () => {
  const d = deps(); let processed; d.oauth.callback = async () => { throw new Error("secret token"); }; d.processEvent = async (x) => { processed = x; };
  const s = createCenterServer(d).listen(0); await new Promise((r) => s.once("listening", r));
  const c = await request(s, "/oauth/google/callback?state=s&code=c"); assert.equal(c.status, 303); assert.match(c.headers.get("location"), /connection=failed/); assert.doesNotMatch(c.headers.get("location"), /secret/);
  const t = await request(s, "/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ eventId: id })).toString("base64") } }) }); assert.equal(t.status, 200); assert.equal(processed, id); s.close();
});

test("oversize request is rejected", async () => { const s = createCenterServer(deps()).listen(0); await new Promise((r) => s.once("listening", r)); const r = await request(s, "/reconcile", { method: "POST", body: "x".repeat(256 * 1024 + 1) }); assert.equal(r.status, 413); s.close(); });

test("Google push accepts an empty body and forwards only watch headers before returning 204", async (t) => {
  const d = deps(); const calls = [];
  d.callbacks.google = async (headers) => { calls.push(headers); };
  const s = createCenterServer(d).listen(0);
  t.after(() => { s.closeAllConnections(); s.close(); });
  await new Promise((resolve) => s.once("listening", resolve));
  const headers = {
    "x-goog-channel-id": id,
    "x-goog-channel-token": "watch-token",
    "x-goog-resource-id": "resource-id",
    "x-goog-resource-state": "exists",
    "x-goog-message-number": "2",
    "authorization": "unrelated-header",
  };
  // Google Calendar push notifications contain headers and no JSON body.
  const result = await request(s, "/callbacks/google", { method: "POST", headers });
  assert.equal(result.status, 204);
  assert.equal(await result.text(), "");
  assert.deepEqual(calls, [{
    "x-goog-channel-id": id,
    "x-goog-channel-token": "watch-token",
    "x-goog-resource-id": "resource-id",
    "x-goog-resource-state": "exists",
    "x-goog-message-number": "2",
  }]);
});

test("an empty Google push is not acknowledged when watch verification fails", async (t) => {
  const d = deps(); let calls = 0;
  d.callbacks.google = async () => { calls++; throw new Error("Invalid watch channel: secret-token"); };
  const s = createCenterServer(d).listen(0);
  t.after(() => { s.closeAllConnections(); s.close(); });
  await new Promise((resolve) => s.once("listening", resolve));
  const result = await request(s, "/callbacks/google", { method: "POST", headers: { "x-goog-channel-id": id } });
  assert.equal(calls, 1);
  assert.equal(result.status, 500);
  assert.deepEqual(await result.json(), { error: "Internal server error" });
});
