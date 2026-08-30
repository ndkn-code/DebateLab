function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function senderAddress(messageClass) {
  if (messageClass === "lifecycle" || messageClass === "marketing") {
    return process.env.RESEND_LIFECYCLE_FROM?.trim() || process.env.SENDER_EMAIL_ADDRESS?.trim() || "Thinkfy Updates <hello@updates.thinkfy.net>";
  }
  return process.env.RESEND_TRANSACTIONAL_FROM?.trim() || process.env.SENDER_EMAIL_ADDRESS?.trim() || "Thinkfy Notifications <hello@notifications.thinkfy.net>";
}

export function buildResendRequest({ event, recipient, content, job }) {
  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  const replyTo = process.env.REPLY_TO_EMAIL_ADDRESSES?.trim()
    ? process.env.REPLY_TO_EMAIL_ADDRESSES.split(",").map((value) => value.trim()).filter(Boolean)
    : ["support@thinkfy.net"];
  const optionalMessage = event.message_class === "lifecycle" || event.message_class === "marketing";
  const headers = {
    ...(content.oneClickUnsubscribeUrl
      ? {
          "List-Unsubscribe": `<${content.oneClickUnsubscribeUrl}>, <mailto:${replyTo[0]}?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : {}),
    ...(optionalMessage
      ? { "List-ID": `<${String(event.topic || content.category || "updates").replace(/[^a-z0-9.-]/gi, "-")}@updates.thinkfy.net>` }
      : {}),
  };
  return {
    url: process.env.RESEND_API_URL?.trim() || "https://api.resend.com/emails",
    headers: {
      authorization: `Bearer ${requiredEnvironment("RESEND_API_KEY")}`,
      "content-type": "application/json",
      "idempotency-key": job.idempotency_key,
    },
    body: {
      from: senderAddress(event.message_class),
      to: [recipient.email],
      reply_to: replyTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      tags: [
        { name: "template", value: content.templateKey },
        { name: "category", value: content.category },
        { name: "stream", value: senderStreamForMessageClass(event.message_class) },
        ...(typeof payload.topic === "string" ? [{ name: "topic", value: payload.topic }] : []),
      ],
    },
  };
}

function senderStreamForMessageClass(messageClass) {
  return messageClass === "lifecycle" || messageClass === "marketing" ? "updates" : "notifications";
}

export async function sendResendEmail(input, fetchImpl = fetch) {
  const request = buildResendRequest(input);
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(10_000),
  });
  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }
  if (!response.ok) {
    const message = responseBody?.message || responseBody?.error || `Resend request failed (${response.status}).`;
    const error = new Error(message);
    error.retryable = response.status === 429 || response.status >= 500;
    error.providerStatus = response.status;
    throw error;
  }
  return { providerMessageId: typeof responseBody?.id === "string" ? responseBody.id : null };
}
