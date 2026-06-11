#!/usr/bin/env node
/**
 * Landing v3 reference image generation via Gemini (Nano Banana Pro).
 *
 * Usage:
 *   node scripts/landing-v3-imagegen.mjs sections            # generate the 8 section comps
 *   node scripts/landing-v3-imagegen.mjs sections 3 5        # regenerate only sections 3 and 5
 *   node scripts/landing-v3-imagegen.mjs asset <name> "<prompt>" [--ar 1:1] [--ref path ...]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV = readFileSync(resolve(ROOT, "apps/web/.env.local"), "utf8");
const KEY_POOL = (
  ENV.match(/^GEMINI_API_KEYS=(.+)$/m)?.[1] ??
  ENV.match(/^GEMINI_API_KEY=(.+)$/m)?.[1] ??
  ""
)
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
if (!KEY_POOL.length) throw new Error("No Gemini API keys found in apps/web/.env.local");

const MODELS = process.env.IMAGE_MODEL
  ? [process.env.IMAGE_MODEL]
  : ["gemini-3-pro-image-preview", "gemini-3.1-flash-image", "gemini-2.5-flash-image"];
const OUT_DIR = resolve(ROOT, "design-artifacts/landing-v3/sections");
mkdirSync(OUT_DIR, { recursive: true });

const MASCOT_STANDING = resolve(ROOT, "apps/web/public/brand/thinkfy/thinkfy-mascot-standing.png");
const MASCOT_WAVE = resolve(ROOT, "apps/web/public/brand/thinkfy/thinkfy-mascot-wave.png");

function imagePart(path) {
  const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return { inline_data: { mime_type: mime, data: readFileSync(path).toString("base64") } };
}

async function tryOnce({ model, key, prompt, refs, aspectRatio }) {
  const body = {
    contents: [{ parts: [...refs.map(imagePart), { text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio, imageSize: "2K" },
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!img) {
    const txt = parts.map((p) => p.text).filter(Boolean).join(" ").slice(0, 300);
    throw new Error(`no image in response (${txt || "empty"})`);
  }
  return Buffer.from(img.inlineData?.data ?? img.inline_data?.data, "base64");
}

// Remembers the last working (model, key) combo to avoid re-probing.
let sticky = null;

async function generate({ prompt, refs = [], aspectRatio = "16:9", outPath }) {
  const combos = sticky
    ? [sticky, ...MODELS.flatMap((m) => KEY_POOL.map((k) => ({ model: m, key: k })))]
    : MODELS.flatMap((m) => KEY_POOL.map((k) => ({ model: m, key: k })));
  let lastErr;
  for (const combo of combos) {
    try {
      const buf = await tryOnce({ ...combo, prompt, refs, aspectRatio });
      writeFileSync(outPath, buf);
      sticky = combo;
      console.log(`✓ wrote ${outPath} (${combo.model}, key …${combo.key.slice(-4)})`);
      return;
    } catch (err) {
      lastErr = err;
      const tag = `${combo.model} …${combo.key.slice(-4)}`;
      if (err.status === 429 || err.status === 403 || err.status === 400) {
        console.warn(`  ${tag}: ${err.message.slice(0, 120)} — trying next combo`);
        if (sticky && combo.model === sticky.model && combo.key === sticky.key) sticky = null;
        continue;
      }
      // transient (5xx, network, empty image): retry same combo once after a pause
      console.warn(`  ${tag}: ${err.message.slice(0, 120)} — retrying once`);
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const buf = await tryOnce({ ...combo, prompt, refs, aspectRatio });
        writeFileSync(outPath, buf);
        sticky = combo;
        console.log(`✓ wrote ${outPath} (${combo.model}, key …${combo.key.slice(-4)})`);
        return;
      } catch (err2) {
        lastErr = err2;
        console.warn(`  ${tag}: retry failed — trying next combo`);
        continue;
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Shared brand world block — prepended to every section prompt (skill §16).
// ---------------------------------------------------------------------------
const STYLE = `You are an elite frontend art director generating ONE horizontal website-section design comp (a pixel-perfect UI design reference, not mood art). A developer must be able to recreate it exactly in code.

BRAND WORLD — "Thinkfy", an AI debate & public-speaking coach for Vietnamese high-school students. Quality bar: duolingo.com, brilliant.org, arcade.software. Ultra-clean, modern, playful-premium edtech.

MASCOT: the attached character — a cute baby water buffalo wearing a teal áo dài and a Vietnamese conical hat (nón lá) with an orange neckerchief. Keep the character EXACTLY consistent with the reference image: same face, same proportions, same outfit, same colors. Flat 2D vector illustration style, chunky rounded shapes, single-tone soft shadows, NO 3D render, NO gradients inside the character.

LOCKED PALETTE (use only these):
- Primary aqua #00B8D9, deep aqua #0788A0
- Ink navy #102936 for headlines/text, slate #657B84 for secondary text
- Surfaces: pure white #FFFFFF, ice #F3FCFE, pale aqua tint #E5F8FC, hairline borders #CDECF3
- Accent gold #FFD166 (stars, rewards), warm orange #FF9F45 (streak flames, scarf)
- Coral #FF5A5F ONLY as the "opposing team" semantic color, used sparingly
NO purple, NO neon, NO rainbow gradients, NO glassmorphism, NO glow effects.

TYPOGRAPHY: friendly rounded geometric grotesk (like Plus Jakarta Sans / Duolingo Feather Bold energy). Headlines: extra-bold, tight tracking, ink navy #102936, with exactly ONE word highlighted in aqua #00B8D9. Short punchy copy in flawless English, no lorem ipsum, no gibberish. Body text slate, generous line height. Text must be crisp, readable, correctly spelled.

UI LANGUAGE: big rounded corners (24-32px) on cards/panels, soft 1px #CDECF3 borders, subtle soft shadows, Duolingo-style 3D buttons (flat top, hard darker bottom edge 4px, like a physical key). Generous whitespace, airy breathing room, premium spacing. Flat illustration, subtle paper-grain texture allowed on large fields.

RENDERING: crisp flat vector UI rendering, perfectly straight edges, aligned grid, high fidelity, sharp legible text. This is a website section design comp on a 16:9 canvas, desktop width (~1440px design), edge-to-edge — no browser chrome, no device frame, no watermark.`;

// ---------------------------------------------------------------------------
// The 8 sections (skill: one horizontal image per section, varied anchors).
// ---------------------------------------------------------------------------
const SECTIONS = [
  {
    file: "01-hero.png",
    refs: [MASCOT_STANDING],
    prompt: `SECTION 1 of 8 — GIANT STATEMENT HERO (stacked center, scene in lower half).

Layout: very top: slim minimal navbar — left: small aqua "thinkfy" wordmark with tiny buffalo-head logo; center: nav links "Features · Topics · Live Debates · Pricing" in slate; right: small ghost "Log in" button + small aqua 3D button "Get started". Background: vertical ambient gradient from white #FFFFFF at top into ice #F3FCFE and pale aqua #E5F8FC at the bottom — soft, airy, premium.

Center, upper half: giant extra-bold centered headline "Find your voice." on line one in ink navy, "Win the room." on line two with "Win" in aqua #00B8D9. Below: one short centered sub-line in slate: "AI-powered debate coaching that turns students into confident speakers." Below that: a large aqua 3D pill button "Start for free" (white text, hard darker-aqua bottom edge) next to a white ghost pill button "Watch how it works".

Lower half of the canvas: a wide, clean flat-vector debate-stage scene: the buffalo mascot (exactly as reference) standing proudly at a rounded aqua podium with a small microphone, centered on a subtle stage platform. Flanking it at a distance: two smaller Vietnamese student characters (a girl with a ponytail in a white school shirt with red scarf, a boy with glasses) at smaller white podiums, cheerful, mid-gesture. Above the students: small clean speech bubbles — one aqua bubble with a check mark, one coral #FF5A5F bubble with a counter-argument arrow icon. Confetti-like tiny gold #FFD166 sparkles scattered very sparingly around the stage. A soft pale-aqua spotlight cone behind the mascot.

Mood: triumphant first scene of a journey, clean and uncluttered, huge negative space around the headline. Duolingo-level charm, Arcade-level cleanliness.`,
  },
  {
    file: "02-proof-strip.png",
    refs: [MASCOT_WAVE],
    prompt: `SECTION 2 of 8 — MINI MINIMALIST PROOF STRIP (oversized metrics, mostly negative space).

Layout: solid pure white #FFFFFF background, ultra-airy. A single centered row of four oversized metrics, evenly spaced, each as plain typography (NO cards, no boxes): big extra-bold ink-navy numbers with a small aqua icon above each, and a small slate caption below:
- mic icon → "120k+" → "speeches analyzed"
- people icon → "10,000+" → "student debaters"
- lightning icon → "24/7" → "instant AI feedback"
- trophy icon (gold #FFD166) → "95%" → "feel more confident"

Thin hairline #CDECF3 rules above and below the strip, very wide margins. At the far right edge, the buffalo mascot (exact reference character) peeks playfully into the frame from the right side, only half visible, waving. One tiny gold sparkle near it.

Mood: confident restraint, Brilliant-style calm proof moment between two bigger sections. Lots of whitespace. Mini section, small height feel.`,
  },
  {
    file: "03-features-bento.png",
    refs: [MASCOT_STANDING],
    prompt: `SECTION 3 of 8 — FEATURES BENTO GRID (top-left lead heading, pristine gapless bento).

Background: full-bleed pale aqua tint field #E5F8FC with a very subtle paper grain. Top-left: small aqua uppercase eyebrow label "EVERYTHING YOU NEED", below it a large extra-bold ink-navy heading "Train like a champion debater" with "champion" in aqua, left-aligned. Top-right corner: short slate sentence "Four tools. One goal: make you unstoppable on stage."

Main area: a pristine bento grid of white rounded cards (28px radius, 1px #CDECF3 borders, tight even 16px gaps, mathematically clean, NO accidental gaps):
- LARGE card (left, tall): "AI Practice Coach" — flat illustration of the buffalo mascot holding a clipboard beside a chat panel with feedback bubbles (aqua bubble "Strong rebuttal!", gold star rating row), small slate caption.
- WIDE card (top right): "500+ Debate Topics" — row of small rounded topic chips ("School uniforms", "Social media", "AI in class") in ice with aqua icons, a small book illustration.
- MEDIUM card: "Live Debates" — two small student avatars facing each other with aqua vs coral speech bubbles and a small "LIVE" badge in coral.
- MEDIUM card: "Progress Analytics" — clean mini bar chart with aqua bars rising and one gold bar at the end, small upward arrow.

Each card: bold ink-navy card title, one short slate caption line, generous internal padding. Icons flat aqua.

Mood: organized, joyful, premium SaaS clarity with Duolingo charm.`,
  },
  {
    file: "04-product-showcase.png",
    refs: [MASCOT_STANDING],
    prompt: `SECTION 4 of 8 — PRODUCT SHOWCASE (inverted classic: UI panel LEFT, text RIGHT).

Background: solid white #FFFFFF. Left two-thirds: a large, beautiful product UI panel (rounded 24px, soft shadow, 1px border) showing the Thinkfy practice feedback screen in flat clean UI: top bar with "Practice · Should homework be banned?" title and a small aqua timer chip "4:32"; below, a transcript area with highlighted sentences (one aqua highlight labeled "Strong claim", one gold highlight labeled "Add evidence"); right side of the panel: a score card column — circular score dial showing "82" in aqua, then three small horizontal meter rows labeled "Clarity 86", "Logic 78", "Delivery 84" with aqua fill bars; bottom: a small coach chat bubble from a tiny buffalo mascot avatar saying "Your rebuttal improved 12% this week!".

Behind the main panel, slightly offset and peeking from underneath: a second smaller blurred-edge panel suggesting a stack (parallax feel).

Right third: vertically centered text block, left-aligned: small aqua eyebrow "SMART FEEDBACK", extra-bold ink-navy heading "Feedback that actually makes you better" with "better" in aqua, two short slate paragraphs (one sentence each) about instant scoring of clarity, logic and delivery, then an underlined aqua inline link with arrow "See a sample report →" (NOT a pill button).

Mood: trustworthy product moment, Arcade-style cleanliness, real believable UI.`,
  },
  {
    file: "05-journey-path.png",
    refs: [MASCOT_STANDING],
    prompt: `SECTION 5 of 8 — JOURNEY PATH (image-as-canvas, full-bleed illustrated scene, the page's full-bleed moment).

A full-bleed flat-vector landscape scene filling the entire 16:9 canvas: a soft ice #F3FCFE sky and gently rolling pale-aqua #E5F8FC hills with subtle Vietnamese landscape touches (tiny stylized rice terraces and one distant limestone karst silhouette in pale aqua, very subtle). A smooth winding aqua path (#00B8D9, rounded, like a Duolingo course path) flows from bottom-left to top-right across the whole scene with four circular waypoint badges evenly along it:
1. white badge with aqua book icon, label "Learn the basics"
2. white badge with aqua mic icon, label "Practice with AI"
3. white badge with coral-vs-aqua swords icon, label "Compete live"
4. gold #FFD166 badge with white trophy icon, label "Win the final" — slightly larger, with tiny confetti sparkles.

The buffalo mascot (exact reference) walks happily along the path between badge 2 and 3, mid-stride. Top-center of the canvas, in a clean safe area of sky: centered extra-bold ink-navy headline "Your journey to the final round" with "journey" in aqua, plus one short slate sub-line "A guided path from your first speech to championship debates." Labels in small bold ink-navy text on white rounded chips.

Mood: adventurous but calm, the narrative heart of the page. Generous sky negative space, premium flat illustration.`,
  },
  {
    file: "06-gamification.png",
    refs: [MASCOT_WAVE],
    prompt: `SECTION 6 of 8 — GAMIFICATION (classic: text LEFT, cards RIGHT — used once on this page).

Background: solid white #FFFFFF, airy. Left 40%: vertically centered, left-aligned: small aqua eyebrow "STAY MOTIVATED", extra-bold ink-navy heading "Practice that feels like play" with "play" in aqua, one short slate paragraph about streaks, XP and weekly leagues keeping you coming back, then a white ghost pill button with aqua border "Explore the app".

Right 60%: a lively but tidy cluster of three overlapping game UI cards (rounded 24px, soft shadows, slight playful rotations -3°/0°/+3°):
- Streak card: big warm-orange #FF9F45 flame icon, "12-day streak!", row of 7 small day dots (5 filled orange, 2 hollow).
- League card: "Gold League" header with gold #FFD166 laurel badge, mini leaderboard rows — rank 1 "Minh Anh 980 XP" with tiny gold crown, rank 2 "Bao 870 XP", rank 3 highlighted aqua row "You 845 XP" with a small up-arrow.
- XP card: "+40 XP" burst with gold stars and a small progress bar to "Level 8".

The buffalo mascot (exact reference, waving pose) leans cheerfully against the bottom-left corner of the card cluster, as if presenting them. Two tiny confetti sparkles only.

Mood: Duolingo-grade delight, restrained and clean, joyful but premium.`,
  },
  {
    file: "07-testimonials.png",
    refs: [MASCOT_STANDING],
    prompt: `SECTION 7 of 8 — TESTIMONIAL QUOTE WALL (centered heading, asymmetric wall inside ONE giant speech bubble — the page's second-read moment).

Background: ice #F3FCFE. Centered at top: small aqua eyebrow "LOVED BY STUDENT DEBATERS", extra-bold ink-navy heading "Debaters can't stop talking" with "talking" in aqua.

Main area: ONE enormous white speech-bubble shape (rounded 40px rectangle with a small bubble tail at bottom-left, 1px #CDECF3 border, soft shadow) acting as a frame that contains an asymmetric masonry wall of four testimonial cards (varied heights, 20px radius, ice #F3FCFE fill):
- "Thinkfy got me to the national semifinals. The AI catches things even my coach missed." — Linh, Grade 11, Hanoi — 5 gold stars, small round avatar of a Vietnamese girl with glasses.
- "I used to freeze on stage. Now I ask to go first." — Duc, Grade 10, Da Nang — avatar of a boy with a side part.
- "Our debate club doubled in size after we started using it." — Ms. Huong, Club Advisor, HCMC — avatar of a teacher with a bun.
- "The streak made me practice every single day. 47 days now!" — Khanh, Grade 12, Hue — avatar with short hair, small orange flame icon.

Quotes in ink navy medium weight, names bold with slate roles, avatars flat-vector. The buffalo mascot (exact reference) sits on TOP edge of the giant bubble, legs dangling, listening happily.

Mood: warm, human, calm — generous padding, nothing cramped.`,
  },
  {
    file: "08-final-cta.png",
    refs: [MASCOT_WAVE],
    prompt: `SECTION 8 of 8 — FINAL CTA (bold flat aqua field, centered statement, mascot bottom-right).

Background: full-bleed confident flat aqua #00B8D9 field with a very subtle darker-aqua #0788A0 vignette at the edges and a faint paper grain. Sparse tiny white star sparkles (4-5 only).

Center, slightly above middle: giant extra-bold WHITE centered headline "Ready to find your voice?" (two lines max), below it one short ice-white sub-line "Join 10,000+ students becoming fearless speakers — free." Below: an oversized WHITE 3D pill button with aqua-ink text "Start debating free" (hard darker bottom edge, Duolingo key style), and beneath it a tiny white underlined ghost link "No credit card needed".

Bottom-right: the buffalo mascot (exact reference, waving pose), large, waving goodbye/welcome, standing on the bottom edge. Bottom-left: small white Thinkfy wordmark with tiny buffalo logo. A thin white hairline at the very bottom suggesting the footer begins below.

Mood: decisive, warm, unmistakable single action. Huge breathing room around the headline. The triumphant closing waypoint of the journey.`,
  },
];

// ---------------------------------------------------------------------------
const [, , mode, ...rest] = process.argv;

if (mode === "sections") {
  const only = rest.map(Number).filter(Boolean);
  for (let i = 0; i < SECTIONS.length; i++) {
    const n = i + 1;
    if (only.length && !only.includes(n)) continue;
    const s = SECTIONS[i];
    console.log(`Generating section ${n}/8: ${s.file}`);
    await generate({
      prompt: `${STYLE}\n\n${s.prompt}`,
      refs: s.refs,
      aspectRatio: "16:9",
      outPath: resolve(OUT_DIR, s.file),
    });
  }
  console.log("Done.");
} else if (mode === "asset") {
  // node scripts/landing-v3-imagegen.mjs asset <name> "<prompt>" [--ar 1:1] [--ref path ...] [--out dir]
  const name = rest[0];
  const prompt = rest[1];
  let ar = "1:1";
  const refs = [];
  let outDir = resolve(ROOT, "design-artifacts/landing-v3/assets");
  for (let i = 2; i < rest.length; i++) {
    if (rest[i] === "--ar") ar = rest[++i];
    else if (rest[i] === "--ref") refs.push(resolve(ROOT, rest[++i]));
    else if (rest[i] === "--out") outDir = resolve(ROOT, rest[++i]);
  }
  mkdirSync(outDir, { recursive: true });
  await generate({ prompt, refs, aspectRatio: ar, outPath: resolve(outDir, `${name}.png`) });
} else {
  console.log("Usage: sections [n ...] | asset <name> <prompt> [--ar a:b] [--ref path ...]");
  process.exit(1);
}
