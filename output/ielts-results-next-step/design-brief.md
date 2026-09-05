# IELTS results composition brief

Results are momentum; detailed review remains workbench. Adapt mode.

Reference: Mobbin Codecademy quiz completion screen d5bb01b9-4ee9-4537-9e5b-25e67dea0e89 (768×521 supplied preview). One centered content column, title then score/progress, one Continue action; no competing navigation grid. The preview is scaled so precise upstream CSS dimensions are not inferred.

Thinkfy mapping: existing PageContainer data width for the split review; action row immediately below the header, wrapping at mobile. Title 24px type-heading-lg, metadata/body 14px type-body-sm, action uses existing Button lg (36px). Gaps 4/8/12/20/24px, existing rounded-control 12px for controls. Canvas background, ink on-surface, metadata on-surface-variant, primary only for next step. No new tokens or illustrations. Existing BandGauge and BandMeter stay authoritative; no duplicated score summary.

Adapt Lumist result/page.tsx contextual study-plan/next-resource/fallback decision and RecapActionButtons conditional Review + Continue composition. Thinkfy selects existing study plan or authorized assigned-work card, not an invented next resource or weak skill. Use links rather than fetch/router effects because destinations are already known server-side. Preserve attempt id on resume. Review is a secondary anchor into the existing workbench. Buttons wrap on narrow Vietnamese screens. No branding, exam content, fixed footer, oversized buttons, reward XP or extra API copied.

Inventory: PageContainer, ProductPageShell, Button with render Link, existing BandGauge/BandMeter, ResultsReviewTabs. No missing primitive.

Checks: EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844; verify actual components in controlled synthetic fixture if authenticated route unavailable. Live entry observed middleware 504 in dedicated Ego space 75; no claim of live IELTS renderer reproduction.
