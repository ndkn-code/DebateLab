# Aikido domain triage — thinkfy.net — 2026-09-02

Scope: all seven open findings returned by the authenticated Aikido domain feed for
`https://thinkfy.net` on 2026-09-02. This ledger records individual verdicts and does
not authorize a blanket suppression. Production deployment and the post-deployment
domain scan remain separate, manually authorized operations.

`Remediation revision` identifies the reviewed code commit. `Post-deployment status`
must remain pending until the revision is deployed and Aikido has scanned the live
domain again.

## Open domain findings

| Aikido ID | Severity | Finding | Verdict | Evidence / remediation | Remediation revision | Post-deployment status |
|---|---|---|---|---|---|---|
| 618475949 | High | CSP permits inline JavaScript | Confirmed | Replace production `script-src 'unsafe-inline'` with a fresh per-request nonce, forward the same CSP to Next.js, nonce intentional inline scripts, and return the identical policy on the response. | `dc43d982` | Pending deployment and rescan |
| 618475942 | High | Cookie can be sent over an unencrypted connection | Confirmed hardening | Apply `Secure` in production to the locale, preference, and Supabase session-cookie paths while preserving local loopback HTTP development. Retain `SameSite=Lax` and `Path=/`. | `5edb32cd` | Pending deployment and rescan |
| 618475957 | High | CSP permits `eval()` | Confirmed | Remove production `'unsafe-eval'`; retain it only for development. Replace the expression-driven confetti animation with deterministic keyframes and verify all shipped Lottie JSON is expression-free. | `dc43d982` | Pending deployment and rescan |
| 618475939 | High | Cookie lacks `HttpOnly` | Accepted architecture boundary | Supabase's browser/SSR session model requires the browser client to read and refresh its session cookies. Protected operations establish identity with `getUser()` rather than trusting cookie contents. Locale, theme, timezone, and consent values are non-secret preferences. A server-only BFF redesign is outside this finding and is not required for safe use of the supported model. | `5edb32cd` | Review individually after deployment; do not suppress before rescan |
| 618475946 | Medium | CSP is insufficiently restrictive | Confirmed | Split script and style element/attribute directives, add `script-src-attr 'none'`, use script and style-element nonces, add `'strict-dynamic'` and `upgrade-insecure-requests`, and retain only required compatibility destinations. | `dc43d982` | Pending deployment and rescan |
| 618475960 | Medium | `X-Powered-By` exposes framework information | Confirmed | Disable Next.js's powered-by response header. | `dc43d982` | Pending deployment and rescan |
| 618475953 | Low | CSP permits inline CSS | Accepted rendering boundary | React uses narrowly scoped element `style` attributes for dynamic visual properties. Keep only `style-src-attr 'unsafe-inline'`; nonce intentional inline `<style>` elements, including Mermaid's client-rendered SVG stylesheet. Sonner's immutable runtime stylesheet is allowed by its exact SHA-256 hash. Do not allow general inline scripts or style elements. | `dc43d982` | Review individually after deployment; do not suppress before rescan |

## Scanner checks shown in the supplied screenshot

These rows are checks in Aikido's domain test catalog, not open findings in the
current seven-item feed. They are recorded so a future reviewer can distinguish a
passing check from an ignored vulnerability.

| Check | 2026-09-02 live evidence | Disposition |
|---|---|---|
| JWT authorization token has weak secret | The production Supabase JWKS publishes an asymmetric P-256 key for ES256. Forged unsigned and weak-secret HS256 tokens each received `401` from the protected mobile dashboard endpoint. | Passing live evidence; re-test after deployment |
| Server accepts invalid JWT tokens | A token carrying a corrupted ES256 signature received `401` from the protected mobile dashboard endpoint. | Passing live evidence; re-test after deployment |
| Heartbleed OpenSSL vulnerability | TLS terminates at Vercel. TLS 1.0 and 1.1 handshakes are rejected; TLS 1.2 and 1.3 are supported. | Hosting boundary; do not suppress the check |
| CSP header not set | The live site returns an enforcing `Content-Security-Policy` response header. | Passing live evidence; replacement policy requires post-deployment verification |
| CSP Report-Only header found | The live site does not return `Content-Security-Policy-Report-Only`. | Passing live evidence; re-test after deployment |
| HSTS missing or weak | The live site returns `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, and HTTP redirects permanently to HTTPS. | Passing live evidence; re-test after deployment |

## Acceptance record

Implementation verification completed in the isolated
`codex/aikido-domain-hardening` worktree:

- Focused CSP, Mermaid style-nonce, cookie, structured-data, and unsubscribe-route
  tests passed. The web typecheck, design-system audit/tests, critical coverage,
  changed-file lint, and final production build passed.
- Production-server smoke tests covered English and Vietnamese HTML, raw unsubscribe
  HTML, and an authenticated API rejection. Every response carried a fresh nonce and
  the enforcing CSP; inline scripts and intentional style elements carried the
  matching nonce. HSTS remained present, while CSP Report-Only and `X-Powered-By`
  were absent. The production locale cookie included `Secure`, `SameSite=Lax`, and
  `Path=/`.
- Browser checks covered English and Vietnamese, light and dark themes, desktop and
  mobile widths, login, IELTS, anonymous dashboard redirection, theme bootstrapping,
  and Sonner's exact stylesheet hash. No CSP console violations, blocking overlays,
  or document overflow were observed. Repaired confetti rendered correctly at two
  animation frames in the repository's Skottie-based Lottie verification player;
  all 15 shipped Lottie files are expression-free.
- An affected-file Aikido local scan returned zero findings. An independent
  post-patch security review returned no High or Critical findings; its Mermaid
  stylesheet compatibility observation was remediated and covered by a focused
  regression test before this record was finalized.
- `npm test` passed 77 of 78 suites. The sole `matching_headings` fixture validation
  failure in `apps/web/src/lib/ielts/adaptive/evidence.test.ts` reproduces on the
  baseline and is unrelated to this patch. The full lint command likewise reports
  pre-existing errors in untouched IELTS and legacy files; every changed TypeScript
  file passes ESLint.
- A final authenticated Aikido feed read still returns the same seven live-domain
  findings, as expected before deployment. No finding was ignored or closed during
  implementation.

Production deployment and post-deployment Aikido disposition remain pending manual
authorization. This ledger does not authorize either operation.
