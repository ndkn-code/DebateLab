# Supabase Live Audit

Verified: 2026-05-21
Project: `DebateLab - Main`
Project ref: `rsbnryympenjyzhhchhu`
Region: `ap-southeast-1`
Status: `ACTIVE_HEALTHY`
Database: Postgres `17.6.1.084`, engine `17`, GA release channel

This file separates live Supabase facts from repo-local migration assumptions. No schema or data mutations were performed.

## Authentication Status

Supabase MCP access succeeded. Computer-assisted reauth was not required for Phase 0.

## Live Project Verification

Verified through Supabase MCP:

- Project exists and is healthy.
- Public student tables needed for the iOS app are present.
- RLS is enabled on the checked public tables.
- Storage buckets are readable through MCP and include the expected practice audio bucket.
- Edge Functions list is empty.

## Public Tables Checked

| Table | Live Rows | RLS | iOS Relevance |
| --- | ---: | --- | --- |
| `profiles` | 22 | enabled | profile, settings, dashboard identity |
| `courses` | 5 | enabled | course library |
| `course_modules` | 46 | enabled | course detail/module progress |
| `lessons` | 51 | enabled | lesson player |
| `quiz_questions` | 7 | enabled | quiz activity |
| `enrollments` | 3 | enabled | course progress |
| `lesson_progress` | 0 | enabled | lesson completion/XP |
| `practice_topics` | 33 | enabled | topic picker |
| `practice_topic_translations` | 66 | enabled | multilingual practice |
| `practice_topic_category_translations` | 12 | enabled | topic category labels |
| `practice_attempts` | 0 | enabled | feedback/history source |
| `analysis_jobs` | 0 | enabled | async feedback polling |
| `chat_conversations` | 10 | enabled | coach chat history |
| `chat_messages` | 54 | enabled | coach chat messages |
| `debate_sessions` | 33 | enabled | legacy/history compatibility |

Notes:

- A `coach_profiles` table was not found in the checked table set. Coach profile behavior appears to be computed through `src/lib/api/coach-profile.ts` and related user data rather than a single live table by that name.
- Row counts are point-in-time verification values from 2026-05-21 and may change as users test the product.

## Storage Buckets Checked

| Bucket | Public | File Limit | Allowed MIME Types | iOS Relevance |
| --- | --- | ---: | --- | --- |
| `club-logos` | true | 2 MB | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | web/admin clubs, not core iOS |
| `practice-audio` | false | 25 MB | `audio/webm`, `audio/webm;codecs=opus` | prototype blocker for native recording |
| `tts-voice-samples` | true | 1 MB | `audio/mpeg`, `audio/mp3` | voice preference/preview support |

The repo constant `PRACTICE_AUDIO_BUCKET` is `practice-audio` in `src/lib/practice-analysis/constants.ts`.

The local migration `supabase/migrations/20260520180100_practice_analysis_pipeline.sql` creates `practice-audio` as private, limits files to 25 MB, and restricts objects to user-owned paths where the first folder segment is `auth.uid()`.

## Migrations

Recent live migrations include:

- `duolingo_smart_popup_notifications`
- `practice_analysis_pipeline`

The migration history also includes profiles RLS fixes, admin panel work, orbs/referrals, duels, club OS, email, Vietnamese language support, unified topics, and feedback surveys.

## Edge Functions

Live Edge Functions: none.

This means the current app's server behavior is primarily Next.js API routes/server actions plus Supabase database/storage, not Supabase Edge Functions.

## Auth And RLS Notes

- Checked student tables have RLS enabled.
- Practice attempts and analysis jobs are user-owned.
- Practice audio storage policy is user-owned by path convention.
- Mobile auth work should preserve RLS expectations by using the authenticated Supabase user ID from a bearer-token session.
- Any service-role/admin-client use in Next APIs must continue to enforce the user boundary before reading or writing user-specific records.

## Live Facts Vs Local Assumptions

Verified live:

- `DebateLab - Main` project health and database version.
- Public table presence/RLS for the major student areas.
- Storage bucket names, public flags, limits, and MIME allowlists.
- Empty Edge Functions list.

Repo-local assumptions that still need implementation validation:

- Expo recording output format and MIME type.
- iOS deep-link redirect URLs for Supabase auth.
- Whether all protected routes can use one shared bearer/cookie auth helper without breaking web sessions.
- Whether React Native can support the current chat and Deepgram streaming behavior without fallbacks.

## Phase 1-5 Implications

- Phase 2 must add a mobile auth path that still maps to Supabase `auth.uid()` for RLS.
- Phase 5/6 must update the storage/audio plan if Expo cannot produce accepted WebM/Opus files.
- Phase 7 can reuse `practice_attempts` and `analysis_jobs` if mobile submits the same normalized practice analysis input.
- Phase 8 can reuse `chat_conversations` and `chat_messages` if the API auth and streaming/fallback contract works on React Native.
