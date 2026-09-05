# Settings workbench — reference extraction before implementation

Mobbin references inspected inline 2026-09-05:
- Magnific: https://mobbin.com/screens/23106449-1ff8-48cf-a9ce-5e37b21ef503
- Otter AI: https://mobbin.com/screens/a694ecdf-dc37-4f2c-bafa-addf3158b75c

The reference images are 768px-wide scaled desktop captures; exact CSS dimensions cannot be inferred. Magnific groups profile fields above System preferences, with Language and Theme side by side. Otter uses aligned label/help/control rows. Adopt that grouping and visible controls, not a pixel clone. Existing Thinkfy settings grid, PageContainer and spacing remain the sizing authority at all four required viewports. On small screens stack labeled controls and wrap action text. Essential actions remain visible.

Hierarchy: section heading, field label, muted explanation, control. Neutral canvas and outline, primary for the save action. Map all text to existing type utilities, fields to Input/Select, actions to Button, surface and separators to existing semantic tokens. No new tokens or radii. Do not copy either app's brand, sidebars, avatars, billing or security controls. This change adds functional recovery rather than a new composition.

Lumist source inspected: components/dialogs/EditProfileModal.tsx:303-360 uses localized success/failure, finally clears pending state, and refreshes after confirmed update. Partially fork that behavioral sequence into existing Thinkfy server-action persistence; retain draft on failure and suppress raw backend text. features/auth/services/server/account-profile.service.ts:24-43 validates input server-side before persistence; retain Thinkfy's existing profile validation and ownership checks, return stable localized error codes. No Lumist styling or APIs copied.
