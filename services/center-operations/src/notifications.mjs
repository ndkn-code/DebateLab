import { createHash } from "node:crypto";

const call = async (rpc, name, args) => { const result = await rpc(name, args); if (result?.error) throw result.error; return result?.data; };

export function createCenterNotifications({ db, rpc = db?.rpc?.bind(db), loadProvider, now = () => new Date(), appOrigin, verifyWebhook } = {}) {
  if (typeof rpc !== "function" || typeof loadProvider !== "function") throw new TypeError("rpc and loadProvider are required");
  const deliver = async (event) => {
    const context = await call(rpc, "center_notification_context", { p_event_id: event?.id });
    if (!context?.allowed) return { status: context?.reason?.startsWith("deferred_") ? "deferred" : "skipped", reason: context?.reason ?? "not_allowed" };
    const provider = (context.recipients ?? []).length ? await loadProvider(context.connectionId) : null;
    const outcomes = [];
    for (const recipient of context.recipients ?? []) {
      const consumer = `zbs:${recipient.id}`;
      const reservation = await call(rpc, "center_reserve_delivery", { p_event_id: event.id, p_consumer: consumer, p_detail: { reservedAt: now().toISOString() } });
      if (!reservation?.allowed) { outcomes.push(reservation); continue; }
      const trackingId = createHash("sha256").update(`${event.id}:${recipient.id}`).digest("hex");
      try {
        const response = await provider.sendTemplate({ recipient: { phone: recipient.phone }, templateId: context.templateId, templateData: context.templateData, trackingId });
        const providerId = response?.message_id ?? response?.data?.message_id ?? response?.msg_id ?? null;
        outcomes.push(await call(rpc, "center_record_delivery", { p_event_id: event.id, p_consumer: consumer, p_status: "completed", p_provider_id: providerId, p_detail: { trackingId } }));
      } catch (error) {
        const uncertain = error?.retryable === true || error?.code === "TIMEOUT" || error?.code === "NETWORK_ERROR";
        outcomes.push(await call(rpc, "center_record_delivery", { p_event_id: event.id, p_consumer: consumer, p_status: uncertain ? "uncertain" : "failed", p_detail: { code: error?.code ?? "provider_rejected" } }));
      }
    }
    return { status: outcomes.some((outcome) => outcome?.reason?.startsWith("deferred_")) ? "deferred" : "delivered", outcomes };
  };
  return Object.freeze({
    deliver,
    schedule: () => call(rpc, "center_schedule_reminders", {}),
    webhook: async ({ body, headers } = {}) => {
      if (typeof verifyWebhook === "function") return verifyWebhook({ body, headers });
      throw Object.assign(new Error("ZBS webhook verification is not configured"), { code: "WEBHOOK_UNAVAILABLE" });
    },
  });
}
