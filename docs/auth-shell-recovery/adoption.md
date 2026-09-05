# Auth and shell recovery

Surface: workbench. Primary action: retry the intended page after access verification or essential shell data becomes available. Secondary action: return to the localized public home. No automatic retry, countdown, or unsupported success claim.

## Sources and deliberate adaptation

Local Lumist checkout `73875b1267cb3a6e36a82af2cd1469285a57e9e1`:

- `lib/supabase/middleware.ts:356-405`: route-class filtering. Partially forked into Thinkfy's explicit public path policy; protected IELTS descendants remain protected, handlers keep authoritative access checks, and bearer/service authentication is not replaced by cookie authentication.
- `lib/supabase/middleware.ts:438-485`: preserve refreshed response cookies and private caching. Thinkfy retains its own cookie options, nonce/CSP, locale response and single-derived POST request.
- `lib/supabase/utils.ts:141-180`: bounded authoritative `getUser` and separate invalid identity versus dependency error. Adapted as `verifyIdentity`; no Lumist role defaults, raw-session trust or cross-user cache.
- `app/error.tsx:13-35`: partial structural fork of semantic main/section, localized heading/explanation and manual retry. Thinkfy replaces the skin with PageContainer, Button and semantic type/color roles. It does not copy the automatic error-reporting claim.
- `features/class-workspace/hooks/useClassWorkspaceRoster.ts:68-112`: essential data and optional statistics have separate outcomes. The shell loads capability-only navigation, never the complete review queue or notification count. Unknown review counts are `null`.

Mobbin visual research inspected the actual returned images:

- [Mercor error screen](https://mobbin.com/screens/0cb8a748-4514-4f27-b102-194649e40112): sparse heading, one explanatory line, primary/secondary action row. This is the chosen composition precedent.
- [Aboard error screen](https://mobbin.com/screens/3f5f6e3a-a213-4290-b700-4d6ee8988e92): compared its centered illustration/error cluster; omitted its illustration because it adds no access decision.

## Composition specification

Reference image: 768 × 523, including Mobbin's attribution strip; a real web error surface shown inside that capture. Copy the hierarchy and omissions, not capture chrome or branding.

One content column. Thinkfy `PageContainer focused` supplies max-width 768 CSS px, 16/24/32 px responsive gutters. Vertically center the compact section; use left alignment for longer Vietnamese explanations. Four spacing steps: 8, 12, 16, 24. Heading `type-heading-lg` (24px); explanation `type-body-sm` (14px); native Button `lg` (36px). Controls wrap as a row at narrow widths, with 12px gap. Existing `rounded-control` resolves to 12px. No new palette, radii or typography tokens.

Canvas: background; heading: on-surface; explanatory text: on-surface-variant. Primary accent appears only on retry. Secondary return uses outline. No nested cards, decorative icon tiles, navigation, metrics or loading skeleton on recovery. The explanation distinguishes unverified access from an expired login; a definite missing/invalid identity retains the login path, and destination-specific denied states remain owned by existing teacher/IELTS guards.

## Additional blocking dependency found during QA

`[locale]/localized-app-providers.tsx` previously called `getUser` and queried theme preferences before every page, including recovery. The synthetic hanging-auth test exposed a 61-second recovery render. It now uses an existing theme cookie immediately, skips remote theme restoration entirely on public/recovery routes, and budgets optional protected-page restoration at 200ms. Preferences remain saved through the existing theme action. With no theme cookie and a slow provider, the current page uses the light fallback; a subsequent page may restore the account preference.
