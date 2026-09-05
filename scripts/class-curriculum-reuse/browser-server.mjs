/** Local-only acceptance server. Uses real UI code and the new PostgreSQL RPCs.
 * Never connects to Supabase or a remote database. Run after integration fixture setup.
 */
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(root, "output/class-curriculum-reuse/browser");
mkdirSync(output, { recursive: true });
await build({
  entryPoints: [
    path.join(root, "scripts/class-curriculum-reuse/browser-entry.tsx"),
  ],
  bundle: true,
  outfile: path.join(output, "app.js"),
  platform: "browser",
  format: "esm",
  jsx: "automatic",
  tsconfig: path.join(root, "apps/web/tsconfig.json"),
  define: { "process.env.NODE_ENV": '"development"' },
});
const cssPath = path.join(root, "apps/web/src/app/globals.css");
const css = await postcss([
  tailwind({ base: path.join(root, "apps/web") }),
]).process(readFileSync(cssPath, "utf8"), { from: cssPath });
writeFileSync(path.join(output, "app.css"), css.css);
const actor = "70000000-0000-4000-8000-000000000001";
const psql = "/opt/homebrew/opt/postgresql@15/bin/psql";
function query(sql) {
  return execFileSync(
    psql,
    [
      "-h",
      "/tmp",
      "-p",
      "5432",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-d",
      "thinkfy_reuse_571d",
    ],
    { input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  ).trim();
}
function jsonSql(input) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(input)).toString("base64")}','base64'),'UTF8')::jsonb`;
}
let failAfterCommit = false;
const server = createServer(async (req, res) => {
  const reply = (body, type = "application/json") => {
    res.setHeader("Content-Type", type);
    res.end(type === "application/json" ? JSON.stringify(body) : body);
  };
  if (req.url === "/app.js")
    return reply(readFileSync(path.join(output, "app.js")), "text/javascript");
  if (req.url === "/app.css")
    return reply(readFileSync(path.join(output, "app.css")), "text/css");
  if (req.method === "POST" && req.url?.startsWith("/rpc/")) {
    let text = "";
    for await (const part of req) {
      text += part;
      if (text.length > 100000) {
        res.statusCode = 413;
        return res.end();
      }
    }
    try {
      const input = JSON.parse(text || "{}");
      if (req.url === "/rpc/fail-next-create") {
        failAfterCommit = true;
        return reply({ ok: true });
      }
      let sql;
      if (req.url === "/rpc/sources") sql = "public.list_class_reuse_sources()";
      else if (req.url === "/rpc/preview")
        sql = `public.preview_class_curriculum_reuse((${jsonSql(input)}->>'sourceClassId')::uuid,${jsonSql(input.dates ?? null)})`;
      else if (req.url === "/rpc/create")
        sql = `public.create_class_curriculum_reuse(${jsonSql(input)})`;
      else throw new Error("Unknown operation");
      const data = JSON.parse(
        query(
          `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${actor}'; SELECT ${sql}; COMMIT;`,
        ),
      );
      if (req.url === "/rpc/create" && failAfterCommit) {
        failAfterCommit = false;
        return reply({ ok: false, code: "REUSE_FAILED" });
      }
      reply({ ok: true, data });
    } catch (error) {
      const message = String(error.stderr ?? error);
      reply({
        ok: false,
        code: message.match(/REUSE_[A-Z_]+/)?.[0] ?? "REUSE_FAILED",
      });
    }
    return;
  }
  reply(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thinkfy reuse · isolated QA 571d</title><link rel="stylesheet" href="/app.css"><style>:root{--font-inter:Inter,Arial,sans-serif}body{margin:0}</style></head><body class="bg-background text-on-surface"><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
    "text/html",
  );
});
server.listen(57918, "127.0.0.1", () =>
  console.log(
    `Isolated reuse QA: http://127.0.0.1:57918 · ${root} · DB thinkfy_reuse_571d`,
  ),
);
