# DebateLab

A solo debate practice web app for Vietnamese high school students. Pick a topic, prepare your arguments, speak into your microphone in English, and receive AI-powered feedback scored across 4 categories.

## Features

- **33 debate topics** across 6 categories (Education, Technology, Society, Environment, Ethics, Vietnam-Specific)
- **Timed practice sessions** with configurable prep time (1-3 min) and speech time (2-4 min)
- **Real-time speech recognition** using the Web Speech API with live transcript display
- **AI-powered feedback** via Google Gemini 2.5 Flash with detailed scoring rubric (Content, Structure, Language, Persuasion)
- **Session history** with stats, filters, search, and session review
- **Audio recording** and visualization during speaking
- **Dark theme** with smooth animations

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand
- **Animations:** Framer Motion
- **AI:** Google Gemini 2.5 Flash (structured JSON output)
- **APIs:** Web Speech API, MediaRecorder API, Web Audio API
- **Storage:** localStorage (up to 50 sessions)

## Getting Started

### Prerequisites

- Node.js 18+
- A Google AI Studio API key ([get one here](https://aistudio.google.com/apikey))

### Setup

```bash
# Install dependencies
npm install

# Copy environment file and add your Gemini API key
cp .env.example .env.local
# Edit .env.local and set GEMINI_API_KEY=your_key_here

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in **Google Chrome** (required for speech recognition).

### Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/analyze/          # Gemini API endpoint
    history/              # History & session review pages
    practice/             # Topic selection, session, feedback pages
  components/
    feedback/             # Score hero, category cards, feedback sections
    landing/              # Navbar, hero, features, footer
    practice/             # Timer, phases, visualizer, config
    shared/               # Toast, confirm dialog, score ring
    ui/                   # shadcn/ui primitives
  hooks/                  # useCountdown, useSpeechRecognition, useAudioRecorder
  lib/                    # Topics data, Gemini client, prompts, storage, utils
  store/                  # Zustand stores
  types/                  # TypeScript type definitions
```

## Browser Support

Speech recognition requires **Google Chrome** or Chromium-based browsers. Other browsers will show a compatibility warning.

## Scoring Rubric

| Category | Max Score | Sub-categories |
|----------|-----------|----------------|
| Content & Argumentation | 40 | Claim Clarity, Evidence, Logic, Counter-Arguments |
| Structure & Organization | 25 | Introduction, Body, Conclusion |
| Language & Delivery | 25 | Vocabulary, Grammar, Fluency |
| Persuasiveness | 10 | Audience Awareness, Impactfulness |

Band descriptors: Expert (85-100), Proficient (70-84), Competent (50-69), Developing (30-49), Novice (0-29)
