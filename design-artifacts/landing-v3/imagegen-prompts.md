# Thinkfy Landing v3 — Image Generation Prompt Pack

Paste these into ChatGPT (or any image model). Two parts:

1. **Section comps** (8 prompts) — full-section design references, 16:9 landscape. These match what is already built in code; use them to art-direct refinements or regenerate richer scenes.
2. **Element assets** (drop-in PNGs) — individual illustrated elements with transparent backgrounds. Each one lists the exact file path to save into; the code swap points are noted.

> Tip: attach `apps/web/public/brand/thinkfy/thinkfy-mascot-standing.png` (and `-wave.png`) to every prompt so the character stays consistent.

---

## Shared style block (prepend to EVERY prompt)

```
You are an elite frontend art director generating ONE horizontal website-section design comp (a pixel-perfect UI design reference, not mood art). A developer must be able to recreate it exactly in code.

BRAND WORLD — "Thinkfy", an AI debate & public-speaking coach for Vietnamese high-school students. Quality bar: duolingo.com, brilliant.org, arcade.software. Ultra-clean, modern, playful-premium edtech.

MASCOT: the attached character — a cute baby water buffalo wearing a teal áo dài and a Vietnamese conical hat (nón lá) with an orange neckerchief. Keep the character EXACTLY consistent with the reference image: same face, same proportions, same outfit, same colors. Flat 2D vector illustration style, chunky rounded shapes, single-tone soft shadows, NO 3D render, NO gradients inside the character.

LOCKED PALETTE (use only these):
- Primary aqua #00B8D9, deep aqua #0788A0
- Ink navy #102936 for headlines/text, slate #657B84 for secondary text
- Surfaces: pure white #FFFFFF, ice #F3FCFE, pale aqua tint #E5F8FC, hairline borders #CDECF3
- Accent gold #FFD166 (stars, rewards), warm orange #FF9F45 (streak flames, scarf)
- Coral #FF5A5F ONLY as the "opposing team" semantic color, used sparingly
NO purple, NO neon, NO rainbow gradients, NO glassmorphism, NO glow effects.

TYPOGRAPHY: friendly rounded geometric grotesk (like Plus Jakarta Sans / Duolingo Feather Bold energy). Headlines: extra-bold, tight tracking, ink navy #102936, with exactly ONE word highlighted in aqua #00B8D9. Short punchy copy in flawless English, no lorem ipsum. Body text slate, generous line height.

UI LANGUAGE: big rounded corners (24-32px) on cards/panels, soft 1px #CDECF3 borders, subtle soft shadows, Duolingo-style 3D buttons (flat top, hard darker bottom edge 4px, like a physical key). Generous whitespace, airy breathing room, premium spacing. Flat illustration, subtle paper-grain texture allowed on large fields.

RENDERING: crisp flat vector UI rendering, perfectly straight edges, aligned grid, high fidelity, sharp legible text. This is a website section design comp on a 16:9 canvas, desktop width (~1440px design), edge-to-edge — no browser chrome, no device frame, no watermark.
```

---

## Part 1 — The 8 section comps (16:9 each)

### Section 1 of 8 — Hero

```
SECTION 1 of 8 — GIANT STATEMENT HERO (stacked center, scene in lower half).

Layout: very top: slim minimal navbar — left: small aqua "thinkfy" wordmark with tiny buffalo-head logo; center: nav links "Features · Topics · Live Debates · Pricing" in slate; right: small ghost "Log in" button + small aqua 3D button "Get started". Background: vertical ambient gradient from white #FFFFFF at top into ice #F3FCFE and pale aqua #E5F8FC at the bottom — soft, airy, premium.

Center, upper half: giant extra-bold centered headline "Find your voice." on line one in ink navy, "Win the room." on line two with "Win" in aqua #00B8D9. Below: one short centered sub-line in slate: "AI-powered debate coaching that turns students into confident speakers." Below that: a large aqua 3D pill button "Start for free" (white text, hard darker-aqua bottom edge) next to a white ghost pill button "Watch how it works".

Lower half of the canvas: a wide, clean flat-vector debate-stage scene: the buffalo mascot (exactly as reference) standing proudly at a rounded aqua podium with a small microphone, centered on a subtle stage platform. Flanking it at a distance: two smaller Vietnamese student characters (a girl with a ponytail in a white school shirt with red scarf, a boy with glasses) at smaller white podiums, cheerful, mid-gesture. Above the students: small clean speech bubbles — one aqua bubble with a check mark, one coral #FF5A5F bubble with a counter-argument arrow icon. Confetti-like tiny gold #FFD166 sparkles scattered very sparingly around the stage. A soft pale-aqua spotlight cone behind the mascot.

Mood: triumphant first scene of a journey, clean and uncluttered, huge negative space around the headline.
```

### Section 2 of 8 — Proof strip

```
SECTION 2 of 8 — MINI MINIMALIST PROOF STRIP (oversized metrics, mostly negative space).

Layout: solid pure white #FFFFFF background, ultra-airy. A single centered row of four oversized metrics, evenly spaced, each as plain typography (NO cards, no boxes): big extra-bold ink-navy numbers with a small aqua icon above each, and a small slate caption below:
- mic icon → "120k+" → "speeches analyzed"
- people icon → "10,000+" → "student debaters"
- lightning icon → "24/7" → "instant AI feedback"
- trophy icon (gold #FFD166) → "95%" → "feel more confident"

Thin hairline #CDECF3 rules above and below the strip, very wide margins. At the far right edge, the buffalo mascot (exact reference character) peeks playfully into the frame from the right side, only half visible, waving. One tiny gold sparkle near it.

Mood: confident restraint, Brilliant-style calm proof moment between two bigger sections. Mini section, small height feel.
```

### Section 3 of 8 — Features bento

```
SECTION 3 of 8 — FEATURES BENTO GRID (top-left lead heading, pristine gapless bento).

Background: full-bleed pale aqua tint field #E5F8FC with a very subtle paper grain. Top-left: small aqua uppercase eyebrow label "EVERYTHING YOU NEED", below it a large extra-bold ink-navy heading "Train like a champion debater" with "champion" in aqua, left-aligned. Top-right corner: short slate sentence "Four tools. One goal: make you unstoppable on stage."

Main area: a pristine bento grid of white rounded cards (28px radius, 1px #CDECF3 borders, tight even 16px gaps, mathematically clean, NO accidental gaps):
- LARGE card (left, tall): "AI Practice Coach" — flat illustration of the buffalo mascot holding a clipboard beside a chat panel with feedback bubbles (aqua bubble "Strong rebuttal!", gold star rating row), small slate caption.
- WIDE card (top right): "500+ Debate Topics" — row of small rounded topic chips ("School uniforms", "Social media", "AI in class") in ice with aqua icons, a small book illustration.
- MEDIUM card: "Live Debates" — two small student avatars facing each other with aqua vs coral speech bubbles and a small "LIVE" badge in coral.
- MEDIUM card: "Progress Analytics" — clean mini bar chart with aqua bars rising and one gold bar at the end, small upward arrow.

Each card: bold ink-navy card title, one short slate caption line, generous internal padding. Icons flat aqua.

Mood: organized, joyful, premium SaaS clarity with Duolingo charm.
```

### Section 4 of 8 — Product showcase

```
SECTION 4 of 8 — PRODUCT SHOWCASE (inverted classic: UI panel LEFT, text RIGHT).

Background: solid white #FFFFFF. Left two-thirds: a large, beautiful product UI panel (rounded 24px, soft shadow, 1px border) showing the Thinkfy practice feedback screen in flat clean UI: top bar with "Practice · Should homework be banned?" title and a small aqua timer chip "4:32"; below, a transcript area with highlighted sentences (one aqua highlight labeled "Strong claim", one gold highlight labeled "Add evidence"); right side of the panel: a score card column — circular score dial showing "82" in aqua, then three small horizontal meter rows labeled "Clarity 86", "Logic 78", "Delivery 84" with aqua fill bars; bottom: a small coach chat bubble from a tiny buffalo mascot avatar saying "Your rebuttal improved 12% this week!".

Behind the main panel, slightly offset and peeking from underneath: a second smaller panel suggesting a stack (parallax feel).

Right third: vertically centered text block, left-aligned: small aqua eyebrow "SMART FEEDBACK", extra-bold ink-navy heading "Feedback that actually makes you better" with "better" in aqua, two short slate paragraphs (one sentence each) about instant scoring of clarity, logic and delivery, then an underlined aqua inline link with arrow "See a sample report →" (NOT a pill button).

Mood: trustworthy product moment, Arcade-style cleanliness, real believable UI.
```

### Section 5 of 8 — Journey path

```
SECTION 5 of 8 — JOURNEY PATH (image-as-canvas, full-bleed illustrated scene, the page's full-bleed moment).

A full-bleed flat-vector landscape scene filling the entire 16:9 canvas: a soft ice #F3FCFE sky and gently rolling pale-aqua #E5F8FC hills with subtle Vietnamese landscape touches (tiny stylized rice terraces and one distant limestone karst silhouette in pale aqua, very subtle). A smooth winding aqua path (#00B8D9, rounded, like a Duolingo course path) flows from bottom-left to top-right across the whole scene with four circular waypoint badges evenly along it:
1. white badge with aqua book icon, label "Learn the basics"
2. white badge with aqua mic icon, label "Practice with AI"
3. white badge with coral-vs-aqua swords icon, label "Compete live"
4. gold #FFD166 badge with white trophy icon, label "Win the final" — slightly larger, with tiny confetti sparkles.

The buffalo mascot (exact reference) walks happily along the path between badge 2 and 3, mid-stride. Top-center of the canvas, in a clean safe area of sky: centered extra-bold ink-navy headline "Your journey to the final round" with "journey" in aqua, plus one short slate sub-line "A guided path from your first speech to championship debates." Labels in small bold ink-navy text on white rounded chips.

Mood: adventurous but calm, the narrative heart of the page. Generous sky negative space, premium flat illustration.
```

### Section 6 of 8 — Gamification

```
SECTION 6 of 8 — GAMIFICATION (classic: text LEFT, cards RIGHT — used once on this page).

Background: solid white #FFFFFF, airy. Left 40%: vertically centered, left-aligned: small aqua eyebrow "STAY MOTIVATED", extra-bold ink-navy heading "Practice that feels like play" with "play" in aqua, one short slate paragraph about streaks, XP and weekly leagues keeping you coming back, then a white ghost pill button with aqua border "Explore the app".

Right 60%: a lively but tidy cluster of three overlapping game UI cards (rounded 24px, soft shadows, slight playful rotations -3°/0°/+3°):
- Streak card: big warm-orange #FF9F45 flame icon, "12-day streak!", row of 7 small day dots (5 filled orange, 2 hollow).
- League card: "Gold League" header with gold #FFD166 laurel badge, mini leaderboard rows — rank 1 "Minh Anh 980 XP" with tiny gold crown, rank 2 "Bao 870 XP", rank 3 highlighted aqua row "You 845 XP" with a small up-arrow.
- XP card: "+40 XP" burst with gold stars and a small progress bar to "Level 8".

The buffalo mascot (exact reference, waving pose) leans cheerfully against the bottom-left corner of the card cluster, as if presenting them. Two tiny confetti sparkles only.

Mood: Duolingo-grade delight, restrained and clean, joyful but premium.
```

### Section 7 of 8 — Testimonials

```
SECTION 7 of 8 — TESTIMONIAL QUOTE WALL (centered heading, asymmetric wall inside ONE giant speech bubble — the page's second-read moment).

Background: ice #F3FCFE. Centered at top: small aqua eyebrow "LOVED BY STUDENT DEBATERS", extra-bold ink-navy heading "Debaters can't stop talking" with "talking" in aqua.

Main area: ONE enormous white speech-bubble shape (rounded 40px rectangle with a small bubble tail at bottom-left, 1px #CDECF3 border, soft shadow) acting as a frame that contains an asymmetric masonry wall of four testimonial cards (varied heights, 20px radius, ice #F3FCFE fill):
- "Thinkfy got me to the national semifinals. The AI catches things even my coach missed." — Linh, Grade 11, Hanoi — 5 gold stars, small round avatar of a Vietnamese girl with glasses.
- "I used to freeze on stage. Now I ask to go first." — Duc, Grade 10, Da Nang — avatar of a boy with a side part.
- "Our debate club doubled in size after we started using it." — Ms. Huong, Club Advisor, HCMC — avatar of a teacher with a bun.
- "The streak made me practice every single day. 47 days now!" — Khanh, Grade 12, Hue — avatar with short hair, small orange flame icon.

Quotes in ink navy medium weight, names bold with slate roles, avatars flat-vector. The buffalo mascot (exact reference) sits on TOP edge of the giant bubble, legs dangling, listening happily.

Mood: warm, human, calm — generous padding, nothing cramped.
```

### Section 8 of 8 — Final CTA

```
SECTION 8 of 8 — FINAL CTA (bold flat aqua field, centered statement, mascot bottom-right).

Background: full-bleed confident flat aqua #00B8D9 field with a very subtle darker-aqua #0788A0 vignette at the edges and a faint paper grain. Sparse tiny white star sparkles (4-5 only).

Center, slightly above middle: giant extra-bold WHITE centered headline "Ready to find your voice?" (two lines max), below it one short ice-white sub-line "Join 10,000+ students becoming fearless speakers — free." Below: an oversized WHITE 3D pill button with aqua-ink text "Start debating free" (hard darker bottom edge, Duolingo key style), and beneath it a tiny white underlined ghost link "No credit card needed".

Bottom-right: the buffalo mascot (exact reference, waving pose), large, waving, standing on the bottom edge. Bottom-left: small white Thinkfy wordmark with tiny buffalo logo. A thin white hairline at the very bottom suggesting the footer begins below.

Mood: decisive, warm, unmistakable single action. Huge breathing room around the headline.
```

---

## Part 2 — Element assets (transparent PNGs, drop-in paths)

Save each generated file to the listed path under `apps/web/public/`. All paths live in
`apps/web/public/images/landing-v3/` (create the folder). Ask the model for
**"isolated on a fully transparent background, PNG with alpha, no shadow baked into the background"**.
Keep the shared style block + mascot reference attached.

| # | Asset | Save as | Used in / swap point |
|---|-------|---------|----------------------|
| 1 | Mascot at aqua podium (front view, mic, mid-speech, confident) | `images/landing-v3/mascot-podium.png` | [hero.tsx](apps/web/src/components/landing/v3/hero.tsx) — replace the `<Image src="...mascot-standing.png">` + `<Podium size="lg">` pair with this single image |
| 2 | Mascot walking pose (side view, mid-stride, happy) | `images/landing-v3/mascot-walking.png` | [journey.tsx](apps/web/src/components/landing/v3/journey.tsx) — swap the walking mascot `src` |
| 3 | Mascot cheering (arms up, confetti-ready) | `images/landing-v3/mascot-cheer.png` | [gamification.tsx](apps/web/src/components/landing/v3/gamification.tsx) — swap the presenting mascot `src` |
| 4 | Mascot sitting, legs dangling, listening | `images/landing-v3/mascot-sitting.png` | [testimonials.tsx](apps/web/src/components/landing/v3/testimonials.tsx) — swap the bubble-top mascot `src` |
| 5 | Two Vietnamese student characters at white podiums (girl with ponytail + red scarf, boy with glasses), facing inward | `images/landing-v3/hero-students.png` | [hero.tsx](apps/web/src/components/landing/v3/hero.tsx) — replace the two `<Podium size="sm">` blocks |
| 6 | Gold trophy badge, circular, with sparkles | `images/landing-v3/badge-trophy.png` | [journey.tsx](apps/web/src/components/landing/v3/journey.tsx) — optional swap for the final `WaypointBadge` |
| 7 | Streak flame icon, chunky flat orange #FF9F45 | `images/landing-v3/icon-flame.png` | optional swap for `FlameIcon` in gamification.tsx |
| 8 | Full journey landscape backdrop (hills + rice terraces + karst, NO path/badges/text) 21:9 | `images/landing-v3/journey-backdrop.png` | [journey.tsx](apps/web/src/components/landing/v3/journey.tsx) — replace `<Hills />` with an absolutely-positioned `<Image>`; keep the SVG path/badges on top |

### Element prompt template

```
[shared style block]

ELEMENT ASSET — {name from table}.
Single isolated illustration element, flat 2D vector style matching the attached mascot exactly.
{pose/content description from the table row}
Fully transparent background, PNG with alpha. No text, no watermark, no background shapes.
Generous margin around the subject. Square canvas (1:1) unless noted.
```

Example for #1:

```
[shared style block]

ELEMENT ASSET — mascot at podium.
Single isolated illustration: the buffalo mascot (exactly as the attached reference) standing behind a rounded aqua #00B8D9 debate podium with a small black microphone, front view, confident mid-speech gesture, one hoof raised. White star emblem on the podium front. Flat 2D vector, chunky rounded shapes, single-tone soft shadow under the podium only.
Fully transparent background, PNG with alpha. No text, no watermark, no background shapes. Square canvas.
```

---

## Notes

- The section comps were also encoded in a runnable script: `scripts/landing-v3-imagegen.mjs`
  (`node scripts/landing-v3-imagegen.mjs sections`). It currently fails because the project's
  Gemini keys are free-tier (image models have zero free quota) — it will work as-is once a
  paid `GEMINI_API_KEY`/`GEMINI_API_KEYS` is present in `apps/web/.env.local`.
- The built page works fully without any of these assets (hand-coded SVG/CSS scenes +
  existing mascot poses). Every asset above is a progressive enhancement.
