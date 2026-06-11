# Thinkfy Illustration System

A complete, consistent illustration library you can generate yourself (ChatGPT image gen /
Codex) — no designer needed. Duolingo and Brilliant don't have "nice illustrations" because
each one is pretty; they look premium because **every illustration obeys the same system**:
one character, one palette, one shape language, one shadow rule.

## How to use this file

1. Every prompt = `[STYLE BLOCK] + [asset prompt]`. Paste both into one ChatGPT message.
2. **Always attach 2 reference images** so the character stays on-model:
   `apps/web/public/brand/thinkfy/thinkfy-mascot-standing.png` and
   `apps/web/public/images/landing-v3/mascot-cheer.png`
   (master PNGs live in `design-artifacts/landing-v3/assets-original/`).
3. Ask for **transparent background PNG** for every asset except scene backdrops.
4. Save with the exact filename listed, then convert to WebP
   (`node -e` sharp snippet at the bottom) or just hand the PNGs to Claude to convert + wire.
5. Generate in tier order. Tier 1 kills the worst offenders; Tier 4 is gravy.

## THE STYLE BLOCK (paste first, every time)

```
Flat 2D vector illustration for "Thinkfy", a playful-premium edtech brand (Duolingo /
Brilliant quality bar). Main character: a cute baby water buffalo in a teal áo dài and
Vietnamese conical hat (nón lá) with an orange neckerchief — keep it EXACTLY consistent
with the attached reference: same face, proportions, outfit, colors. Chunky rounded
shapes, bold simple forms, single-tone soft shadows only, NO 3D render, NO gradients
inside characters, NO outlines around shapes, NO glow effects.
Palette only: aqua #00B8D9, deep aqua #0788A0, light aqua #8BE8F7, ink navy #102936,
slate #657B84, white, ice #F3FCFE, pale aqua #E5F8FC, gold #FFD166, warm orange #FF9F45,
coral #FF5A5F (sparingly, for "opponent"/alert meanings only).
Human characters (when needed): Vietnamese high-school students, same chunky flat style,
simple dot-and-line friendly faces, school uniforms (white shirt + red neckerchief).
```

---

## TIER 1 — Replace the ugly/off-brand assets (do these first)

These are currently free stock or weak AI-gen and clash with the brand.

| # | Asset | Save as `apps/web/public/…` | Replaces / used by |
|---|-------|------------------------------|---------------------|
| 1.1 | Orb (credits currency) | `images/rewards/credits-coin.webp` | the bread-looking coin in the dashboard top bar (`dashboard-stats-panel.tsx`) |
| 1.2 | Streak flame (small UI) | `images/rewards/streak-fire.webp` | top-bar flame chip (`dashboard-stats-panel.tsx`) |
| 1.3 | Coach pet | `coach/coach-pet.png` | placeholder coach character used in AI-coach surfaces |
| 1.4–1.8 | Smart popup set (5) | `images/smart-popups/*.webp` | current weak AI-gen popups |

**1.1 Orb (credits)**
> [STYLE BLOCK] Single isolated game-currency icon: a glossy round aqua orb (#00B8D9 with a lighter #8BE8F7 inner highlight and one white shine dot), resting feel, chunky and round like a Duolingo gem. Flat vector, crisp silhouette. Fully transparent background, PNG with alpha, square canvas, generous margin.

**1.2 Streak flame (small UI)**
> [STYLE BLOCK] Single isolated streak-flame icon: chunky warm-orange #FF9F45 flame with a gold #FFD166 inner flame, friendly rounded teardrop silhouette, tiny white shine dot. Flat vector. Fully transparent background, PNG with alpha, square canvas.
> *(You already have `images/landing-v3/icon-flame.webp` — you can simply copy it here instead of regenerating.)*

**1.3 Coach pet / AI Coach avatar**
> [STYLE BLOCK] Single isolated character: the buffalo mascot as a COACH — wearing a tiny red baseball cap backwards and a silver whistle on a cord around its neck, holding a small clipboard, friendly encouraging smile, slight lean forward like it's about to give advice. Fully transparent background, PNG with alpha, square canvas.

**1.4 Smart popup — ask coach** (`images/smart-popups/ask-coach.webp`)
> [STYLE BLOCK] Small horizontal illustration: the buffalo mascot (coach version with red cap and whistle) sitting in a chat bubble, waving, with two smaller reply bubbles floating beside it (one aqua, one ice). Composition fits a wide card (3:2). Fully transparent background, PNG with alpha.

**1.5 Smart popup — try courses** (`images/smart-popups/try-courses.webp`)
> [STYLE BLOCK] Small horizontal illustration: the buffalo mascot climbing a short staircase made of three thick books (aqua, gold, ice covers), reaching toward a gold star at the top. 3:2 composition. Fully transparent background, PNG with alpha.

**1.6 Smart popup — resume streak** (`images/smart-popups/resume-streak.webp`)
> [STYLE BLOCK] Small horizontal illustration: the buffalo mascot gently re-lighting a big friendly flame (#FF9F45 with gold core) with a match, hopeful expression, one small gray ember beside it. 3:2 composition. Fully transparent background, PNG with alpha.

**1.7 Smart popup — weakest skill** (`images/smart-popups/weakest-skill.webp`)
> [STYLE BLOCK] Small horizontal illustration: the buffalo mascot drawing back a toy bow aiming at a big aqua-and-white archery target, focused cute expression, one arrow already near the bullseye. 3:2 composition. Fully transparent background, PNG with alpha.

**1.8 Smart popup — first practice** (`images/smart-popups/first-practice.webp`)
> [STYLE BLOCK] Small horizontal illustration: the buffalo mascot stepping onto a small round stage spotlight circle, holding a microphone with both hooves, excited first-time expression, two tiny gold sparkles. 3:2 composition. Fully transparent background, PNG with alpha.

---

## TIER 2 — Dashboard Daily Focus scenes (one per drill type)

The dashboard hero (`apps/web/src/components/dashboard/daily-focus-hero.tsx`) has a
`DRILL_ILLUSTRATIONS` map — currently pointing at reused mascot poses. Generate these 7
and update the map paths (or ask Claude to). All: **square, transparent background**.

| Key | Save as `apps/web/public/images/dashboard/…` |
|-----|----------------------------------------------|
| start-debate | `focus-debate.webp` |
| start-speaking | `focus-speaking.webp` |
| weakest-skill | `focus-skill.webp` |
| continue-course | `focus-course.webp` |
| review-feedback | `focus-review.webp` |
| underused-track | `focus-balance.webp` |
| coach-check | `focus-coach.webp` |

**focus-debate**
> [STYLE BLOCK] Single isolated scene: the buffalo mascot at a small aqua debate podium facing a student opponent at a white podium, both mid-argument with one aqua and one coral speech bubble above them, energetic but friendly. Fully transparent background, PNG with alpha, square canvas.

**focus-speaking**
> [STYLE BLOCK] Single isolated scene: the buffalo mascot standing in a soft spotlight circle holding a microphone, other hoof raised mid-speech, confident open posture, two small sound-wave arcs beside the mic. Fully transparent background, PNG with alpha, square canvas.

**focus-skill**
> [STYLE BLOCK] Single isolated scene: the buffalo mascot doing target practice — drawing a toy bow at a big aqua archery target with one gold arrow in the bullseye, determined cute face. Fully transparent background, PNG with alpha, square canvas.

**focus-course**
> [STYLE BLOCK] Single isolated scene: the buffalo mascot sitting cross-legged reading a big open aqua book, one gold lightbulb floating above its head, a small stack of two more books beside it. Fully transparent background, PNG with alpha, square canvas.

**focus-review**
> [STYLE BLOCK] Single isolated scene: the buffalo mascot holding a large magnifying glass over a white report card showing simple aqua bar marks and one gold star, curious analytical expression. Fully transparent background, PNG with alpha, square canvas.

**focus-balance**
> [STYLE BLOCK] Single isolated scene: the buffalo mascot balancing on a seesaw plank over a round fulcrum, holding a microphone in one hoof and a small gavel in the other, perfectly balanced, playful. Fully transparent background, PNG with alpha, square canvas.

**focus-coach**
> [STYLE BLOCK] Single isolated scene: the coach version of the buffalo mascot (red cap, whistle) pointing at a small whiteboard with a simple aqua diagram of three connected circles, teaching pose. Fully transparent background, PNG with alpha, square canvas.

---

## TIER 3 — Mascot pose library (reused everywhere)

You already have: standing, wave, book, podium, walking, cheer, sitting. These 6 complete
the emotional range. Save to `apps/web/public/images/mascot/`. All: **square, transparent**.

**3.1 Thinking** (`mascot-thinking.webp`) — loading states, quiz screens
> [STYLE BLOCK] Single isolated character: the buffalo mascot with one hoof on its chin, eyes looking up at a small ice-colored thought bubble with three dots, pondering cutely. Fully transparent background, PNG with alpha, square canvas.

**3.2 Oops / sad** (`mascot-oops.webp`) — error states, wrong answers, lost duels
> [STYLE BLOCK] Single isolated character: the buffalo mascot looking apologetic — ears drooped, conical hat slightly tilted, holding a small broken pencil, sheepish smile. Sympathetic not tragic. Fully transparent background, PNG with alpha, square canvas.

**3.3 Sleeping** (`mascot-sleeping.webp`) — inactivity, streak-loss, empty notifications
> [STYLE BLOCK] Single isolated character: the buffalo mascot asleep sitting up, conical hat slid over its eyes, three small ice-colored "z z z" shapes floating up, peaceful. Fully transparent background, PNG with alpha, square canvas.

**3.4 Champion** (`mascot-trophy.webp`) — wins, level-ups, season ends
> [STYLE BLOCK] Single isolated character: the buffalo mascot proudly lifting a big gold #FFD166 trophy overhead with both hooves, beaming, two tiny confetti sparkles. Fully transparent background, PNG with alpha, square canvas.

**3.5 Listening** (`mascot-listening.webp`) — speech playback, transcription screens
> [STYLE BLOCK] Single isolated character: the buffalo mascot wearing big aqua over-ear headphones over its conical hat, eyes closed contentedly, one hoof tapping, two small music/sound-wave marks. Fully transparent background, PNG with alpha, square canvas.

**3.6 Writing** (`mascot-writing.webp`) — feedback being prepared, notes
> [STYLE BLOCK] Single isolated character: the buffalo mascot concentrating while writing on a notepad with an oversized gold pencil, tip of tongue out in focus. Fully transparent background, PNG with alpha, square canvas.

---

## TIER 4 — Gamification & celebration kit

Save to `apps/web/public/images/rewards/`. All: **square, transparent**.

**4.1 Treasure chest — closed** (`chest-closed.webp`) — quest rewards
> [STYLE BLOCK] Single isolated game icon: a chunky closed treasure chest, aqua #00B8D9 body with deep-aqua #0788A0 bands and a gold #FFD166 lock, rounded friendly proportions. Flat vector. Fully transparent background, PNG with alpha, square canvas.

**4.2 Treasure chest — open** (`chest-open.webp`)
> [STYLE BLOCK] Same chest as the closed version but open, glowing gold light and three aqua orbs + two gold stars popping out. Flat vector, no glow halo — use solid light shapes. Fully transparent background, PNG with alpha, square canvas.

**4.3 League shields ×3** (`league-bronze.webp`, `league-silver.webp`, `league-gold.webp`)
> [STYLE BLOCK] Single isolated game badge: a chunky rounded shield with a laurel branch on each side and a small star on top. Version A bronze (#C9885A shield, deeper bronze laurel), version B silver (#C9D6DC shield), version C gold (#FFD166 shield, deeper gold laurel). Same shape all three. Flat vector. Fully transparent background, PNG with alpha, square canvas.
> *(Generate one message per color, referencing the previous output for shape consistency.)*

**4.4 XP bolt** (`xp-bolt.webp`)
> [STYLE BLOCK] Single isolated game icon: a chunky gold #FFD166 lightning bolt with a warm-orange #FF9F45 underside edge, rounded corners, one white shine dot. Flat vector. Fully transparent background, PNG with alpha, square canvas.

**4.5 Level-up burst** (`level-up.webp`)
> [STYLE BLOCK] Single isolated celebration graphic: a gold five-pointed star inside a round aqua badge, with a ring of small confetti pieces (gold, aqua, coral) bursting outward symmetrically. Flat vector. Fully transparent background, PNG with alpha, square canvas.

**4.6 Confetti trophy scene** (`win-celebration.webp`) — duel win / session complete
> [STYLE BLOCK] Single isolated scene: the buffalo mascot jumping mid-air with joy beside a large gold trophy on a small podium step, confetti pieces falling around (gold, aqua, coral, sparse), 3:2 composition. Fully transparent background, PNG with alpha.

---

## TIER 5 — Empty states & courses

**5.1 No results** (`apps/web/public/images/empty/no-results.webp`)
> [STYLE BLOCK] Single isolated scene: the buffalo mascot peering into an oversized magnifying glass that shows nothing but a tiny ice-colored dust puff, mildly puzzled. Fully transparent background, PNG with alpha, square canvas.

**5.2 Lost / 404** (`apps/web/public/images/empty/lost.webp`)
> [STYLE BLOCK] Single isolated scene: the buffalo mascot holding an upside-down paper map, standing at a tiny crossroads signpost with two blank aqua signs, endearingly confused. Fully transparent background, PNG with alpha, square canvas.

**5.3 Course covers ×5** (`apps/web/public/images/courses/cover-*.webp`, 16:9, NOT transparent)
> [STYLE BLOCK] A 16:9 course-cover illustration on a solid pale-aqua #E5F8FC background with a subtle paper grain: {ONE OF:
> • "debate-basics": the buffalo mascot at a podium in front of a big friendly aqua speech bubble
> • "rebuttal": two speech bubbles clashing — an aqua one deflecting a coral one, mascot confidently between them
> • "evidence": the mascot stacking three solid blocks labeled with simple icons (book, chart, scale) into a tower
> • "delivery": the mascot mid-gesture in a spotlight, sound waves flowing smoothly from its mouth
> • "public-speaking": the mascot on a stage facing three small cheering student silhouettes
> } Generous negative space on the right third for a title overlay. Flat vector, no text anywhere.

---

## Generation tips (learned from the landing run)

- **One asset per message.** Batching degrades consistency.
- If the face drifts off-model, reply: "redo with the exact face from the reference image — same eye shape, same blush dots, same horn size."
- If you get baked-in shadows on the "transparent" background, reply: "remove the ground shadow, fully transparent background."
- ChatGPT sometimes adds outlines — the style block forbids them, but if they appear: "remove all outlines, solid flat fills only."
- Keep every output PNG in `design-artifacts/` as a master, ship WebP. Convert:
  ```bash
  node -e "const s=require('sharp'),fs=require('fs');fs.readdirSync('.').filter(f=>f.endsWith('.png')).forEach(f=>s(f).webp({quality:92,effort:6}).toFile(f.replace('.png','.webp')))"
  ```
- When everything is generated, ask Claude to wire the new paths — every slot in the code
  is a single `src` string (the dashboard map is `DRILL_ILLUSTRATIONS` in
  `daily-focus-hero.tsx`; rewards/popups are direct `<Image src>` paths).
