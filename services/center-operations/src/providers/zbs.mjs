import { ProviderError } from "./zalopay.mjs";

const UID_ENDPOINT = "https://openapi.zalo.me/v3.0/oa/message/template";
const PHONE_ENDPOINT = "https://business.openapi.zalo.me/message/template";

export function validateZbsEligibility({ connectionStatus, templateStatus, consent, eligible, expiresAt, now = new Date() } = {}) {
  if (connectionStatus !== "connected") return { allowed: false, reason: "connection_not_connected" };
  if (templateStatus !== "approved") return { allowed: false, reason: "template_not_approved" };
  if (consent !== true) return { allowed: false, reason: "consent_required" };
  if (eligible !== true) return { allowed: false, reason: "recipient_not_eligible" };
  if (!expiresAt || new Date(expiresAt).getTime() <= new Date(now).getTime()) return { allowed: false, reason: "eligibility_expired" };
  return { allowed: true, reason: "eligible" };
}

export function createZbsProvider({ accessToken, fetchFn = fetch, timeoutMs = 10_000 } = {}) {
  if (typeof accessToken !== "string" || !accessToken) throw new ProviderError("accessToken is required", { code: "INVALID_ARGUMENT" });
  return Object.freeze({
    async sendTemplate({ recipient, templateId, templateData, trackingId } = {}) {
      const hasPhone = typeof recipient?.phone === "string" && recipient.phone.length > 0;
      const hasUserId = typeof recipient?.userId === "string" && recipient.userId.length > 0;
      if (hasPhone === hasUserId) throw new ProviderError("Exactly one phone or userId recipient is required", { code: "INVALID_ARGUMENT" });
      if (typeof templateId !== "string" || !templateId || !templateData || typeof templateData !== "object" || Array.isArray(templateData)) throw new ProviderError("Approved template and templateData are required", { code: "INVALID_ARGUMENT" });
      const body = hasPhone ? { phone: recipient.phone, template_id: templateId, template_data: templateData } : { user_id: recipient.userId, template_id: templateId, template_data: templateData };
      if (trackingId !== undefined) body.tracking_id = trackingId;
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try { response = await fetchFn(hasPhone ? PHONE_ENDPOINT : UID_ENDPOINT, { method: "POST", headers: { access_token: accessToken, "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal }); }
      catch (cause) { throw new ProviderError("ZBS request failed", { code: cause?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR", retryable: true, cause }); }
      finally { clearTimeout(timer); }
      let payload = {}; try { payload = await response.json(); } catch {}
      if (!response.ok || (payload.error !== undefined && payload.error !== 0)) throw new ProviderError("ZBS rejected the request", { code: "PROVIDER_REJECTED", retryable: response.status >= 500, status: response.status, cause: payload });
      return payload;
    },
  });
}

export { UID_ENDPOINT, PHONE_ENDPOINT };
