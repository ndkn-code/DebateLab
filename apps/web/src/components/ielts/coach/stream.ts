import type { CoachMessageMetadata } from "@/types";

export type IeltsCoachStreamEvent = {
  text?: string;
  done?: boolean;
  error?: string;
  conversationId?: string;
  assistantMessageId?: string;
  metadata?: CoachMessageMetadata | null;
};

export async function readIeltsCoachStream(
  response: Response,
  onEvent: (event: IeltsCoachStreamEvent) => void,
) {
  if (!response.ok || !response.body) {
    throw new Error(`IELTS coach request failed (${response.status})`);
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
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as IeltsCoachStreamEvent;
        if (event.error) throw new Error("IELTS coach stream failed");
        onEvent(event);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }

  const finalLine = `${buffer}${decoder.decode()}`.trim();
  if (finalLine.startsWith("data: ")) {
    try {
      const event = JSON.parse(finalLine.slice(6)) as IeltsCoachStreamEvent;
      if (event.error) throw new Error("IELTS coach stream failed");
      onEvent(event);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
}
