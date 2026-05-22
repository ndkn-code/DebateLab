# Thinkfy Mobile Environment

The Expo app reads only `EXPO_PUBLIC_*` values. Keep all service-role, Gemini, Deepgram, Resend, cron, and webhook secrets in the web/server environment only.

## Local Setup

Create `apps/mobile/.env.local` with:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
# Fallback for projects still using legacy anon keys.
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.your-google-ios-client-id
# Optional local-only design QA bypass. Keep unset in preview/production.
EXPO_PUBLIC_ENABLE_MOBILE_DESIGN_PREVIEW=
# Optional local-only real-session Google OAuth E2E login. Keep unset in preview/production.
EXPO_PUBLIC_ENABLE_MOBILE_E2E_LOGIN=
# Optional route for screenshot QA: today, practice, coach, courses, or profile.
EXPO_PUBLIC_MOBILE_DESIGN_PREVIEW_ROUTE=today
```

Create `apps/web/.env.local` from the root `.env.example` for the Next.js app.

## Public Keys

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key for the mobile client. Prefer this over the legacy anon key.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: fallback only for projects that have not moved to publishable keys yet.
- `EXPO_PUBLIC_API_BASE_URL`: web/API origin for mobile requests.
- `EXPO_PUBLIC_APP_ENV`: `development`, `preview`, or `production`.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Google OAuth web client ID used to request an ID token for Supabase.
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`: reversed iOS client ID URL scheme, for example `com.googleusercontent.apps.123abc`.
- `EXPO_PUBLIC_ENABLE_MOBILE_DESIGN_PREVIEW`: optional Phase 3 simulator QA flag. Set to `1` only in local development to render the signed-in design shell with mock data when live OAuth is unavailable.
- `EXPO_PUBLIC_ENABLE_MOBILE_E2E_LOGIN`: optional local simulator QA flag. Set to `1` only with `EXPO_PUBLIC_APP_ENV=development` to expose a Supabase Google OAuth E2E login that creates a real Supabase session for protected API testing without requiring the native Google iOS client to be configured.
- `EXPO_PUBLIC_MOBILE_DESIGN_PREVIEW_ROUTE`: optional local screenshot route used only with the Phase 3 preview flag. Supported values: `today`, `practice`, `coach`, `courses`, `profile`.

## Supabase Auth Dashboard

Before native QA, verify `DebateLab - Main` has Google and Apple providers configured and that redirect URL allow-list entries include:

```text
thinkfy://**
net.thinkfy.app://**
```

The Supabase dashboard rejected `exp+thinkfy://**` during Phase 2 verification, so the dev-client flow should use the saved `thinkfy://**` scheme when redirect allow-listing is needed.

The iOS app reads only public client values. Service-role, Gemini, Deepgram, Resend, cron, webhook, and provider secrets must remain in the web/server environment.

## Phase Boundaries

Phase 2 owns native mobile auth and bearer-token API requests. Phase 3 owns the full mobile navigation shell and design system.
