# DebateLab

A comprehensive edtech platform for Vietnamese high school students to learn debate, practice public speaking, and get AI-powered coaching. Features structured courses, solo debate practice with live transcription, AI feedback scoring, and a personal AI debate coach.

## Features

- **Structured Courses** — Guided learning paths with articles, videos, quizzes, and practice exercises
- **Solo Debate Practice** — 33+ topics across 6 categories with configurable prep/speech times
- **Full-Round Debates** — Multi-round debates against an AI opponent at 3 difficulty levels
- **Real-time Transcription** — Live speech-to-text via Deepgram during practice sessions
- **AI-Powered Feedback** — Detailed scoring across Content, Structure, Language, and Persuasion
- **AI Debate Coach** — Chat assistant for tips, explanations, argument brainstorming, and practice
- **XP & Level System** — Earn XP from lessons, debates, and quizzes to track your progress
- **Streak Tracking** — Daily streak counter to build consistent practice habits
- **Session History** — Review past debates with scores, filters, and detailed feedback
- **User Accounts** — Email/password and Google OAuth authentication via Supabase

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack) with TypeScript
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Styling:** Tailwind CSS v4 + shadcn/ui (Material Design 3 theme)
- **State:** Zustand
- **Animations:** Framer Motion
- **AI:** Google Gemini 2.5 Flash (analysis, chat, rebuttals)
- **Speech:** Deepgram SDK (real-time transcription)
- **Charts:** Recharts
- **Markdown:** react-markdown + remark-gfm

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key
- A [Deepgram](https://deepgram.com) API key (for speech transcription)

### Environment Variables

Create `.env.local` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash        # optional, defaults to gemini-2.5-flash

# Deepgram
DEEPGRAM_API_KEY=your-deepgram-api-key
```

### Database Setup

1. Create a new Supabase project
2. Run the database migration SQL (see `supabase/migrations/`) to create all required tables:
   - `profiles`, `courses`, `course_modules`, `lessons`, `quiz_questions`
   - `enrollments`, `lesson_progress`, `debate_sessions`
   - `activity_logs`, `daily_stats`
   - `chat_conversations`, `chat_messages`
3. Seed the course data:

```bash
npx tsx src/lib/seed/run-seed.ts
```

### Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
  app/
    (protected)/              # Auth-required routes (dashboard, courses, etc.)
      chat/                   # AI Coach chat interface
      courses/                # Course listing, detail, lesson pages
      dashboard/              # Main dashboard with stats & activity
      history/                # Debate session history & review
      practice/               # Topic selection, session, feedback
      settings/               # User profile & preferences
    api/
      analyze/                # Debate transcript analysis (Gemini)
      chat/                   # AI Coach streaming chat (Gemini)
      rebuttal/               # AI opponent rebuttal generation
      deepgram-token/         # Deepgram API key endpoint
    auth/                     # Login, signup, OAuth callback
  components/
    chat/                     # Chat UI (bubbles, sidebar, typing indicator)
    dashboard/                # Dashboard widgets (chart, stats, AI coach)
    feedback/                 # Score display, category cards, timeline
    onboarding/               # Welcome modal for new users
    settings/                 # Settings form components
    shared/                   # Sidebar, toast, confirm dialog, score ring
    ui/                       # shadcn/ui primitives
  hooks/                      # useCountdown, useSpeechRecognition, useUser
  lib/
    api/                      # Server-side data fetching (dashboard, courses, chat)
    seed/                     # Course seed data & seed script
    supabase/                 # Supabase client helpers (browser, server, middleware)
  store/                      # Zustand stores
  types/                      # TypeScript type definitions
```

## Scoring Rubric

| Category | Max Score | Sub-categories |
|----------|-----------|----------------|
| Content & Argumentation | 40 | Claim Clarity, Evidence, Logic, Counter-Arguments |
| Structure & Organization | 25 | Introduction, Body, Conclusion |
| Language & Delivery | 25 | Vocabulary, Grammar, Fluency |
| Persuasiveness | 10 | Audience Awareness, Impactfulness |

Band descriptors: Expert (85-100), Proficient (70-84), Competent (50-69), Developing (30-49), Novice (0-29)

## XP System

| Activity | XP Earned |
|----------|-----------|
| Complete a debate session | 25 XP |
| Full-round debate bonus | +10 XP |
| Complete a lesson | 10-25 XP |
| Quiz perfect score bonus | +10 XP |
| 7-day streak milestone | +50 XP |

Level formula: `level = floor(xp / 500) + 1`

## Browser Support

Speech transcription uses Deepgram's streaming API and works in all modern browsers. Google Chrome recommended for best experience.
