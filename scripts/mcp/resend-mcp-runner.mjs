#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const envPath = resolve(projectRoot, ".env.local");

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((env, rawLine) => {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        return env;
      }

      const equalsIndex = line.indexOf("=");
      if (equalsIndex === -1) {
        return env;
      }

      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) {
        env[key] = value;
      }

      return env;
    }, {});
}

const fileEnv = parseEnvFile(envPath);
const runtimeEnv = {
  ...process.env,
  ...fileEnv,
};

if (!runtimeEnv.RESEND_API_KEY) {
  console.error(
    "Missing RESEND_API_KEY. Add it to .env.local or export it before starting Codex.",
  );
  process.exit(1);
}

const child = spawn("npx", ["-y", "resend-mcp"], {
  cwd: projectRoot,
  env: runtimeEnv,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
