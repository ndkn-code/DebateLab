# Debate Session Annotation Plan

## Goal

Make annotations work for full debate sessions, not just one speech. The review should show what happened in each speech, how claims interacted across the round, and what both the user and AI/opponent did well or poorly.

The important product shift is from "annotated transcript" to "annotated debate flow":

- each speech gets local transcript annotations
- related claims across speeches are linked
- AI/opponent speeches are annotated too
- user-facing coaching turns opponent annotations into attack/copy opportunities

## Current Fit

The current code already has the right place to start:

- `debate_duel_speeches` stores each speech with `round_number`, `speech_type`, `side`, `transcript`, and `duration_seconds`
- `debate_duel_judgments.verdict` stores the full AI judgment JSON
- `DebateDuelJudgment` already contains comparative ballot, participant feedback, and round breakdown

For version 1, no Supabase migration is needed. Add the richer annotation payload inside the existing `verdict` JSON.

## Annotation Model

Add optional fields to `DebateDuelJudgment`:

```ts
interface DebateDuelSpeechAnnotation {
  id: string;
  speechId: string;
  roundNumber: number;
  speechType: "opening" | "rebuttal" | "closing";
  speakerType: "user" | "ai" | "opponent";
  side: "proposition" | "opposition";
  quote: string;
  tag:
    | "stance"
    | "structure"
    | "logic"
    | "mechanism"
    | "evidence"
    | "impact"
    | "rebuttal"
    | "clash"
    | "weighing"
    | "delivery";
  severity: "strength" | "improvement" | "warning";
  feedback: string;
  suggestion: string;
  linkedAnnotationIds?: string[];
}

interface DebateClashLink {
  id: string;
  userAnnotationId?: string;
  opponentAnnotationId?: string;
  sourceSpeechId: string;
  targetSpeechId: string;
  clashType: "answered" | "dropped" | "misanswered" | "turn" | "weighed";
  summary: string;
  nextMove: string;
}

interface DebateDuelJudgment {
  speechAnnotations?: DebateDuelSpeechAnnotation[];
  clashLinks?: DebateClashLink[];
}
```

## What Gets Annotated

### User Speeches

Annotate for coaching:

- whether the stance is immediate and stable
- whether each argument has claim, mechanism, evidence, and impact
- whether rebuttal directly answers the other side
- whether weighing compares worlds, magnitude, probability, reversibility, or affected groups
- whether delivery issues reduce credibility

### AI/Opponent Speeches

Annotate them too, but with a different user-facing purpose:

- `AI claim to answer`: what threat the AI/opponent introduced
- `Weak spot`: where the opponent claim lacks mechanism or evidence
- `Move to copy`: a strong framing, weighing move, or structure the user can learn from
- `Dropped by you`: opponent material the user failed to answer later

This keeps AI annotations useful instead of feeling like we are coaching the AI.

## UI Structure

Use the generated sketch:

`C:\DebateLab\design-artifacts\debate-multi-speech-annotation-sketch.png`

### Shell

- Left sidebar: session metadata plus `Overall`, `Transcript`, and eventually `Clash Map`
- Top timeline: speech chips in debate order
- Main workspace:
  - left transcript pane
  - right annotation rail
  - connector lines between highlights and cards on desktop

### Timeline

Each chip should show:

- side color
- speaker label
- speech type
- annotation count
- warning count if any

Example:

- `User Opening`
- `AI Opening`
- `User Rebuttal`
- `AI Rebuttal`

For human 1v1, replace AI labels with participant display names.

### Transcript Tab

Default view should be `All speeches`, but clicking a timeline chip filters to one speech.

Controls:

- `Speaker`: You, AI/Opponent, All
- `Speech Part`: All, Opening, Rebuttal
- `View`: All annotations, Strengths, Improvements, Warnings

No search bar for now. It adds clutter and the transcript is already filterable by speech.

### Annotation Cards

Cards should follow the reference structure:

- number bubble
- tag chip
- timestamp
- quoted line
- feedback
- `Try this`
- optional relation label: `Answered`, `Dropped`, `Turned`, `Weighed`

Use the same spider-chart color mapping:

- stance, structure, clarity, logic, mechanism, weighing: blue
- rebuttal, clash: amber
- evidence, impact: green
- delivery: purple
- severe warning or unmatched quote: red

## Clash Map

This should become the real debate-specific value.

Show linked claim chains:

```text
AI Opening claim
  -> User Rebuttal response
  -> Judge result: answered / dropped / partially answered
  -> Better response
```

Card examples:

- `Dropped`: "AI argued school-wide enforcement is unfair. You never answered this."
- `Misanswered`: "You answered addiction, but the AI's point was teacher discretion."
- `Turn`: "You could flip this by arguing consistent rules are fairer than teacher-by-teacher enforcement."
- `Weighed`: "You compared classroom attention loss against convenience, which is a strong weighing move."

## Prompt Changes

Update `buildDuelJudgmentPrompt` to require:

- 2-4 annotations per speech
- at least 1 annotation on every submitted speech
- opponent/AI annotations framed as attack/copy opportunities for the user
- 3-6 `clashLinks` connecting opponent claims to later responses
- quote-linked annotations only, with exact quotes from transcripts
- no generic comments unless tied to a quote

The prompt should also ask the model to identify:

- strongest user argument
- strongest opponent/AI argument
- biggest dropped argument
- best rebuttal opportunity
- strongest weighing move

## Rendering Logic

Reuse the single-speech annotated transcript mechanics:

- quote matching
- timestamp estimation
- meaningful chunking
- compact inline highlights
- connector overlay
- unmatched quote fallback cards

Extend the derived UI model with:

- `speechId`
- `speechLabel`
- `speakerLabel`
- `side`
- `speechType`
- `absoluteRoundOrder`
- `linkedAnnotationIds`

For `All speeches`, render speeches as sections in order. For a selected speech, show one focused transcript and its annotation rail.

## Rollout

### Phase 1

- Extend `DebateDuelJudgment` types with optional `speechAnnotations` and `clashLinks`
- Update Gemini duel prompt
- Normalize and match annotations by `speechId`
- Add `Transcript` tab to duel result page
- Render timeline and per-speech transcript annotations
- Use existing `verdict` JSON, no DB migration

### Phase 2

- Add `Clash Map` tab
- Link cards across speeches
- Add "show me the missed answer" interaction
- Add coach entry points from a clash card

### Phase 3

- If analytics needs annotation-level querying, add a normalized table later.
- Only then create a Supabase migration for queryable annotations.

## QA

- Completed AI practice session with AI speech annotations
- Completed human 1v1 duel with both sides annotated
- Missing/short speech still renders and gets a warning card
- Unmatched quotes do not break the rail
- All-speeches view does not create giant empty space
- Single speech filter keeps connectors clean
- Mobile hides connector lines and keeps tap linking
- Existing old duel judgments without annotations still render the current result page

