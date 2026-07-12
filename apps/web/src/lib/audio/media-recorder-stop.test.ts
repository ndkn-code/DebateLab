import assert from "node:assert/strict";
import test from "node:test";
import { stopMediaRecorderAndBuildBlob } from "./media-recorder-stop";

test("resolves only after the recorder emits stop", async () => {
  let stopListener: (() => void) | null = null;
  let settled = false;
  const recorder = {
    state: "recording",
    addEventListener: (_type: "stop", listener: () => void) => {
      stopListener = listener;
    },
    stop: () => {},
  };
  const promise = stopMediaRecorderAndBuildBlob(
    recorder,
    [new Blob(["audio-one"]), new Blob(["-audio-two"])],
    "audio/webm"
  ).then((blob) => {
    settled = true;
    return blob;
  });

  await Promise.resolve();
  assert.equal(settled, false);
  assert.ok(stopListener);
  (stopListener as () => void)();
  const blob = await promise;
  assert.equal(settled, true);
  assert.equal(blob.size, 19);
  assert.equal(blob.type, "audio/webm");
});

test("returns accumulated chunks immediately for an inactive recorder", async () => {
  const blob = await stopMediaRecorderAndBuildBlob(
    {
      state: "inactive",
      addEventListener: () => {},
      stop: () => assert.fail("stop should not be called"),
    },
    [new Blob(["kept"])],
    "audio/webm"
  );
  assert.equal(await blob.text(), "kept");
});
