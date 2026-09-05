import assert from "node:assert/strict";
import test from "node:test";
import {
  AudioRecorderController,
  RecorderLike,
} from "./audio-recorder-controller";

Object.defineProperty(globalThis, "MediaRecorder", {
  configurable: true,
  value: { isTypeSupported: () => false },
});

class FakeRecorder implements RecorderLike {
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: RecorderLike["ondataavailable"] = null;
  onstop: RecorderLike["onstop"] = null;
  onerror: RecorderLike["onerror"] = null;
  constructor(private readonly shouldFail = false) {}
  start() {
    if (this.shouldFail) throw new Error("start failed");
    this.state = "recording";
  }
  stop() {
    this.ondataavailable?.({ data: new Blob(["final"]) });
    this.state = "inactive";
    this.onstop?.();
  }
}

function stream() {
  return {
    getAudioTracks: () => [{ readyState: "live" }],
  } as unknown as MediaStream;
}

test("failed reset start keeps the previous recording", async () => {
  const blobs: Array<Blob | null> = [];
  let fail = false;
  const controller = new AudioRecorderController(
    {
      onBlob: (blob) => blobs.push(blob),
      onError: () => {},
      onRecordingChange: () => {},
    },
    () => new FakeRecorder(fail),
  );
  assert.equal(controller.start(stream(), true), true);
  const previous = await controller.stop();
  fail = true;
  assert.equal(controller.start(stream(), true), false);
  assert.equal(blobs.at(-1), previous);
});

test("pause and resume preserve chunks and stop is idempotent", async () => {
  const controller = new AudioRecorderController(
    { onBlob: () => {}, onError: () => {}, onRecordingChange: () => {} },
    () => new FakeRecorder(),
  );
  assert.equal(controller.start(stream(), true), true);
  const firstStop = controller.stop();
  assert.equal(controller.stop(), firstStop);
  await firstStop;
  assert.equal(controller.start(stream()), true);
  const result = await controller.stop();
  assert.equal(result?.size, 10);
});

test("initial blob is retained when resuming", async () => {
  const initial = new Blob(["prior"]);
  const controller = new AudioRecorderController(
    { onBlob: () => {}, onError: () => {}, onRecordingChange: () => {} },
    () => new FakeRecorder(),
    initial,
  );
  assert.equal(controller.start(stream()), true);
  const result = await controller.stop();
  assert.equal(result?.size, 10);
});

test("an unexpected recorder error preserves chunks and stops the recorder", async () => {
  let error: string | null = null;
  const recorder = new FakeRecorder();
  const controller = new AudioRecorderController(
    {
      onBlob: () => {},
      onError: (message) => {
        error = message;
      },
      onRecordingChange: () => {},
    },
    () => {
      return recorder;
    },
  );
  assert.equal(controller.start(stream()), true);
  recorder?.ondataavailable?.({ data: new Blob(["partial"]) });
  recorder?.onerror?.({ error: new Error("device disconnected") });
  assert.ok(error);
  assert.equal(recorder?.state, "inactive");
  assert.equal((await controller.stop())?.size, 12);
});

test("a queued stop tail cannot be replaced by a new recorder", async () => {
  class QueuedRecorder extends FakeRecorder {
    stop() {
      this.state = "inactive";
    }
    flush() {
      this.ondataavailable?.({ data: new Blob(["tail"]) });
      this.onstop?.();
    }
  }
  const recorder = new QueuedRecorder();
  const controller = new AudioRecorderController(
    { onBlob: () => {}, onError: () => {}, onRecordingChange: () => {} },
    () => recorder,
  );
  controller.start(stream());
  const stop = controller.stop();
  assert.equal(controller.stop(), stop);
  assert.equal(controller.start(stream()), false);
  recorder.flush();
  assert.equal(await (await stop)?.text(), "tail");
});

test("unexpected error waits for asynchronously delivered final audio", async () => {
  class QueuedRecorder extends FakeRecorder {
    stop() {
      this.state = "inactive";
    }
    flush() {
      this.ondataavailable?.({ data: new Blob(["last words"]) });
      this.onstop?.();
    }
  }
  const recorder = new QueuedRecorder();
  const controller = new AudioRecorderController(
    { onBlob: () => {}, onError: () => {}, onRecordingChange: () => {} },
    () => recorder,
  );
  controller.start(stream());
  recorder.onerror?.({ error: new Error("device lost") });
  const pending = controller.stop();
  recorder.flush();
  assert.equal(await (await pending)?.text(), "last words");
});

test("StrictMode cleanup then setup permits recording again", async () => {
  const controller = new AudioRecorderController(
    { onBlob: () => {}, onError: () => {}, onRecordingChange: () => {} },
    () => new FakeRecorder(),
  );
  controller.dispose();
  controller.activate();
  assert.equal(controller.start(stream()), true);
  assert.ok(await controller.stop());
});
