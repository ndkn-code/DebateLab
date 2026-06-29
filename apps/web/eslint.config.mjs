import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── Shared no-restricted-imports building blocks ──────────────────────────
// Flat config REPLACES (does not merge) a rule's options for matching files,
// so the scoped IELTS block below re-composes these rather than relying on the
// global block to still apply.
const lucidePath = {
  name: "lucide-react",
  message:
    "Use the governed ProductIcon registry from @/components/ui/icons instead.",
};

// Ban raw Supabase client *constructors* everywhere except lib/supabase/*.
const rawSupabaseConstructorPaths = [
  {
    name: "@supabase/ssr",
    importNames: ["createBrowserClient", "createServerClient"],
    message:
      "Don't construct Supabase clients directly. Use createTypedServerClient/createTypedBrowserClient from @/lib/supabase. (see docs/ielts/data-access.md)",
  },
  {
    name: "@supabase/supabase-js",
    importNames: ["createClient"],
    message:
      "Don't construct Supabase clients directly. Use createTypedAdminClient from @/lib/supabase/admin. (see docs/ielts/data-access.md)",
  },
];

const phosphorPattern = {
  group: ["@phosphor-icons/react", "@phosphor-icons/react/*"],
  message: "Import Phosphor only inside src/components/ui/product-icon.tsx.",
};

// New IELTS/scoring/payments code must use the TYPED factories. Banning the
// untyped wrappers closes the silent gap: an untyped client returns inferred
// `any`, which `no-explicit-any` cannot catch.
const untypedFactoryPaths = [
  {
    name: "@/lib/supabase",
    importNames: [
      "createClient",
      "createServerClient",
      "createBrowserClient",
      "createAdminClient",
    ],
    message:
      "IELTS/scoring/payments code must use createTyped{Server,Browser,Admin}Client() (they carry <Database>). The untyped createClient() is for legacy debate code only.",
  },
  {
    name: "@/lib/supabase/client",
    importNames: ["createClient", "createBrowserClient"],
    message: "Use createTypedBrowserClient() — it carries <Database>.",
  },
  {
    name: "@/lib/supabase/server",
    importNames: ["createClient", "createServerClient"],
    message: "Use createTypedServerClient() — it carries <Database>.",
  },
  {
    name: "@/lib/supabase/admin",
    importNames: ["createClient", "createAdminClient", "tryCreateAdminClient"],
    message: "Use createTypedAdminClient() — it carries <Database>.",
  },
];

// New, strict-by-construction code paths (IELTS feature surface).
const ieltsFiles = [
  "src/lib/ielts/**/*.{ts,tsx}",
  "src/lib/scoring/**/*.{ts,tsx}",
  "src/lib/payments/**/*.{ts,tsx}",
  "src/lib/api/ielts*/**/*.{ts,tsx}",
  "src/lib/api/ielts*.{ts,tsx}",
  "src/components/ielts/**/*.{ts,tsx}",
  "src/app/**/ielts/**/*.{ts,tsx}",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [lucidePath, ...rawSupabaseConstructorPaths],
          patterns: [phosphorPattern],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/product-icon.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Sanctioned places that legitimately construct a raw Supabase client.
    // Grandfathered at WS-0.1 — new code must use the typed factories instead.
    files: [
      "src/lib/supabase/**",
      "src/lib/seed/**",
      "src/lib/api/request-auth.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // WS-0.1 quality bar for NEW IELTS/scoring/payments code: bounded, fully
    // typed, and forced onto the typed Supabase factories.
    files: ieltsFiles,
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 15],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            lucidePath,
            ...rawSupabaseConstructorPaths,
            ...untypedFactoryPaths,
          ],
          patterns: [phosphorPattern],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".claude/**",
    "logs/**",
    "qa-artifacts/**",
    "out/**",
    "build/**",
    // Vendored bklit ChartKit internals are governed through design-system
    // audit tokens while the app migrates analytics surfaces onto the wrapper.
    "src/components/charts/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
