# Rare UI exact-adoption design QA

- Source visual truth:
  - https://www.rareui.com/components/bouncesidebar
  - https://www.rareui.com/components/proximitysidebar
  - https://www.rareui.com/components/githubactivity
- Source captures:
  - `/tmp/rareui-bounce-source.png`
  - `/tmp/rareui-proximity-source.png`
  - `/tmp/rareui-activity-source.png`
- Implementation captures:
  - `/tmp/thinkfy-bounce-implementation.png`
  - `/tmp/thinkfy-proximity-implementation.png`
  - `/tmp/thinkfy-activity-implementation.png`
- Combined comparison: `/tmp/rareui-all-comparison.png`
- Viewport: 1712 x 981 CSS px, device scale factor 1
- Pixel dimensions: each source and implementation capture is 1712 x 981; the combined comparison is 3424 x 2943. No density normalization was required.
- State: authenticated dev fixture, dark theme; settings Profile selected, chat with two message anchors, IELTS profile empty-consistency state.

## Full-view comparison evidence

The combined comparison places each Rare UI source demo on the left and its Thinkfy integration on the right at the same viewport. The upstream motion geometry, active-dot treatment, proximity dash hierarchy, and activity-cell treatment are preserved. The surrounding Thinkfy shell intentionally supplies product content, semantic tokens, and responsive placement.

## Focused comparison evidence

A separate crop was not required because each component remains legible at the normalized desktop capture. Source fidelity was additionally verified byte-for-byte against Rare UI commit `aca2c360a4abec940b2629c4a18c45971cfa13c0`.

## Required fidelity surfaces

- Fonts and typography: the vendored component typography remains upstream-exact; application wrappers continue using Inter and Thinkfy semantic type utilities.
- Spacing and layout rhythm: Bounce Sidebar is contained within the existing 220 px settings rail; Proximity Sidebar occupies a dedicated 150 px desktop overlay; GitHub Activity fits the IELTS consistency card without document overflow.
- Colors and visual tokens: documented component props map the active marker and activity accent to Thinkfy semantic primary/success tokens. Dark and light surfaces inherit the upstream component behavior.
- Image quality and asset fidelity: these components contain no replaceable raster assets. No source icons, logos, or illustrations were approximated.
- Copy and content: settings labels, chat message labels, and IELTS summaries use existing product data. The activity visualization is hidden from assistive technology and paired with a localized daily text fallback because the untouched upstream visual has GitHub-specific English semantics.

## Interaction and responsive verification

- Bounce Sidebar controlled selection and active-section announcement verified.
- Proximity Sidebar click navigation updates the URL hash and `aria-current` target.
- IELTS activity grid renders with Sunday-aligned weeks and 84 localized daily fallback entries.
- 390 x 844: no document overflow; desktop-only Bounce/Proximity rails remain hidden; the activity card fits at 320 px.
- 1440 x 900: dark theme and `prefers-reduced-motion: reduce` verified with no overflow.
- Console/network note: the dev-bypass AI request returns the existing backend authorization error; the local UI still exercised message-anchor behavior and no sensitive error detail was rendered.

## Comparison history

Initial QA found a shifted activity calendar, misleading repository semantics, lost day-level accessibility, no announced settings selection, and potentially colliding chat anchors. The integration was revised to Sunday-align the calendar, remove synthetic repository rows, add localized day-level fallback text, announce the active settings section, and suffix chat anchors with their source index. The post-fix captures and DOM checks show no remaining actionable P0/P1/P2 mismatch.

## Final result

passed
