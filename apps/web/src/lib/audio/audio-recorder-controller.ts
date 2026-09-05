export interface RecorderEvent {
  data?: Blob;
  error?: unknown;
}

export interface RecorderLike {
  readonly state: RecordingState;
  readonly mimeType: string;
  start: (timeslice?: number) => void;
  stop: () => void;
  ondataavailable: ((event: RecorderEvent) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: RecorderEvent) => void) | null;
}

export type RecorderFactory = (
  stream: MediaStream,
  options: MediaRecorderOptions,
) => RecorderLike;

interface ControllerCallbacks {
  onBlob: (blob: Blob | null) => void;
  onError: (message: string | null) => void;
  onRecordingChange: (recording: boolean) => void;
}

const DEFAULT_ERROR =
  "Failed to start recording. Please check your microphone.";
const errorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return fallback;
};

export class AudioRecorderController {
  private readonly createRecorder: RecorderFactory;
  private readonly callbacks: ControllerCallbacks;
  private recorder: RecorderLike | null = null;
  private chunks: Blob[] = [];
  private blob: Blob | null = null;
  private stopPromise: Promise<Blob | null> | null = null;
  private stopResolve: ((blob: Blob | null) => void) | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private disposed = false;

  constructor(
    callbacks: ControllerCallbacks,
    createRecorder: RecorderFactory = (stream, options) =>
      new MediaRecorder(stream, options) as unknown as RecorderLike,
    initialBlob: Blob | null = null,
  ) {
    this.callbacks = callbacks;
    this.createRecorder = createRecorder;
    this.blob = initialBlob;
    if (initialBlob) this.chunks = [initialBlob];
  }

  start(stream: MediaStream, reset = false): boolean {
    if (this.disposed || this.recorder) {
      return false;
    }

    const audioTracks = stream.getAudioTracks();
    if (
      audioTracks.length === 0 ||
      audioTracks.some((track) => track.readyState !== "live")
    ) {
      this.callbacks.onError(
        "Your microphone is unavailable. Check the microphone and try again.",
      );
      return false;
    }

    let recorder: RecorderLike | null = null;
    const previousChunks = this.chunks;
    const previousBlob = this.blob;
    if (reset) this.chunks = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      this.stopPromise = null;
      recorder = this.createRecorder(stream, { mimeType });
      if (!recorder) throw new Error(DEFAULT_ERROR);
      const activeRecorder = recorder;
      const generation = ++this.generation;
      activeRecorder.ondataavailable = (event) => {
        if (
          this.recorder !== activeRecorder ||
          this.generation !== generation ||
          !event.data ||
          event.data.size === 0
        )
          return;
        this.chunks.push(event.data);
      };
      activeRecorder.onstop = () => {
        if (this.recorder !== activeRecorder || this.generation !== generation)
          return;
        this.finishStop(
          activeRecorder,
          generation,
          this.stopPromise === null,
          null,
        );
      };
      activeRecorder.onerror = (event) => {
        if (this.recorder !== activeRecorder || this.generation !== generation)
          return;
        this.callbacks.onError(
          errorMessage(
            event.error,
            "Recording stopped unexpectedly. Please try again.",
          ),
        );
        // Error is followed by queued dataavailable/stop events in real browsers.
        // Wait for that tail instead of discarding the final segment.
        void this.stop();
      };
      this.recorder = activeRecorder;
      activeRecorder.start(1000);
    } catch (error) {
      if (this.recorder === recorder) this.recorder = null;
      if (reset) {
        this.chunks = previousChunks;
        this.blob = previousBlob;
      }
      this.callbacks.onRecordingChange(false);
      this.callbacks.onError(
        error instanceof Error && error.message ? error.message : DEFAULT_ERROR,
      );
      return false;
    }

    if (reset) {
      this.blob = null;
      this.callbacks.onBlob(null);
    }
    this.stopPromise = null;
    this.callbacks.onError(null);
    this.callbacks.onRecordingChange(true);
    return true;
  }

  activate(): void {
    this.disposed = false;
  }

  stop(): Promise<Blob | null> {
    if (this.stopPromise) return this.stopPromise;
    const recorder = this.recorder;
    if (!recorder) return Promise.resolve(this.blob);

    this.callbacks.onRecordingChange(false);
    const generation = this.generation;
    const promise = new Promise<Blob | null>((resolve) => {
      this.stopResolve = resolve;
    });
    this.stopPromise = promise;
    this.stopTimer = setTimeout(
      () => this.finishStop(recorder, generation, false, null),
      1000,
    );
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (error) {
        this.finishStop(recorder, generation, true, error);
      }
    }
    return promise;
  }

  dispose(): void {
    this.disposed = true;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.stopResolve?.(this.blob);
    this.stopResolve = null;
    const recorder = this.recorder;
    this.recorder = null;
    this.generation += 1;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* cleanup must not throw */
        }
      }
    }
  }

  private finishStop(
    recorder: RecorderLike,
    generation: number,
    unexpected: boolean,
    error: unknown,
  ): void {
    if (this.recorder !== recorder || this.generation !== generation) return;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    if (error || unexpected)
      this.callbacks.onError(
        errorMessage(
          error,
          "Recording stopped unexpectedly. Please try again.",
        ),
      );
    const blob = new Blob(this.chunks, { type: recorder.mimeType });
    this.blob = blob;
    this.callbacks.onBlob(blob);
    this.callbacks.onRecordingChange(false);
    this.recorder = null;
    this.stopResolve?.(blob);
    this.stopResolve = null;
    this.stopPromise ??= Promise.resolve(blob);
  }
}
