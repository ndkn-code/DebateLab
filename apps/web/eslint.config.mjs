import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Use the governed ProductIcon registry from @/components/ui/icons instead.",
            },
          ],
          patterns: [
            {
              group: ["@phosphor-icons/react", "@phosphor-icons/react/*"],
              message:
                "Import Phosphor only inside src/components/ui/product-icon.tsx.",
            },
          ],
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
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".claude/**",
    "logs/**",
    "qa-artifacts/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
