import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { withinDeadline } from "@/lib/protected-shell/deadline";

const requestBudget = new AsyncLocalStorage<AbortSignal>();

export function currentRequestBudget() {
  return requestBudget.getStore();
}

/** Request-local only: no identity, authorization result, or data crosses users. */
export async function withServerRequestBudget<T>(operation: () => PromiseLike<T>, milliseconds: number) {
  const controller = new AbortController();
  try {
    return await requestBudget.run(controller.signal, () =>
      withinDeadline(operation, milliseconds, () => controller.abort()),
    );
  } finally {
    controller.abort();
  }
}

export function budgetedFetch(signal: AbortSignal, fetcher: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    // A library retry after the request budget expires must never hit the network.
    signal.throwIfAborted();
    const original = init?.signal ?? (input instanceof Request ? input.signal : null);
    return fetcher(input, {
      ...init,
      signal: original ? AbortSignal.any([signal, original]) : signal,
    });
  };
}
