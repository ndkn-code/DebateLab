import assert from "node:assert/strict";
import { test } from "node:test";
import { startPracticeRecording } from "./practice-recording-start";
import { createMicrophoneRequest } from "./practice-microphone-request";

const stream = {
  getTracks: () => [{ stop: () => {} }],
  getAudioTracks: () => [{ readyState: "live" }],
} as unknown as MediaStream;

for (const mode of ["start", "resume", "next-round"]) {
  test(`${mode}: failed acquisition never starts recorder or commits phase/timer/transcript`, async () => {
    const calls: string[] = [];
    const work = {
      transcript: "Already recorded words",
      round: 1,
      timer: false,
      debits: 0,
    };
    await assert.rejects(
      startPracticeRecording({
        waitForStop: async () => {},
        acquire: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
        isCurrent: () => true,
        startRecorder: () => {
          calls.push("recorder");
          return true;
        },
        commit: () => {
          calls.push("commit");
          work.timer = true;
        },
      }),
      { name: "NotAllowedError" },
    );
    assert.deepEqual(calls, []);
    assert.deepEqual(work, {
      transcript: "Already recorded words",
      round: 1,
      timer: false,
      debits: 0,
    });
  });
}

test("recorder startup failure never commits or clears existing work", async () => {
  let committed = false;
  await assert.rejects(
    startPracticeRecording({
      waitForStop: async () => {},
      acquire: async () => stream,
      isCurrent: () => true,
      startRecorder: () => false,
      commit: () => {
        committed = true;
      },
    }),
    /recorder-start-failed/,
  );
  assert.equal(committed, false);
});

test("resume waits for previous final audio chunk before starting", async () => {
  let finishStop!: () => void;
  const events: string[] = [];
  const stopping = new Promise<void>((resolve) => {
    finishStop = resolve;
  });
  const start = startPracticeRecording({
    waitForStop: () => stopping,
    acquire: async () => {
      events.push("acquire");
      return stream;
    },
    isCurrent: () => true,
    startRecorder: () => {
      events.push("record");
      return true;
    },
    commit: () => {
      events.push("timer");
    },
  });
  await Promise.resolve();
  assert.equal(events.length, 0);
  events.push("final-chunk");
  finishStop();
  assert.equal(await start, true);
  assert.deepEqual(events, ["final-chunk", "acquire", "record", "timer"]);
});

test("pending permission cancellation settles without recording or submission", async () => {
  const request = createMicrophoneRequest(() => new Promise(() => {}));
  let committed = false;
  const result = startPracticeRecording({
    waitForStop: async () => {},
    acquire: () => request.promise,
    isCurrent: () => true,
    startRecorder: () => {
      throw new Error("must not record");
    },
    commit: () => {
      committed = true;
    },
  });
  await Promise.resolve();
  request.cancel();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(committed, false);
});

test("stale resumed attempt cannot commit after cancellation", async () => {
  let current = true;
  let resolve!: (value: MediaStream) => void;
  const pending = new Promise<MediaStream>((done) => {
    resolve = done;
  });
  const result = startPracticeRecording({
    waitForStop: async () => {},
    acquire: () => pending,
    isCurrent: () => current,
    startRecorder: () => {
      throw new Error("must not start stale capture");
    },
    commit: () => {
      throw new Error("must not commit stale capture");
    },
  });
  await Promise.resolve();
  current = false;
  resolve(stream);
  assert.equal(await result, false);
});

test("device ends between permission resolution and recorder start", async () => {
  let committed = false;
  const ended = {
    getAudioTracks: () => [{ readyState: "ended" }],
  } as unknown as MediaStream;
  await assert.rejects(
    startPracticeRecording({
      waitForStop: async () => {},
      acquire: async () => ended,
      isCurrent: () => true,
      startRecorder: () => {
        throw new Error("must not start");
      },
      commit: () => {
        committed = true;
      },
    }),
    { name: "NotFoundError" },
  );
  assert.equal(committed, false);
});

test("cancellation immediately after acquisition stops the delivered stream", async () => {
  let current = true;
  let stopped = 0;
  const late = { getTracks: () => [{ stop: () => { stopped += 1; } }] } as unknown as MediaStream;
  const result = await startPracticeRecording({
    waitForStop: async () => {},
    acquire: async () => { current = false; return late; },
    isCurrent: () => current,
    startRecorder: () => { throw new Error("must not start"); },
    commit: () => { throw new Error("must not commit"); },
  });
  assert.equal(result, false);
  assert.equal(stopped, 1);
});
