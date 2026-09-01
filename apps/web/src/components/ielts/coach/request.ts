export interface IeltsCoachChatRequestBody {
  message: string;
  conversationId?: string;
  requestId: string;
  context: "ielts-coach";
  productContext: "ielts";
  subjectContext: "ielts";
  practiceLanguage: "en" | "vi";
  googleAiConsent: boolean;
}

/** Builds the public chat payload with an explicit IELTS product boundary. */
export function buildIeltsCoachChatRequest(params: {
  message: string;
  conversationId: string | null;
  requestId: string;
  locale: "en" | "vi";
  googleAiConsent?: boolean;
}): IeltsCoachChatRequestBody {
  const message = params.message.trim();
  if (!message) throw new Error("IELTS_COACH_MESSAGE_REQUIRED");
  if (!params.requestId.trim()) {
    throw new Error("IELTS_COACH_REQUEST_ID_REQUIRED");
  }

  return {
    message,
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    requestId: params.requestId,
    context: "ielts-coach",
    productContext: "ielts",
    subjectContext: "ielts",
    practiceLanguage: params.locale,
    googleAiConsent: params.googleAiConsent === true,
  };
}
