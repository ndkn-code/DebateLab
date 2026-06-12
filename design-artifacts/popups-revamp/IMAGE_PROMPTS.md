# Popups Revamp — Mascot Illustration Prompts

Four mascot scenes to fill the gaps in the popup artwork set. Export each as
**WebP with a transparent background**, landscape-ish or square composition
(the popup shows them at ~245×190, the referral dialog at ~190×150 — one bold
scene, no fine detail). Drop at the exact paths below; the UI already points
at them and falls back gracefully until they exist.

## Style anchor — IMPORTANT

Attach an existing mascot scene as a style reference in ChatGPT
(e.g. `apps/web/public/images/smart-popups/try-courses.webp`) and say:

> Match this exact character and style: the same cute baby water buffalo
> mascot — black body, cream horns, rosy cheeks, wearing a cyan Vietnamese
> nón lá hat and cyan áo dài with a yellow neck scarf. Soft storybook
> illustration, gentle shading, warm and playful. Transparent background,
> no text, no frame, subject fills most of the canvas.

## Scenes → `apps/web/public/images/smart-popups/`

| # | File | Scene prompt (append to style anchor) |
|---|------|----------------------------------------|
| 1 | `share-thinkfy.webp` | The buffalo mascot joyfully holding up a big cream envelope sealed with a cyan heart, tiny confetti pieces and one yellow star floating around it. Mid-hop, tail up, delighted expression. *(Used in the referral "Chia sẻ Thinkfy" dialog.)* |
| 2 | `feature-announcement.webp` | The buffalo mascot proudly speaking into a large yellow-and-cyan megaphone, three small sparkle bursts coming out of the megaphone's mouth. Confident stance. *(Used for feature-announcement campaigns.)* |
| 3 | `feedback-survey.webp` | The buffalo mascot holding a clipboard with a short checklist (three blank rounded lines, one cyan checkmark) and a big yellow pencil in the other hoof, looking up attentively as if listening. *(Used for feedback survey popups.)* |
| 4 | `reminder-bell.webp` | The buffalo mascot gently ringing a golden hand bell with both hooves, two small cyan musical-note-like chime marks in the air, soft smile. *(Used for the reminder email opt-in popup.)* |

## Conversion tip

If ChatGPT exports PNG: `npx sharp-cli -i input.png -o share-thinkfy.webp --format webp -q 92`
— keep the transparent background (don't flatten to white).

PNG masters can live in `design-artifacts/popups-revamp/assets-original/`.
