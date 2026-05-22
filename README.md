# Thinkfy

Thinkfy is an edtech platform for Vietnamese high school students to learn debate, practice public speaking, and get AI-powered coaching. The repo is now an npm workspace monorepo with the production Next.js web app, an Expo iOS app foundation, and shared TypeScript contracts.

## Workspace Layout

```text
apps/
  web/        Next.js app, API routes, server actions, web UI
  mobile/     Expo React Native app, iOS native project
packages/
  shared/     Pure TypeScript contracts and helpers for web/mobile
supabase/     Database migrations and Supabase project assets
docs/         Repo-level docs
design-artifacts/
```

## Core Commands

Install from the repo root:

```bash
npm install
```

Web:

```bash
npm run dev:web
npm run lint:web
npm run typecheck:web
npm run build:web
```

Mobile:

```bash
npm run dev:mobile
npm run ios:mobile
npm run lint:mobile
npm run typecheck:mobile
```

Shared:

```bash
npm run typecheck:shared
```

Focused web tests are still available from the root, for example:

```bash
npm run test:topics
npm run test:practice-language
npm run test:practice-analysis
```

## Environment

Use the root `.env.example` as the source of truth.

- Web local env: copy relevant values into `apps/web/.env.local`.
- Mobile local env: copy the `EXPO_PUBLIC_*` values into `apps/mobile/.env.local`.
- Mobile env details live in [docs/mobile-env.md](docs/mobile-env.md).

Never expose server secrets through `EXPO_PUBLIC_*`.

## Web App

The web app remains the production app and includes courses, solo practice, Deepgram transcription, async AI feedback, coach chat, profile, history, settings, admin tools, email, and smart popups.

The web source moved from `src/` to `apps/web/src/`. The `@/*` alias still points at the web `src` folder inside the web workspace.

## Mobile App

The mobile app lives in `apps/mobile` and uses:

- Expo SDK 55
- Expo Router
- iOS bundle identifier `net.thinkfy.app`
- URL scheme `thinkfy`
- `@thinkfy/shared` for pure practice contracts

Phase 1 is a foundation only. Auth, dashboard, practice, audio recording, transcription, and feedback implementation happen in later phases.

## Vercel Deployment

Before the next web deploy, update the Vercel project root directory to:

```text
apps/web
```

The web `vercel.json` now lives in `apps/web/vercel.json`, so cron paths and the practice-analysis queue trigger stay relative to the web app root.

## Database

Supabase migrations remain at the repo root under `supabase/migrations`.

Utility scripts run through the web workspace:

```bash
npm run generate:tts-samples
```
