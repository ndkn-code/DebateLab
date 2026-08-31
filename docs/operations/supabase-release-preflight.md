# Supabase release preflight

The web application and Supabase schema are released separately. A web deploy
must not run until the target database has every repository migration.

The web package also runs a production-only Debate Chat build preflight
automatically. It probes the public Supabase REST contract using the anon key
and fails the production build when the coach table column is missing. This is
not a complete migration check: it does not prove the IELTS RPCs or
`ai_coach_turns` table from the same migration are ready. The sidebar RPC is
intentionally not probed from the browser-safe key because this migration
revokes execute from `anon`; the CLI dry-run remains the check for the complete
migration set and is mandatory before production deployment. It does not read
or send a service-role secret, and it skips local and preview builds.

Run the read-only gate from the repository before a production release:

```sh
SUPABASE_DB_URL='postgresql://…' npm run release:preflight
```

Alternatively, link the intended Supabase project first and omit
`SUPABASE_DB_URL`:

```sh
supabase link --project-ref <production-project-ref>
npm run release:preflight
```

If the gate reports pending migrations, review and apply them in the approved
database change window, then run the gate again before starting the Vercel
deploy. The gate uses `supabase db push --dry-run` and never applies changes.

For the 20260830070000 coach-product-context migration specifically, verify the
database exposes `chat_conversations.product_context` and
`get_chat_sidebar_payload(text)` after the migration completes. This migration
is a separate production action and is not applied by this repository change.
