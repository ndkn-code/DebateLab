export type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

export interface MicrophoneRequest {
  promise: Promise<MediaStream>;
  cancel: () => void;
}

export type MicrophoneErrorKind =
  | "denied"
  | "not-found"
  | "error"
  | "cancelled";

export function getMicrophoneErrorKind(error: unknown): MicrophoneErrorKind {
  if (error instanceof DOMException) {
    if (error.name === "AbortError") return "cancelled";
    if (error.name === "NotAllowedError" || error.name === "SecurityError")
      return "denied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError")
      return "not-found";
  }
  return "error";
}

export function isLiveAudioStream(
  stream: MediaStream | null | undefined,
): stream is MediaStream {
  return Boolean(
    stream?.getAudioTracks().some((track) => track.readyState === "live"),
  );
}

/**
 * Browser permission prompts cannot be aborted. Cancelling invalidates the
 * request and stops any stream that resolves after cancellation.
 */
export function createMicrophoneRequest(
  getUserMedia: GetUserMedia,
): MicrophoneRequest {
  let cancelled = false;
  let settled = false;
  let rejectRequest: ((reason?: unknown) => void) | null = null;

  const promise = new Promise<MediaStream>((resolve, reject) => {
    rejectRequest = reject;
    void getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16_000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    }).then(
      (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          reject(
            new DOMException("Microphone request was cancelled", "AbortError"),
          );
          return;
        }
        settled = true;
        resolve(stream);
      },
      (error: unknown) => {
        if (cancelled) {
          reject(
            new DOMException("Microphone request was cancelled", "AbortError"),
          );
          return;
        }
        settled = true;
        reject(error);
      },
    );
  });

  return {
    promise,
    cancel: () => {
      if (cancelled || settled) return;
      cancelled = true;
      rejectRequest?.(
        new DOMException("Microphone request was cancelled", "AbortError"),
      );
    },
  };
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
