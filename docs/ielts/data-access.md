# Data access & the quality bar (WS-0.1)

This is the contract every IELTS workstream (and ideally all new code) follows.
It operationalizes masterplan §2. CI enforces it — see `.github/workflows/ci.yml`.

## 1. Typed clients

Generated DB types live in `apps/web/src/types/supabase.ts` (the `Database`
type). **New code must use the typed client factories**, which wire the
`<Database>` generic so every `from()/insert()/update()/rpc()` is schema-checked:

| Context | Use |
|---|---|
| Server actions, route handlers, RSC loaders (`lib/api`) | `createTypedServerClient()` from `@/lib/supabase/server` |
| Client components | `createTypedBrowserClient()` from `@/lib/supabase/client` |
| Service-role / server-only jobs | `createTypedAdminClient()` from `@/lib/supabase/admin` |

The legacy untyped `createClient()` / `createAdminClient()` remain **only** for
existing debate call-sites. They are migrated lazily in their own cards — adding
the generic to the shared factory today breaks 111 pre-existing type errors, so
new typed factories are additive and risk-free. Do **not** add new code on the
untyped factories.

Regenerate types after any migration:

```bash
# one-time: supabase login && supabase link --project-ref <ref>
npm run db:types        # regenerates apps/web/src/types/supabase.ts
npm run db:types:check  # local drift check (skips if not linked)
```

(The `supabase-debatelab` MCP `generate_typescript_types` is the fallback used
when the CLI isn't linked.)

## 2. Reads go through `lib/api` (no inline queries in pages/components)

Pages and components must not call `supabase.from(...)` / `.rpc(...)` inline.
Reads belong in a `lib/api/*` repository; mutations in `app/actions/*`. The
`scripts/ci/checks/no-inline-supabase.ts` gate enforces this for `app/**` and
`components/**`. Pre-existing violators are grandfathered in an allowlist inside
that script; **the allowlist only shrinks** — new violations fail CI.

## 3. Zod at every boundary; one canonical create path per entity

Every server action / route handler validates external input through a Zod
schema via `parseInput` (`@/lib/api/boundary.ts`) before touching the data
layer:

```ts
import { z } from "zod";
import { parseInput } from "@/lib/api/boundary";

const CreateWritingResponseSchema = z.object({
  attemptId: z.string().uuid(),
  essay: z.string().min(1).max(20_000),
});

export async function createWritingResponse(raw: unknown) {
  const input = parseInput(CreateWritingResponseSchema, raw); // typed or 400
  const supabase = await createTypedServerClient();
  // ...single canonical insert for this entity lives here...
}
```

**One canonical create path per entity.** Each entity (e.g.
`writing_responses`) has exactly one function that inserts it, owning
validation + invariants. No divergent insert paths — duels' history of drift is
what this prevents.

## 4. RLS on every new table, from day one

Every new `public` table ships with `ENABLE ROW LEVEL SECURITY` **and** at least
one policy in the same migration. `scripts/ci/checks/rls-coverage.ts` scans all
migrations and fails CI on any table that enables RLS without a policy (a silent
deny-all) or creates a table without enabling RLS. Use
`npm run rls:audit:live` for an authoritative pg_catalog check against a branch
during schema work (WS-0.3).

## 5. Typed columns for structured data (no untyped `Json` scores)

Score/band columns must be typed columns (numeric / typed composite), never
`json`/`jsonb`. `scripts/ci/checks/score-columns.ts` flags `*score*` / `*band*`
columns declared as `json`/`jsonb` in migrations.

## 6. Bounded files (new code)

`max-lines` / `complexity` / `no-explicit-any` are enforced (ESLint) on new
code paths (`lib/ielts/**`, `lib/scoring/**`, `lib/payments/**`,
`lib/api/ielts*/**`). Keep modules small and split by responsibility.

## 7. Tested; scoring & payments have coverage thresholds

Unit/integration tests run in CI via `npm test`. `src/lib/scoring/**` and
`src/lib/payments/**` additionally must meet coverage thresholds
(`npm run test:coverage:critical`) — enforced with Node's native V8 test
coverage (lines ≥90%, functions ≥90%, branches ≥80%), source-mapped through
tsx, no extra dependency. A scoring/payments module without a sibling
`*.test.ts` also fails the gate ("missing test" cannot merge).
