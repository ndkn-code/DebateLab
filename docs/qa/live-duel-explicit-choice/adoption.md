# Live duel entry adoption brief

## Scope and provenance
Setup/lobby is momentum. Active queue/status is a compact workbench.
Lumist has no live-debate equivalent; this adopts invitation and asynchronous recovery behavior only.

Partially fork the visible credential + guarded copy handler from `app-lumist-ai/features/challenge/components/ChallengeLobby.tsx:82-89,140-154`; preserve a selectable URL beside Copy and report success only after clipboard resolution. Adapt the request/action version invalidation from `features/challenge/components/ChallengeInviteInboxDialog.tsx:45-74,204-231` to ignore queue/AI results after cancellation or leaving. The explicit submission guard from `ChallengeInviteConfirmDialog.tsx:49-67,82-123` informs the sole explicit AI action.

## Reference extraction before implementation
Viewed Mobbin's real web screenshots, Navan [invite link](https://mobbin.com/screens/d504fcc0-e338-499e-881c-209a22feb2b0) and Slite [invite teammates](https://mobbin.com/screens/1c57f1f3-5e23-49b2-ad6a-c4cba92bd9c4). Navan is the selected supporting reference: a landscape desktop capture (768x537 delivered pixels, not measured CSS viewport) with one centered dialog, heading, short success/context block, and one full-width URL row with adjacent Copy. The link is visually persistent; copy feedback is separate. Slite adds contact/email methods unnecessary here.

Native mapping: retain Thinkfy page context and QR, use PageContainer, Input, Button, existing icon barrel. One URL row (stack at small widths), 2-line maximum helper blocks where feasible, participant rows with identity and readiness. Native spacing 2/3/4/6, rounded-control (12px) for fields/panels; semantic surface/on-surface/outline-variant/primary roles. Use existing type-caption/body/title/heading utilities. No copied palette, font, branding, floating modal shell, emails or contact imports. Screenshot pixel type sizes are not CSS measurements and are not claimed as such.

Hierarchy: motion/context first, participant identity and readiness next, visible invitation credential and one dominant role-specific action. Human queue promises human matching; AI appears only as an optional, explicitly priced immediate-start action after a wait. Cancel remains visible. Existing topic text and practice language remain distinct from interface translations.

Primitives cover all controls; none missing. No new design tokens required. Compare EN/VI and light/dark at 1280x720,1440x900,768x1024,390x844. Require document scrollWidth <= clientWidth. Record capture limitations honestly.

## Final native adaptation
Lumist source checkout inspected at `73875b1267cb3a6e36a82af2cd1469285a57e9e1`. The final lobby uses a two-column native layout (flexible main plus 360px round preview, stacked below 1024px). The persistent URL has its own labelled line, with selectable room code and Copy beneath it so both credentials fit on phones. QR remains adjacent on wider screens. This deliberately differs from Navan's modal and avoids squeezing the URL and two actions into one small row.

Duplicated readiness summaries, ambient illustrations, and the unsupported “microphone permissions ready” claim were removed. Actual participant readiness is the only readiness signal. Active queue uses compact metadata rows and a small timer rather than decorative imagery. No microphone implementation was touched.
