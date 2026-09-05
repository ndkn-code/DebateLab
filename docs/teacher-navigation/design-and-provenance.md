# Teacher navigation — workbench

## Reference extraction and decision (before implementation)

The authenticated Lumist capture `03-lumist-manager-progress.png` is a real app at
1494 × 981 CSS pixels. Its left column is about 255px; a 60px organization header
anchors the workspace. Menu groups have short labels, about 44px rows, quiet icons,
and nested class shortcuts. The main column begins about 288px from the left.
Position and spacing distinguish Command, People and Content; neutral surfaces,
muted text, and one selected row provide hierarchy. There are no decorative cards
in navigation. A class child replaces its parent as the selected location.

Inspected actual source: `app-lumist-ai/features/manager-dashboard/components/ManagerSidebar.tsx`
and `ManagerSidebarConfig.ts` at upstream commit
`bb85a06ff1e06524cb562a0a4c0c23fe05fbdb5d`
(https://github.com/lumist-ai/app-lumist-ai). Adapt the group/filter/map structure, nested class
shortcuts, mutually exclusive parent/child selection, and close-after-navigation
callback. This is user-authorized partial reuse, not a claim that Lumist is MIT.
Do not copy branding, icons, CSS literals, English taxonomy, or its 9-item manager
content inventory.

Mobbin research: Descript places workspace identity above everyday links and a
separate tools group; Coda uses a named workspace, direct document shortcuts and
bottom utilities. Inspected returned images, not just metadata:
- https://mobbin.com/screens/ea11b53d-998a-4a3d-b750-f5f289253833
- https://mobbin.com/screens/ba6f5461-ff84-4795-b8f6-a11d5a7526a9

## Thinkfy mapping

- Keep the existing rail, Sheet and Base UI dropdown primitives. Reuse the
  Beautiful UI sidebar's min-height, independently scrolling middle and pinned
  utilities composition, already adapted in `components/beautifului/sidebar-nav.tsx`.
- Teacher rail: 256px desktop, at most viewport minus 32px mobile. Logo and explicit
  role selector at top; organization name and actual membership role below.
- Groups: Teaching (calendar, classes, attendance, class announcements), Assignments
  (work to review, assignments, gradebook), Preparation (materials), Center (only
  server-authorized tools). 40px minimum rows, 20px icons, 8px row radius, 8/12/16px
  spacing, type-label navigation and type-caption group/context labels.
- One active page link. Role selection is a dropdown check, never `aria-current`.
  Child class pages select the corresponding shortcut, otherwise the class list.
- Class shortcuts appear under My classes. Browser-session visits rank recent
  classes first; authorized alphabetical candidates fill unused slots. Intersect
  stored IDs with current server access and keep the active class in view.
- Short localized labels: “Bài cần chấm”, “Thông báo lớp”, “Trung tâm”. The personal
  notification control remains “Thông báo”. Language shows full endonyms rather
  than Debate · VI. Known subject name translated to “Tranh biện”.
- All surfaces use existing semantic colors and typography, no new tokens.
  Selected row uses surface-container-high/on-surface. No ambient accent fill.
- Role switch keeps a last visited teacher route/query in this browser session;
  each server route still enforces access. Explicit learner entry must survive the
  dashboard auto-redirect. Language switching retains path, query and fragment.
- Mobile opens from the same top-left labeled menu on all roles, closes after
  selection and includes a visible close action. Essential tools scroll inside
  the menu on short viewports; they are never clipped by overflow-hidden.

## Verification required

EN/VI × light/dark at 1280×720, 1440×900, 768×1024 and 390×844. Check route/query,
role transitions, exact active item, unauthorized/empty navigation, long class
names, keyboard menus and no horizontal document overflow. Run all four UI gates
and affected teacher/navigation suites. Record observed limits honestly.
