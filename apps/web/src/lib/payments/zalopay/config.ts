/**
 * ZaloPay config (WS-4.1) — env-driven, pure given an env map for testability.
 * key1 signs outbound create-order; key2 verifies inbound callbacks.
 */

export interface ZaloPayConfig {
  appId: string;
  key1: string;
  key2: string;
  createEndpoint: string;
  callbackUrl: string;
}

const ENDPOINTS = {
  sandbox: "https://sb-openapi.zalopay.vn/v2/create",
  production: "https://openapi.zalopay.vn/v2/create",
} as const;

export function loadZaloPayConfig(
  env: Record<string, string | undefined> = process.env,
): ZaloPayConfig {
  const mode = env.ZALOPAY_ENV === "production" ? "production" : "sandbox";
  return {
    appId: env.ZALOPAY_APP_ID ?? "",
    key1: env.ZALOPAY_KEY1 ?? "",
    key2: env.ZALOPAY_KEY2 ?? "",
    createEndpoint: ENDPOINTS[mode],
    callbackUrl: env.ZALOPAY_CALLBACK_URL ?? "",
  };
}
