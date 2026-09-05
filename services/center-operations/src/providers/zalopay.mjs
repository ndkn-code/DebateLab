import { createHmac, timingSafeEqual } from "node:crypto";

const ORIGINS = Object.freeze({
  sandbox: "https://sb-openapi.zalopay.vn",
  production: "https://openapi.zalopay.vn",
});
const VND_MAX = 10_000_000_000;

export class ProviderError extends Error {
  constructor(message, { code = "PROVIDER_ERROR", retryable = false, status, cause } = {}) {
    super(message, { cause });
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
    if (status !== undefined) this.status = status;
  }
}

const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) throw new ProviderError("Invalid timestamp", { code: "INVALID_ARGUMENT" });
  return date;
};

const requireText = (value, name) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProviderError(`${name} is required`, { code: "INVALID_ARGUMENT" });
  }
  return value;
};

const requireAmount = (value) => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > VND_MAX) {
    throw new ProviderError("amount must be a positive integer VND amount", { code: "INVALID_ARGUMENT" });
  }
  return value;
};

const mac = (secret, value) => createHmac("sha256", secret).update(value, "utf8").digest("hex");
const equalMac = (actual, expected) => {
  if (typeof actual !== "string" || !/^[\da-f]{64}$/i.test(actual)) return false;
  const a = Buffer.from(actual.toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

const appTransId = (orderId, now) => {
  requireText(orderId, "orderId");
  const d = asDate(now);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "2-digit", month: "2-digit", day: "2-digit" }).format(d).split("/").reverse().join("");
  return `${date}_${orderId}`;
};

const responseBody = async (response) => {
  try { return await response.json(); } catch { return {}; }
};

export function createZaloPayProvider({ appId, key1, key2, environment = "sandbox", callbackUrl, fetchFn = fetch, timeoutMs = 10_000 } = {}) {
  requireText(appId, "appId");
  requireText(key1, "key1");
  requireText(key2, "key2");
  requireText(callbackUrl, "callbackUrl");
  if (!(environment in ORIGINS)) throw new ProviderError("Unknown ZaloPay environment", { code: "INVALID_ARGUMENT" });
  const origin = ORIGINS[environment];

  const request = async (path, body, { method = "POST" } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchFn(`${origin}${path}`, { method, headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: controller.signal });
    } catch (cause) {
      throw new ProviderError(cause?.name === "AbortError" ? "ZaloPay request timed out" : "ZaloPay request failed", { code: cause?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR", retryable: true, cause });
    } finally { clearTimeout(timer); }
    const payload = await responseBody(response);
    if (!response.ok) throw new ProviderError("ZaloPay rejected the request", { code: "HTTP_ERROR", retryable: response.status >= 500, status: response.status, cause: payload });
    return payload;
  };

  return Object.freeze({
    async createOrder({ orderId, payerId, amount, returnUrl, description = "Thinkfy tuition", now } = {}) {
      requireText(payerId, "payerId"); requireText(returnUrl, "returnUrl"); requireAmount(amount);
      const transactionId = appTransId(orderId, now);
      const appTime = asDate(now).getTime();
      const embedData = JSON.stringify({ redirecturl: returnUrl });
      const item = JSON.stringify([{ order_id: orderId, description }]);
      const signature = mac(key1, [appId, transactionId, payerId, amount, appTime, embedData, item].join("|"));
      return request("/v2/create", { app_id: appId, app_trans_id: transactionId, app_user: payerId, app_time: appTime, amount, description, callback_url: callbackUrl, expire_duration_seconds: 900, embed_data: embedData, item, mac: signature });
    },
    verifyCallback({ data, mac: signature, type } = {}) {
      requireText(data, "data");
      if (type !== 1 && type !== "1") throw new ProviderError("Unsupported ZaloPay callback type", { code: "INVALID_CALLBACK" });
      const expected = mac(key2, data);
      if (!equalMac(signature, expected)) throw new ProviderError("Invalid ZaloPay callback signature", { code: "INVALID_SIGNATURE" });
      let payload;
      try { payload = JSON.parse(data); } catch (cause) { throw new ProviderError("Invalid ZaloPay callback data", { code: "INVALID_CALLBACK", cause }); }
      if (String(payload.app_id) !== String(appId) || typeof payload.app_trans_id !== "string" || (typeof payload.zp_trans_id !== "string" && !Number.isSafeInteger(payload.zp_trans_id))) throw new ProviderError("Unexpected ZaloPay callback shape", { code: "INVALID_CALLBACK" });
      requireAmount(payload.amount);
      return Object.freeze({ ...payload, zp_trans_id: String(payload.zp_trans_id), verified: true });
    },
    queryOrder(orderId) {
      const transactionId = requireText(orderId, "orderId");
      return request("/v2/query", { app_id: appId, app_trans_id: transactionId, mac: mac(key1, `${appId}|${transactionId}`) });
    },
    refund({ refundId, transactionId, amount, description = "Tuition refund", now } = {}) {
      requireText(refundId, "refundId"); requireText(transactionId, "transactionId"); requireAmount(amount);
      const timestamp = asDate(now).getTime();
      return request("/v2/refund", { app_id: appId, m_refund_id: refundId, zp_trans_id: transactionId, amount, description, timestamp, mac: mac(key1, [appId, refundId, transactionId, amount, description, timestamp].join("|")) });
    },
    queryRefund(refundId) {
      const id = requireText(refundId, "refundId");
      return request("/v2/query_refund", { app_id: appId, m_refund_id: id, mac: mac(key1, `${appId}|${id}`) });
    },
  });
}

export { appTransId };
