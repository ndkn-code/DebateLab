# Phase 2 Supabase Live Verification

Date: 2026-05-21

Project verified through the Supabase connector:

- Project: `DebateLab - Main`
- Project ref: `rsbnryympenjyzhhchhu`
- API URL: `https://rsbnryympenjyzhhchhu.supabase.co`
- Active public keys observed: one legacy anon key and one modern publishable key.
- Dashboard verification was also completed with Computer Use against the live `DebateLab - Main` project.

## Verified Database Surface

The live public schema includes the expected student resources for Phase 2 bearer-token API work:

- Profiles: `profiles`
- Practice and analysis: `practice_attempts`, `analysis_jobs`, `practice_session_drafts`
- Chat: `chat_conversations`, `chat_messages`, `coach_reviews`
- Courses and activities: `courses`, `course_modules`, `lessons`, `activities`, `activity_attempts`, `lesson_progress`
- Topics: `practice_topics`, `practice_topic_translations`, `practice_topic_category_translations`
- Debate duels: `debate_duels`, `debate_duel_participants`, `debate_duel_speeches`, `debate_duel_judgments`
- Streak/profile support: `daily_stats`, `user_achievements`, `user_sessions`
- Smart popups/referrals: `smart_popup_events`, `smart_popup_survey_responses`, `referrals`

RLS is enabled on the checked student tables above.

## Profile Update Check

`profiles` has own-row policies for select, insert, and update:

- `Users can view own profile`
- `Users can insert own profile`
- `Users can update own profile`

That supports the Phase 2 first-login Apple name enrichment path, assuming the signed-in user already has or can create their own profile row.

## Storage Check

The live `practice-audio` bucket exists and is private.

Current bucket constraint:

- `file_size_limit`: 26214400
- `allowed_mime_types`: `audio/webm`, `audio/webm;codecs=opus`

This remains a Phase 5/6 mobile audio blocker because iOS native recording may produce `m4a`, `caf`, or another non-`webm` format.

## Dashboard Provider Check

Observed auth identities:

- `google`: present
- `email`: present
- `apple`: no identities observed in `auth.identities`

Dashboard provider status:

- Google: enabled
- Email: enabled
- Apple: disabled

Apple provider enablement still needs Apple Services ID/client secret configuration before real-device Apple sign-in QA can pass.

## Redirect Allow-List

Dashboard URL Configuration was checked and initially had only web redirects:

- `http://localhost:3000/auth/callback`
- `https://debate-lab.vercel.app/auth/callback`
- `https://thinkfy.net/auth/callback`
- `https://www.thinkfy.net/auth/callback`
- `http://localhost:3000/**`

The following mobile redirect entries were added successfully through the Supabase dashboard:

```text
thinkfy://**
net.thinkfy.app://**
```

The dashboard validator rejected `exp+thinkfy://**` as an invalid URL, so it was not saved. Expo dev-client launch URLs still work for loading the app; mobile native auth should use the saved `thinkfy://**` app scheme when redirect allow-listing is needed.

## API Smoke

Local Next.js API smoke for `/api/mobile/auth-smoke` was run against the live project URL with a public publishable key exported into the dev process:

- No auth header: `401`
- Malformed bearer token: `401`
- Non-bearer authorization scheme: `401`

Valid bearer-token and browser-cookie success paths require an interactive signed-in user session and were not completed in this pass.

## Native Signing Check

Simulator build and launch passed earlier in Phase 2. Physical iPhone build remains blocked on local Apple signing because this Mac currently has no valid code-signing identities:

```text
0 valid identities found
```

To finish physical-device OAuth QA, add a valid Apple Development certificate/team in Xcode, then rebuild the dev client on the connected iPhone with the Phase 2 mobile public env values.

Follow-up Xcode check:

- Apple account `nguyennguyen.dymun@icloud.com` was added to Xcode.
- Xcode shows only `Do Khai Nguyen Nguyen (Personal Team)`.
- `Manage Certificates` shows no signing certificates, and the `Apple Development` certificate creation action is disabled for this team.
- Selecting the Personal Team for the Thinkfy target fails provisioning with: personal development teams do not support the Sign in with Apple capability.
- `xcrun xctrace list devices` currently shows simulators and the Mac only; no physical iPhone is visible to Xcode in this session.

Conclusion: Google-only physical-device testing may be possible with a temporary build that removes the Sign in with Apple entitlement/capability, but the Phase 2 native Apple sign-in target requires a paid Apple Developer Program team.
