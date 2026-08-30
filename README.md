# Thinkfy

Thinkfy is an edtech platform for Vietnamese high school students to learn debate, practice public speaking, and get AI-powered coaching. This repository contains the production Next.js web app, its backend APIs, shared TypeScript contracts, and Supabase assets.

## Workspace Layout

```text
apps/
  web/        Next.js app, API routes, server actions, web UI
packages/
  shared/     Pure TypeScript contracts shared with API consumers
supabase/     Database migrations and Supabase project assets
docs/         Repo-level docs
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

## Web App

The web app remains the production app and includes courses, solo practice, Deepgram transcription, async AI feedback, coach chat, profile, history, settings, admin tools, email, and smart popups.

The web source moved from `src/` to `apps/web/src/`. The `@/*` alias still points at the web `src` folder inside the web workspace.

## Mobile App

The Expo/iOS app is maintained in the standalone local project at
`/Users/jacknguyen/Developer/DebateLab-mobile`. This repository retains the
`/api/mobile/*` backend endpoints and the shared request/response contracts the
app consumes.

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
