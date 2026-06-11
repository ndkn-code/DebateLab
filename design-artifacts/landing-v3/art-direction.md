# Thinkfy Landing v3 — Art Direction Spec

Goal: revamp the Thinkfy landing page to Duolingo / Brilliant / Arcade level.
8 sections → 8 horizontal reference images → recreated in code with smooth animations.

## Brand world (locked across all 8 images)

- **Product**: Thinkfy — AI debate & public-speaking coach for Vietnamese high-school students.
- **Mascot**: baby water buffalo in a teal áo dài + nón lá (conical hat) with an orange neckerchief.
  Reference: `apps/web/public/brand/thinkfy/thinkfy-mascot-standing.png` (+ wave, book poses).
- **Palette** (single palette, every image):
  - Primary aqua `#00B8D9`, deep aqua `#0788A0`
  - Ink navy `#102936` (text), muted `#657B84`
  - Backgrounds: white `#FFFFFF`, ice `#F3FCFE`, aqua tint `#E5F8FC`
  - Accent gold `#FFD166` (rewards, stars), warm orange `#FF9F45` (scarf orange, streaks)
  - Debate-side semantic: aqua = FOR team, coral `#FF5A5F` = AGAINST team (used sparingly)
- **Typography**: rounded friendly grotesk, bold, tight tracking (Plus Jakarta Sans in code).
  Headlines: ink navy with one aqua highlight word. No gradient text.
- **Surfaces**: big rounded corners (24–34px), soft 1px aqua-tint borders, Duolingo-style
  3D buttons (hard bottom edge), flat 2D illustration style with subtle paper grain.
- **Illustration style**: flat vector, chunky shapes, Duolingo-energy characters
  (Vietnamese students), no gradients in characters, soft single-tone shadows.

## Skill picks (combinatorial engine)

- Theme paradigm: **Pristine Light Mode**
- Background character: **pure solid fields with soft ambient aqua gradient depth**
- Typography character: clean rounded grotesk, strong hierarchy
- Hero architecture: **Cinematic Centered Minimalist** (stacked center over stage scene)
- Section system: **Asymmetric premium marketing flow**
- Signature components (4): Pristine Gapless Bento Grid · Product UI Panel Stack ·
  Split Testimonial Quote Wall · Oversized Metrics Strip
- Motion language (2): staggered float-up energy · parallax image drift energy
- Narrative spine: **Journey / pilgrimage** — "from first speech to final round";
  waypoint/path motifs thread through sections 1→5→8
- Second-read moment: ONE oversized speech-bubble shape framing the testimonial wall
- Hero scale: **Giant Statement Hero**

## The 8 sections

| # | Section | Anchor | Background mode | CTA |
|---|---------|--------|-----------------|-----|
| 1 | Hero — "Find your voice. Win the room." | stacked center, scene in lower half | soft ice→aqua ambient gradient | 3D primary pill + ghost |
| 2 | Proof strip — oversized metrics | mini minimalist centered strip | solid white | none |
| 3 | Features bento — coach, topics, live debates, analytics | top-left lead heading, gapless bento | aqua-tint field `#E5F8FC` | tiny inline links |
| 4 | Product showcase — real feedback UI | right-text / left-UI-panel (inverted classic) | flat color block + UI crop | underlined arrow link |
| 5 | Journey path — Learn → Practice → Compete → Win | image-as-canvas, winding path full width | full-bleed illustrated scene | waypoint badge CTA |
| 6 | Gamification — streaks, XP, leagues | left-text / right-cards (classic, once) | solid white | ghost |
| 7 | Testimonial quote wall | centered head, asymmetric wall | ice tint + giant speech-bubble frame | none |
| 8 | Final CTA — "Ready to find your voice?" | centered statement, mascot bottom-right | bold flat aqua field `#00B8D9` | oversized white pill |

Conversion path: hook (1) → proof (2) → educate (3,4) → journey (5) → delight (6) → proof (7) → convert (8).
Rhythm: giant → mini → rich → medium → full-bleed → medium → calm → bold mini.

## Output

- Images: `design-artifacts/landing-v3/sections/0X-name.png`, 16:9, 2K
- Element assets regenerated separately → `apps/web/public/images/landing-v3/`
