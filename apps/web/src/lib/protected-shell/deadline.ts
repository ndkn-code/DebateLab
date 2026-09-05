export class DependencyUnavailableError extends Error {
  constructor() {
    super("Dependency temporarily unavailable");
    this.name = "DependencyUnavailableError";
  }
}

/** A total budget, including SDK retry delays and non-cooperative promises. */
export async function withinDeadline<T>(
  operation: () => PromiseLike<T>,
  milliseconds: number,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new DependencyUnavailableError());
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Abort the transport as well as bounding callers that ignore abort signals. */
export function boundedFetch(milliseconds: number, fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort();
    if (upstream?.aborted) abort();
    else upstream?.addEventListener("abort", abort, { once: true });
    try {
      return await withinDeadline(
        () => fetcher(input, { ...init, signal: controller.signal }),
        milliseconds,
        abort,
      );
    } finally {
      upstream?.removeEventListener("abort", abort);
    }
  };
}

/** Bound authentication without changing legitimate downstream query budgets. */
export function boundedAuthFetch(milliseconds: number, fetcher: typeof fetch = fetch): typeof fetch {
  const authFetch = boundedFetch(milliseconds, fetcher);
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(url).pathname.startsWith("/auth/v1/")
      ? authFetch(input, init)
      : fetcher(input, init);
  };
}
