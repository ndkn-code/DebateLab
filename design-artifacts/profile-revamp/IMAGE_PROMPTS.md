# Profile Revamp — Achievement Badge Prompts

Eight shield badges, one per system achievement. Export each as **1024×1024 WebP**
(transparent background) and drop at the exact path below. The UI auto-upgrades:
while a file is missing the app shows the legacy emoji medallion; the moment the
`.webp` lands, the shield artwork appears everywhere (header chips, trophy grid,
dialogs) — locked achievements are desaturated automatically in CSS, so generate
the **unlocked/full-color** version only.

## Style anchor — IMPORTANT

Attach one of the existing league shields as a style reference image in ChatGPT
(e.g. `apps/web/public/leaderboards/leagues/constructive.webp`) and say:

> Match this exact badge style: soft 3D shield with a thick rounded rim, two small
> rivets at the top corners, a glossy glass face with a subtle diagonal highlight,
> one bold centered symbol, gentle drop shadow under the shield. Smooth toy-like
> 3D render, no text, no letters, transparent background, subject fills ~80% of a
> square 1024×1024 canvas. Must read clearly at 48 px.

These render at 48–112 px, so each inner symbol must be one bold shape.

## Badges → `apps/web/public/images/achievements/`

| # | File | Rim / face color | Inner symbol prompt (append to style anchor) |
|---|------|------------------|----------------------------------------------|
| 1 | `newcomer.webp` | Fresh green rim, pale mint face | A small cheerful sprout with two rounded leaves growing from a cracked egg shell. |
| 2 | `speed_demon.webp` | Golden yellow rim, warm cream face | A bold lightning bolt tilted slightly right with two small speed streaks behind it. |
| 3 | `weekly_warrior.webp` | Orange rim, soft peach face | A calendar page with a small flame burning at its top right corner. |
| 4 | `near_perfect.webp` | Cyan rim, ice-blue face | A brilliant-cut diamond gem with a tiny four-point sparkle at its upper right. |
| 5 | `constructive_climber.webp` | Sky blue rim, pale blue face | A stylized mountain peak with a small victory flag planted on the summit. |
| 6 | `evidence_builder.webp` | Teal rim, pale aqua face | Three stacked books with a magnifying glass leaning against them. |
| 7 | `crossfire_ready.webp` | Violet rim, lavender face | Two crossed microphones forming an X, a small spark where they meet. |
| 8 | `rebuttal_streak.webp` | Coral red rim, blush face | A small round shield deflecting an arrow that bends away, motion arc behind it. |

## Conversion tip

If ChatGPT exports PNG: `npx sharp-cli -i input.png -o newcomer.webp --format webp -q 92`
— keep 1024×1024 and the transparent background (don't flatten to white).

PNG masters can live in `design-artifacts/profile-revamp/assets-original/`.
