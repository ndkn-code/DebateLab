export interface StoppableMediaRecorder {
  state: string;
  stop: () => void;
  addEventListener: (
    type: "stop",
    listener: () => void,
    options?: { once?: boolean }
  ) => void;
}

export function stopMediaRecorderAndBuildBlob(
  recorder: StoppableMediaRecorder,
  chunks: Blob[],
  mimeType: string
) {
  if (recorder.state === "inactive") {
    return Promise.resolve(new Blob(chunks, { type: mimeType }));
  }

  return new Promise<Blob>((resolve) => {
    recorder.addEventListener(
      "stop",
      () => resolve(new Blob(chunks, { type: mimeType })),
      { once: true }
    );
    recorder.stop();
  });
}
