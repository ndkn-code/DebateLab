# Google provider adapter

`createGoogleProvider({ accessToken, fetchFn, timeoutMs })` is a small injectable REST
client for Calendar, Sheets, and Drive. Every resource identifier and range is encoded,
and requests are limited to Google API origins. The adapter performs no retries; callers
must decide how to replay a safe operation. Errors are `GoogleApiError` instances with
`status`, `retryable`, `requiresReconnect`, `syncReset`, and `conflict` flags. A 401
requires reconnect, 410 invalidates a sync token, and 412 signals an ETag conflict.

Calendar event creation accepts an idempotency key and derives a stable Google-compatible
event id. Attendee notifications are controlled by `sendUpdates`, which defaults to
`none` for create and update. `freeBusy` sends only the requested time range and calendar
ids; it does not fetch event or attendee details.

Sheets reads use `UNFORMATTED_VALUE`. Writes use `RAW`, so values such as `=SUM(A1:A2)`
are stored as literal input rather than interpreted as formulas. Drive file access is
limited to explicitly supplied file ids; this adapter does not infer folder or recursive
access.

OAuth helpers build an authorization URL with offline access and PKCE S256, and expose
injected-fetch code exchange and refresh calls. Consent scope checks and token storage
belong to the parent orchestration layer.
