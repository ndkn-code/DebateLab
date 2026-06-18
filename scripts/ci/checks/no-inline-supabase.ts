/**
 * Inline-query ban (WS-0.1). Reads belong in `lib/api`, not in pages/components.
 *
 * Flags any file under `app/**` (excluding route handlers + `app/actions/**`)
 * or `components/**` that imports a Supabase client AND calls `.from(`/`.rpc(`
 * inline. Pre-existing call-sites are grandfathered in ALLOWLIST (ratchet: the
 * list only shrinks — migrate them into lib/api in their own cards).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface InlineQueryViolation {
  file: string;
}

// Grandfathered pre-existing inline-query files (relative to apps/web/src),
// captured from the tree at WS-0.1. RATCHET: only remove entries (migrate the
// read into lib/api), never add. New inline queries in pages/components fail CI.
export const ALLOWLIST = new Set<string>([
  "app/[locale]/(protected)/courses/[slug]/page.tsx",
  "app/[locale]/(protected)/courses/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/courses/[courseId]/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/courses/[courseId]/settings/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/courses/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/duels/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/layout.tsx",
  "app/[locale]/(protected)/dashboard/admin/motions/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/ui-showcase/page.tsx",
  "app/[locale]/(protected)/dashboard/admin/users/page.tsx",
  "app/[locale]/(protected)/dashboard/courses/[courseId]/activity/[activityId]/page.tsx",
  "app/[locale]/(protected)/dashboard/courses/[courseId]/page.tsx",
  "app/[locale]/(protected)/layout.tsx",
  "app/[locale]/(protected)/practice/practice-client.tsx",
  "app/[locale]/(protected)/practice/session/page.tsx",
  "app/[locale]/(protected)/settings/page.tsx",
  "app/[locale]/auth/login/page.tsx",
  "app/[locale]/localized-app-providers.tsx",
  "app/[locale]/onboarding/layout.tsx",
  "components/admin/overview/OverviewDashboard.tsx",
  "components/onboarding/onboarding-modal.tsx",
  "components/onboarding/welcome-banner.tsx",
  "components/profile/title-select-modal.tsx",
]);

const SUPABASE_IMPORT =
  /from\s+["']@\/lib\/supabase\/(?:client|server|admin)["']/;
const INLINE_CALL =
  /(?:\bsupabase\b|create(?:Typed)?\w*Client\(\))\s*\.\s*(?:from|rpc)\s*\(/;

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function isScanned(rel: string): boolean {
  // Sanctioned mutation/boundary layers may use a client directly.
  if (rel.includes("app/api/")) return false; // route handlers
  if (rel.includes("app/actions/")) return false; // canonical server actions
  if (/(?:^|\/)actions\.tsx?$/.test(rel)) return false; // co-located actions
  if (/(?:^|\/)route\.ts$/.test(rel)) return false;
  if (/\.test\.tsx?$/.test(rel)) return false;
  return true;
}

export function findInlineQueryViolations(
  baseDir: string,
  roots: string[] = ["app", "components"],
): InlineQueryViolation[] {
  const violations: InlineQueryViolation[] = [];
  for (const root of roots) {
    for (const abs of walk(path.join(baseDir, root))) {
      const rel = path.relative(baseDir, abs).split(path.sep).join("/");
      if (!isScanned(rel)) continue;
      const src = readFileSync(abs, "utf8");
      if (SUPABASE_IMPORT.test(src) && INLINE_CALL.test(src)) {
        violations.push({ file: rel });
      }
    }
  }
  return violations;
}

function isMain(): boolean {
  return (
    !!process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isMain()) {
  const baseDir = path.join(process.cwd(), "apps/web/src");
  const violations = findInlineQueryViolations(baseDir).filter(
    (v) => !ALLOWLIST.has(v.file),
  );
  if (violations.length > 0) {
    console.error(
      `Inline Supabase query ban: ${violations.length} new violation(s) in pages/components:`,
    );
    for (const v of violations) console.error(`  - ${v.file}`);
    console.error(
      "\nMove the read into a lib/api repository (see docs/ielts/data-access.md).",
    );
    process.exit(1);
  }
  console.log(
    "Inline Supabase query ban: no new inline queries in pages/components.",
  );
}
