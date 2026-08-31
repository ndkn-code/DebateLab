import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const localeAppDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "[locale]"
);

const readLocaleAppFile = (relativePath: string) =>
  readFileSync(resolve(localeAppDirectory, relativePath), "utf8");

const localeLayout = readLocaleAppFile("layout.tsx");
const localizedProviders = readLocaleAppFile("localized-app-providers.tsx");

assert.match(
  localeLayout,
  /<LocalizedAppProviders>\{children\}<\/LocalizedAppProviders>/,
  "the locale layout must own the shared provider boundary"
);
assert.equal(
  (localizedProviders.match(/<FaroProvider>/g) ?? []).length,
  1,
  "the shared provider boundary must mount Faro exactly once"
);

for (const nestedPath of [
  "(protected)/layout.tsx",
  "auth/layout.tsx",
  "dev/layout.tsx",
  "onboarding/layout.tsx",
  "maintenance/page.tsx",
]) {
  assert.doesNotMatch(
    readLocaleAppFile(nestedPath),
    /LocalizedAppProviders|<FaroProvider>/,
    `${nestedPath} must not add a duplicate provider boundary`
  );
}

console.log("locale provider boundary tests passed");
