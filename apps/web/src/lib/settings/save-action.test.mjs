import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);
const output = await build({
  entryPoints: [
    path.join(
      root,
      "apps/web/src/app/[locale]/(protected)/settings/actions.ts",
    ),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  tsconfig: path.join(root, "apps/web/tsconfig.json"),
  plugins: [
    {
      name: "settings-test-dependencies",
      setup(b) {
        b.onResolve(
          { filter: /^(next\/headers|next\/cache|@\/lib\/supabase\/server)$/ },
          (args) => ({ path: args.path, namespace: "mock" }),
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: p }) => ({
          contents:
            p === "next/headers"
              ? "export const cookies = async () => ({set(){}})"
              : p === "next/cache"
                ? "export const revalidatePath = () => {}"
                : "export const createClient = async () => globalThis.__settingsTestClient",
          loader: "js",
        }));
      },
    },
  ],
});
const mod = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(
  createRequire(import.meta.url),
  mod,
  mod.exports,
);
const { saveSettingsWithFeedback: saveSettings } = mod.exports;
const draft = {
  displayName: "Teacher",
  handle: "teacher.qa",
  profileStatus: "",
  avatarUrl: "",
  preferredLocale: "vi",
  defaultDifficulty: "medium",
};
function client({
  user = true,
  readError = null,
  profile = { preferences: { unknown_saved_setting: "keep" } },
  updateError = null,
  privacyError = null,
} = {}) {
  const writes = [];
  globalThis.__settingsTestClient = {
    auth: {
      getUser: async () => ({
        data: { user: user ? { id: "owner-id" } : null },
      }),
    },
    from(table) {
      let op = "read",
        payload;
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          assert.equal(key, op === "read" ? "id" : "id");
          assert.equal(value, "owner-id");
          return q;
        },
        single: async () => ({ data: profile, error: readError }),
        update(p) {
          op = "update";
          payload = p;
          return q;
        },
        upsert: async (p) => {
          assert.equal(p.user_id, "owner-id");
          writes.push({ table, payload: p });
          return { error: privacyError };
        },
        then(resolve, reject) {
          writes.push({ table, payload });
          return Promise.resolve({ error: updateError }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return writes;
}
let writes = client({ user: false });
assert.deepEqual(await saveSettings(draft), { error: "not_authenticated" });
assert.equal(writes.length, 0);
writes = client({ readError: { message: "secret database detail" } });
assert.deepEqual(await saveSettings(draft), { error: "save_failed" });
assert.equal(writes.length, 0);
writes = client({ profile: null });
assert.deepEqual(await saveSettings(draft), { error: "save_failed" });
assert.equal(writes.length, 0);
writes = client({ updateError: { code: "23505" } });
assert.deepEqual(await saveSettings(draft), { error: "handle_taken" });
assert.equal(writes.length, 1);
writes = client({ privacyError: { message: "secret" } });
assert.deepEqual(await saveSettings(draft), { error: "save_failed" });
writes = client();
const result = await saveSettings(draft);
assert.ok(result.saved);
assert.equal(writes[0].payload.preferences.unknown_saved_setting, "keep");
assert.equal(writes[0].payload.preferences.preferred_locale, "vi");
assert.equal(writes.length, 2);
assert.deepEqual(await saveSettings({ ...draft, handle: "!" }), {
  error: "invalid_handle",
});
delete globalThis.__settingsTestClient;
console.log(
  "Settings save action: auth, validation, error privacy, saved preference preservation passed",
);
