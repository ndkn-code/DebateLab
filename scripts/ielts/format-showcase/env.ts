/**
 * Minimal `.env.local` loader for the showcase scripts (no dotenv dependency).
 * Values already present in `process.env` win.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadWebEnv(): string[] {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/.env.local"),
    path.resolve(process.cwd(), ".env.local"),
  ];
  const loaded: string[] = [];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
        loaded.push(key);
      }
    }
    break;
  }
  return loaded;
}
