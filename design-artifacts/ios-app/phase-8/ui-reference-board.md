# Phase 8 UI Reference Board

## Generated Boards

### Coach Chat Reference

Path: `ui-reference/coach-chat-reference.png`

Prompt summary: native iOS AI coach chat for Thinkfy with personalized coach context, streak/level/focus stats, starter prompts, saved conversations, active thread, composer, sending state, and retry state. Visual direction: Thinkfy calm blue, Duolingo-style motivation, Brilliant-style learning clarity.

Implementation takeaways:

- Keep the top context area small and immediately useful.
- Pair motivational progress signals with precise coaching focus.
- The composer and retry path must stay obvious and reachable.

### Coach History Reference

Path: `ui-reference/coach-history-reference.png`

Prompt summary: conversation history, old-thread reopening, recent-session context, empty/loading/no-access states, and saved thread previews for the mobile coach.

Implementation takeaways:

- Saved conversations should be scannable before opening.
- Security/no-access states should be calm, clear, and non-alarming.
- Recent practice context should be present without turning the screen into a dashboard clone.

### Structured Cards Reference

Path: `ui-reference/coach-structured-cards-reference.png`

Prompt summary: assistant responses with coach tips, common mistakes, examples, drills, next steps, suggested actions, retry states, and keyboard-safe composer layout.

Implementation takeaways:

- Assistant metadata should render as compact, reusable cards inside the thread.
- Suggested actions should be tappable prompts, not passive labels.
- Structured cards must wrap cleanly on smaller phones and avoid nested decorative frames.

## Design Debt

The current mobile UI remains more functional than aspirational compared with these boards. The larger visual revamp should be tracked as a separate epic after Phase 8 so this phase stays focused on the live Coach contract and feedback loop continuity.
