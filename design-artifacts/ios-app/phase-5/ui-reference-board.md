# Phase 5 UI Reference Board

## Generated Artifacts

- `ui-reference/practice-setup-reference.png`
- `ui-reference/mic-prep-speaking-reference.png`

## Prompts

### Practice Setup

Create a polished mobile UI reference board for the Thinkfy iOS practice setup flow. Native iOS app mockups, calm blue Thinkfy visual system, Duolingo-style motivational progress and friendly energy, Brilliant-style clarity and structured learning. Show topic selection cards, category chips, search, language selector, debate/speaking segmented control, side selector, prep and speaking time controls, and a confident start session CTA. Dense ergonomic student workflow, bright but calm, crisp typography, rounded cards no more than 8px radius, no marketing hero, no decorative orbs, no unreadable tiny text, no real brand logos, no copyrighted mascot characters.

### Mic, Prep, Speaking

Create a polished mobile UI reference board for the Thinkfy iOS mic, prep, and speaking session flow. Native iOS app mockups, calm blue Thinkfy visual system, Duolingo-style encouraging feedback, Brilliant-style clear step-by-step learning. Show microphone permission, mic check, prep timer with notes, speaking timer with waveform/mic status, pause/resume controls, background-recovery warning, and local session complete with recording saved but feedback coming later. Dense ergonomic student workflow, accessible contrast, no marketing hero, no decorative orbs, no real brand logos, no copyrighted characters, no unreadable tiny text.

## Implementation Takeaways

- Keep setup dense and scannable: chips, compact cards, and one strong start action.
- Separate mic permission, prep, speaking, and complete states so students always know where they are.
- Use encouragement and progress without implying feedback exists before Phase 7.
- Make local-only recording status explicit because Supabase upload is intentionally deferred.
