import type { IeltsCoachResponseMetadata } from "@/lib/coach/ielts-api-contract";

export type IeltsCoachStreamEvent = {
  text?: string;
  done?: boolean;
  error?: string;
  conversationId?: string;
  assistantMessageId?: string | null;
  productContext?: "ielts";
  metadata?: IeltsCoachResponseMetadata | null;
};

export class IeltsCoachStreamError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "IeltsCoachStreamError";
  }
}

async function responseError(response: Response) {
  const errorBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    userMessage?: unknown;
  } | null;
  return new IeltsCoachStreamError(
    response.status,
    typeof errorBody?.code === "string" ? errorBody.code : null,
    typeof errorBody?.userMessage === "string"
      ? errorBody.userMessage
      : `IELTS coach request failed (${response.status})`,
  );
}

function parseStreamEvent(value: string): IeltsCoachStreamEvent | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const event = parsed as IeltsCoachStreamEvent;
    if (event.error) throw new Error("IELTS coach stream failed");
    if (parsed.productContext && parsed.productContext !== "ielts") {
      throw new Error("IELTS coach product context mismatch");
    }
    const metadata = parsed.metadata as Record<string, unknown> | undefined;
    if (metadata?.productContext && metadata.productContext !== "ielts") {
      throw new Error("IELTS coach metadata context mismatch");
    }
    return event;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function emitDataLine(
  line: string,
  onEvent: (event: IeltsCoachStreamEvent) => void,
) {
  if (!line.startsWith("data: ")) return;
  const event = parseStreamEvent(line.slice(6));
  if (event) onEvent(event);
}

export async function readIeltsCoachStream(
  response: Response,
  onEvent: (event: IeltsCoachStreamEvent) => void,
) {
  if (!response.ok) {
    throw await responseError(response);
  }
  if (!response.body) {
    throw new IeltsCoachStreamError(
      response.status,
      null,
      "IELTS coach response stream is unavailable",
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      emitDataLine(line, onEvent);
    }
  }

  const finalLine = `${buffer}${decoder.decode()}`.trim();
  emitDataLine(finalLine, onEvent);
}
