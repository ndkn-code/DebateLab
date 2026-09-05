import { isLiveAudioStream, stopMediaStream } from "./practice-microphone-request";

/** Commit speaking/timer state only after capture has actually started. */
export async function startPracticeRecording(options: {
  waitForStop: () => Promise<unknown>;
  acquire: () => Promise<MediaStream>;
  isCurrent: () => boolean;
  startRecorder: (stream: MediaStream) => boolean;
  commit: (stream: MediaStream) => void;
}): Promise<boolean> {
  await options.waitForStop();
  if (!options.isCurrent()) return false;
  const stream = await options.acquire();
  if (!options.isCurrent()) {
    stopMediaStream(stream);
    return false;
  }
  if (!isLiveAudioStream(stream)) {
    throw new DOMException("No live microphone", "NotFoundError");
  }
  if (!options.startRecorder(stream)) throw new Error("recorder-start-failed");
  options.commit(stream);
  return true;
}
