# Practice Selection — Illustration Prompts

Generate each image with ChatGPT image gen, then export/convert to **WebP** and drop it
at the exact path listed. The UI auto-upgrades: while a file is missing, the app shows a
tinted icon tile; the moment the `.webp` exists at the right path, the artwork appears —
no code change needed.

## Shared style block (paste at the top of every prompt)

> Flat vector illustration in a friendly, modern education-app style (Duolingo /
> Brilliant level polish). Soft rounded geometric shapes, smooth single-weight curves,
> subtle grain-free flat shading, generous negative space. Locked brand palette only:
> primary cyan #00B8D9, deep navy ink #102936, soft sky tint #E3F6FB, warm accent
> #FFD166, white. No gradient blobs, no glassmorphism, no text, no letters, no logos,
> no watermarks, no photorealism, no 3D render. Square 1:1 canvas, 1024×1024, single
> centered subject filling ~70% of the frame on a clean #E3F6FB background.

These render at 44–64 px, so each subject must read clearly as a tiny thumbnail:
one bold silhouette, no fine detail.

## Category tiles → `apps/web/public/images/practice/categories/`

| # | File | Subject prompt (append to style block) |
|---|------|----------------------------------------|
| 1 | `education.webp` | A graduation cap resting on two stacked books, one book cyan and one navy, with a small warm-yellow tassel swinging right. Composition anchor: subject slightly low-left, tassel adds top-right motion. |
| 2 | `technology.webp` | A smartphone tilted 12 degrees with a chat bubble and a tiny network node orbit around its top corner. Cyan body, navy screen, yellow notification dot. Composition anchor: centered with orbit ring breaking the frame edge feel. |
| 3 | `society.webp` | Three overlapping abstract profile heads in conversation, front head cyan, middle navy, back sky-tint, one small yellow speech dot between them. Composition anchor: heads stepped diagonally from bottom-left to top-right. |
| 4 | `environment.webp` | A young sprout with two rounded leaves growing from a small earth mound shaped like a half circle, one leaf cyan and one navy, a yellow sun chip floating top-right. Composition anchor: sprout bottom-center, sun top-right. |
| 5 | `ethics.webp` | A balanced scale with two rounded pans, beam in navy, pans in cyan, one pan holding a small yellow heart and the other a small white lightbulb. Composition anchor: perfectly symmetric, beam slightly above center. |
| 6 | `vietnam.webp` | A rounded map pin with a tiny lotus flower inside the pin head, pin body cyan, lotus white with a yellow center, navy drop shadow shape underneath. Composition anchor: pin centered, shadow ellipse grounding it. |

## Optional refresh (only if you want to replace the current empty state)

| File | Path | Subject prompt (append to style block) |
|------|------|----------------------------------------|
| `no-results.webp` | `apps/web/public/images/empty/` | A friendly open cardboard box tilted toward the viewer with a magnifying glass leaning against it, both empty, one small yellow star floating out. Navy box outline, cyan glass rim. Composition anchor: box bottom-center with the star adding top-right lift. |

## Conversion tip

If ChatGPT exports PNG: `npx sharp-cli -i input.png -o education.webp --format webp -q 92`
(or any converter — keep 1024×1024, quality ≥ 90).
