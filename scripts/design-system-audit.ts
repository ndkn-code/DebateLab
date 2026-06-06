import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const scanRoots = ["apps/web/src", "apps/mobile/src", "apps/mobile/app.config.js", "packages/shared/src"];
const approvedPathFragments = [
  "packages/shared/src/design-system/",
  "apps/web/src/components/shared/theme-variables.tsx",
  "apps/web/src/app/globals.css",
  "apps/web/src/app/icon.svg",
  "apps/web/src/app/email/unsubscribe/route.ts",
  "apps/web/src/lib/email/templates.tsx",
  "apps/web/src/lib/settings.ts",
  "apps/web/src/lib/dev-admin-bypass.ts",
  "apps/web/src/lib/analytics/skill-metadata.ts",
  "apps/web/src/components/courses/course-artwork.tsx",
  "apps/web/src/components/analytics/analytics-page.tsx",
  "apps/web/src/app/[locale]/auth/login/page.tsx",
  "apps/web/src/components/admin/overview/",
  "apps/web/src/components/admin/users/UserAnalyticsDashboard.tsx",
  "apps/web/src/components/admin/clubs/ClubDetailDashboard.tsx",
  "apps/web/src/components/admin/clubs/ClubSchedulePanel.tsx",
  "apps/web/src/components/admin/feedback-popups/FeedbackPopupsDashboard.tsx",
  "apps/web/src/components/admin/users/UserAccessDashboard.tsx",
  "apps/web/src/components/courses/course-card.tsx",
  "apps/web/src/components/courses/course-detail-content.tsx",
  "apps/web/src/components/courses/renderers/",
  "apps/web/src/components/dashboard/",
  "apps/web/src/components/debates/",
  "apps/web/src/components/feedback/",
  "apps/web/src/components/landing/",
  "apps/web/src/components/onboarding/",
  "apps/web/src/components/practice/",
  "apps/web/src/components/profile/",
  "apps/web/src/components/settings/settings-content.tsx",
  "apps/web/src/components/shared/mini-score-ring.tsx",
  "apps/web/src/lib/feedback/annotations.ts",
  "apps/web/src/lib/practice-feedback-plan.test.ts",
  "apps/web/src/components/chat/chat-bubble.tsx",
  "apps/mobile/src/design/tokens.ts",
  "apps/mobile/app.config.js",
  "apps/mobile/src/lib/dashboard-preview.ts",
];

const approvedExtensions = new Set([".svg"]);
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".svg"]);

const tokenClassPattern =
  /(?:bg|text|border|ring|from|to|via|shadow|fill|stroke)-\[#(?:[0-9a-fA-F]{3,8})(?![0-9A-Za-z_-])\]|(?:bg|text|border|ring|from|to|via|fill|stroke)-\[rgba\([^\]]+\)\]|#[0-9a-fA-F]{3,8}(?![0-9A-Za-z_-])|rgba\([^)]*\d[^)]*\)/g;
const legacyPrimaryPattern =
  /#(?:4D86F7|3E78EC|A9C6FB|11845F|20C997|0E7A58|075C45|A8F0D7)|rgba\(\s*(?:77\s*,\s*134\s*,\s*247|62\s*,\s*120\s*,\s*236|169\s*,\s*198\s*,\s*251|17\s*,\s*132\s*,\s*95|32\s*,\s*201\s*,\s*151|14\s*,\s*122\s*,\s*88|7\s*,\s*92\s*,\s*69)\b|(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:blue|indigo|violet|purple)-[0-9]{2,3}(?:\/[0-9]{1,3})?/gi;

type Violation = {
  file: string;
  line: number;
  match: string;
  text: string;
};

function isApproved(file: string) {
  const normalized = file.split(path.sep).join("/");
  if (approvedExtensions.has(path.extname(file))) return true;
  return approvedPathFragments.some((fragment) => normalized.includes(fragment));
}

function walk(target: string): string[] {
  const absolute = path.join(repoRoot, target);
  const stats = statSync(absolute);

  if (stats.isFile()) return [absolute];

  return readdirSync(absolute).flatMap((entry) => {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") {
      return [];
    }
    return walk(path.join(target, entry));
  });
}

const files = scanRoots
  .flatMap(walk)
  .filter((file) => scannedExtensions.has(path.extname(file)))
  .filter((file) => !isApproved(path.relative(repoRoot, file)));

const violations: Violation[] = [];
const legacyViolations: Violation[] = [];

const allScannedFiles = scanRoots
  .flatMap(walk)
  .filter((file) => scannedExtensions.has(path.extname(file)));

for (const file of allScannedFiles) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((text, index) => {
    for (const match of text.matchAll(legacyPrimaryPattern)) {
      legacyViolations.push({
        file: path.relative(repoRoot, file),
        line: index + 1,
        match: match[0],
        text: text.trim(),
      });
    }
  });
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((text, index) => {
    for (const match of text.matchAll(tokenClassPattern)) {
      violations.push({
        file: path.relative(repoRoot, file),
        line: index + 1,
        match: match[0],
        text: text.trim(),
      });
    }
  });
}

if (legacyViolations.length > 0) {
  console.error(`Design-system audit found ${legacyViolations.length} legacy blue/purple primary values.`);
  for (const violation of legacyViolations.slice(0, 80)) {
    console.error(`${violation.file}:${violation.line} ${violation.match} :: ${violation.text}`);
  }
  if (legacyViolations.length > 80) {
    console.error(`...and ${legacyViolations.length - 80} more.`);
  }
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`Design-system audit found ${violations.length} raw color/style values outside approved token or palette files.`);
  for (const violation of violations.slice(0, 80)) {
    console.error(`${violation.file}:${violation.line} ${violation.match} :: ${violation.text}`);
  }
  if (violations.length > 80) {
    console.error(`...and ${violations.length - 80} more.`);
  }
  process.exit(1);
}

console.log("Design-system audit passed: no raw colors outside approved token or palette files.");
