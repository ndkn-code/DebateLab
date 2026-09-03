# Thinkfy security policy

## Reporting

Please report suspected vulnerabilities privately to the maintainers rather than
opening a public issue. Include the affected URL or file, reproduction steps,
impact, and a safe contact address. Do not include credentials, tokens, student
content, or other personal data in reports.

## Security boundaries

- Deployable web routes and server actions are untrusted-input boundaries. They
  authenticate the real Supabase user, enforce ownership/RLS and role checks, and
  use service-role clients only after an explicit ownership or authorization check.
- Supabase Storage object names are opaque application keys, not operating-system
  paths. They are generated from authenticated identifiers, authorized records, or
  integrity-checked manifests. Path normalization must not reinterpret valid keys.
- Operator and CI CLIs are invoked by an administrator or trusted automation. Their
  paths come from operator-controlled arguments, environment, or manifests; they have
  no HTTP or queue entrypoint and no capability beyond the invoking OS account.
- Browser-readable Supabase session and preference cookies are part of the supported
  Supabase browser/SSR session model. Protected operations verify identity with
  `getUser()`. Locale, theme, timezone, and consent cookies are preferences. A
  server-only BFF redesign is not required by this boundary.

Production deployment, database migration, and Aikido closure are manually
authorized operations. See the versioned [Aikido Medium/High triage ledger](docs/security/aikido-medium-high-triage-2026-09-03.md).
