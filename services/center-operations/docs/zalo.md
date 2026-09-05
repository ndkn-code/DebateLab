# Zalo provider adapters

`zalopay.mjs` isolates ZaloPay tuition checkout and refund calls. It uses fixed sandbox (`https://sb-openapi.zalopay.vn`) and production (`https://openapi.zalopay.vn`) origins, HMAC-SHA256 signing, timing-safe callback verification, integer VND validation, and bounded requests with structured retryable errors. It never retries mutations.

`zbs.mjs` sends only approved ZBS templates and requires a previously established eligibility decision. UID sends use `https://openapi.zalo.me/v3.0/oa/message/template`; phone sends use `https://business.openapi.zalo.me/message/template`. These endpoints and payloads follow the current Zalo Platform documentation: [UID API](https://docs.zaloplatforms.com/docs/ZBS/gui-tin-template-qua-uid/api-gui-tin-qua-uid) and [phone API](https://docs.zaloplatforms.com/docs/ZBS/gui-tin-template-qua-sdt/api-gui-tin-qua-sdt/api-gui-tin).

Adapters do not grant tuition, deduplicate callbacks, or establish tenant/order/amount ownership. The parent ledger must perform those checks before applying a verified callback.
