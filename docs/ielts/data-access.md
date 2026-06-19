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

## 8. The IELTS question bank: one canonical table (`ielts_questions`)

`ielts_questions` is THE canonical question bank for the IELTS vertical. Every
surface references questions **by id** — timed Assess-mode mocks
(`ielts_question_responses.question_id`, `writing_responses.question_id`,
`speaking_responses.question_id`) and future Learn-mode drills alike. One bank,
many surfaces.

- **Never re-encode questions inline.** Do not copy IELTS items into
  `activities.content` (the debate engine's inline JSON) or any other table. An
  IELTS activity may *point at* `ielts_questions` by id, but the prompt, options,
  visual, and answer key live only in `ielts_questions` / `ielts_question_keys`.
- **Never expose answer keys to learners.** Correct answers, accept-variants,
  explanations, and the Band-9 model answer live in `ielts_question_keys`, which
  has **no learner-readable RLS policy**; grading reads it with the service-role
  client, server-side only.
- **One canonical create path.** Author an item through the single
  `lib/api/ielts` create function — `parseInput` (Zod) then a single insert that
  writes the question and its key row together (one transaction / RPC). No inline
  inserts; no divergent second path.
- **Progress & XP union both attempt substrates.** A learner's IELTS
  progress / XP / streak is the union of `activity_attempts` (Learn-mode
  micro-activities) **and** `ielts_attempts` (Assess-mode mocks). Never assume a
  single attempts table when aggregating IELTS progress.

## 9. Evolving the IELTS enums

The IELTS taxonomy uses **native Postgres enums** (`ielts_skill`,
`ielts_question_type`, `ielts_module`, …) — a deliberate deviation from the
repo's text+CHECK convention, because native enums surface real string-unions in
the generated `Database` type (genuine "typed end-to-end"). The value-sets are
closed and stable, so this is cheap to live with. To change one:

- **Add a value** in a *new* migration:
  `alter type public.ielts_question_type add value if not exists 'new_type';`
  `ALTER TYPE … ADD VALUE` cannot be used in the **same** transaction that then
  references the new value, and Supabase wraps each migration in a transaction —
  so add the value in its own migration and reference it only in a *later* one.
- **Rename / remove a value** — there is no `DROP VALUE`; renaming requires
  recreating the type (new type → swap columns → drop old). Avoid it; prefer
  additive evolution and deprecate in-app.
- After any enum change, **regenerate types** (`npm run db:types`) and keep the
  Zod enum tuples in `lib/api/ielts/schema.ts` + the authoring spec (§4) + the
  WS-1.2 renderer registry in sync.
