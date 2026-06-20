import assert from "node:assert/strict";
import { loadZaloPayConfig } from "./config";

const sandbox = loadZaloPayConfig({
  ZALOPAY_APP_ID: "75326",
  ZALOPAY_KEY1: "k1",
  ZALOPAY_KEY2: "k2",
  ZALOPAY_CALLBACK_URL: "https://app/cb",
});
assert.equal(sandbox.appId, "75326");
assert.equal(sandbox.key1, "k1");
assert.equal(sandbox.key2, "k2");
assert.equal(sandbox.callbackUrl, "https://app/cb");
assert.equal(sandbox.createEndpoint, "https://sb-openapi.zalopay.vn/v2/create");

const prod = loadZaloPayConfig({ ZALOPAY_ENV: "production" });
assert.equal(prod.createEndpoint, "https://openapi.zalopay.vn/v2/create");
assert.equal(prod.appId, ""); // missing -> empty default

console.log("payments/zalopay/config tests passed");
