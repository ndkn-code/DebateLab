# Duel illustrations

`DuelIllustration` (`src/components/debates/duel-illustration.tsx`) loads
`/images/duel/<name>.webp` and renders a labelled placeholder until the file
exists. Two variants (`_v1` / `_v2`) were generated per concept; prompts in
`docs/duel-mode-revamp-plan.md` §13.

Wired in code:

- `thinkfy_duel_hero_v1` — duel hub hero band
- `thinkfy_duel_hero_v2` — hub "Challenge a Friend" card
- `thinkfy_duel_matchmaking_v1` — hub "Quick Match" card + matchmaking searching state
- `thinkfy_duel_ai_opponent_v1` — duel room "AI is judging" state
- `thinkfy_duel_victory_v1` — won-by-forfeit result
- `thinkfy_duel_rematch_v1` — cancelled / honourable-effort result
- `thinkfy_duel_matchmaking_v2` — duel lobby "opponent matched" header

`_v2` of ai_opponent / victory / rematch are spare variants ready to swap by
changing the `name` prop.
