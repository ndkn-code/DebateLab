/**
 * Reports roles whose `globals.css` fallback disagrees with the value `tokens.ts` emits
 * at runtime.
 *
 * Both layers ship. `ThinkfyThemeVariables` emits tokens.ts into `:root` / `.dark`, which
 * wins for `var()`; the declarations in globals.css are what Tailwind bakes into literals,
 * including every opacity modifier. Where the two disagree, one role renders two different
 * colors depending on how it is referenced. See design.md §Color System.
 *
 * globals.css declares each theme across SEVERAL blocks and later declarations win, so this
 * resolves the whole cascade rather than reading the first block it finds.
 *
 *   npx tsx scripts/design-token-drift.ts
 */
import { readFileSync } from "node:fs";
import { getThinkfyWebCssVariables } from "../packages/shared/src/design-system/tokens";

type Mode = "light" | "dark";

const CSS = readFileSync("apps/web/src/app/globals.css", "utf8");

/** Every `<selector> { … }` body whose selector matches, in source order. */
function blocks(pattern: RegExp) {
  const out: string[] = [];
  for (const m of CSS.matchAll(pattern)) {
    const open = CSS.indexOf("{", m.index!);
    let depth = 0;
    for (let i = open; i < CSS.length; i++) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}" && --depth === 0) {
        out.push(CSS.slice(open + 1, i));
        break;
      }
    }
  }
  return out;
}

/** Last declaration wins, matching the CSS cascade at equal specificity. */
function resolve(mode: Mode) {
  const source =
    mode === "light"
      ? blocks(/(?:^|\n)\s*(?:@theme[^{]*|:root)\s*\{/g)
      : blocks(/(?:^|\n)\s*\.dark\s*\{/g);

  const declared = new Map<string, string>();
  for (const body of source) {
    for (const m of body.matchAll(/(--color-[a-z0-9-]+):\s*([^;]+);/g)) {
      declared.set(m[1], m[2].trim());
    }
  }
  return declared;
}

function check(mode: Mode) {
  const expected = getThinkfyWebCssVariables(mode) as Record<string, string>;
  const declared = resolve(mode);

  const drift: string[] = [];
  for (const [role, value] of Object.entries(expected)) {
    if (!role.startsWith("--color-")) continue;
    const fallback = declared.get(role);
    if (fallback === undefined) continue;
    if (fallback.toLowerCase() !== String(value).toLowerCase()) {
      drift.push(`  ${role}\n    globals.css: ${fallback}\n    tokens.ts:   ${value}`);
    }
  }

  console.log(`\n[${mode}] ${drift.length} drifted of ${declared.size} declared`);
  if (drift.length) console.log(drift.join("\n"));
  return drift.length;
}

const total = check("light") + check("dark");
console.log(
  total === 0
    ? "\nNo drift: every declared fallback matches the emitted token."
    : `\n${total} role(s) drift. See docs/design-system-followups.md.`,
);
