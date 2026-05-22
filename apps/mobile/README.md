# Thinkfy iOS

Expo SDK 55 mobile foundation for the Thinkfy student app.

## Commands

Run from the repo root:

```bash
npm run dev:mobile
npm run ios:mobile
npm run lint:mobile
npm run typecheck:mobile
```

## Environment

Create `apps/mobile/.env.local` with the public values documented in [../../docs/mobile-env.md](../../docs/mobile-env.md).

For local visual QA only, set `EXPO_PUBLIC_ENABLE_MOBILE_DESIGN_PREVIEW=1` with `EXPO_PUBLIC_APP_ENV=development` to render the signed-in native-tab shell without live OAuth.

## Phase Boundary

Phase 3 adds the native Liquid Glass tab shell, React Native design primitives, static first-pass student surfaces, and the profile API smoke diagnostic. Dashboard APIs, practice audio, transcription, coach streaming, course data, notifications, and feedback implementation remain later phases.
