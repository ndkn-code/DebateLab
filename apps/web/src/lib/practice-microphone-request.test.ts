import assert from "node:assert/strict";
import test from "node:test";
import { createMicrophoneRequest } from "./practice-microphone-request";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function streamFixture() {
  let stopped = 0;
  const track = {
    stop: () => {
      stopped += 1;
    },
  } as MediaStreamTrack;
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    stopped: () => stopped,
  };
}

test("cancel invalidates a never resolving request", async () => {
  const pending = deferred<MediaStream>();
  const request = createMicrophoneRequest(() => pending.promise);
  request.cancel();
  await assert.rejects(request.promise, { name: "AbortError" });
});

test("a stream resolving after cancel is stopped immediately", async () => {
  const pending = deferred<MediaStream>();
  const fixture = streamFixture();
  const request = createMicrophoneRequest(() => pending.promise);
  request.cancel();
  pending.resolve(fixture.stream);
  await assert.rejects(request.promise, { name: "AbortError" });
  assert.equal(fixture.stopped(), 1);
});

test("stale rejection remains cancelled", async () => {
  const pending = deferred<MediaStream>();
  const request = createMicrophoneRequest(() => pending.promise);
  request.cancel();
  pending.reject(new DOMException("Permission denied", "NotAllowedError"));
  await assert.rejects(request.promise, { name: "AbortError" });
});

test("active requests preserve browser errors for retry states", async () => {
  await assert.rejects(
    createMicrophoneRequest(() =>
      Promise.reject(new DOMException("No device", "NotFoundError")),
    ).promise,
    { name: "NotFoundError" },
  );
  await assert.rejects(
    createMicrophoneRequest(() =>
      Promise.reject(new DOMException("Denied", "NotAllowedError")),
    ).promise,
    { name: "NotAllowedError" },
  );
});
