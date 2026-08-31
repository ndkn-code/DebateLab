#!/usr/bin/env node
import { ClickUpClient, GrafanaClient, parseDuration } from "./bug-ops/core";

type Flags = Record<string, string | boolean>;

function parseArgs(args: string[]): { words: string[]; flags: Flags } {
  const words: string[] = [];
  const flags: Flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      words.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { words, flags };
}

function stringFlag(flags: Flags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function requireWord(words: string[], index: number, label: string): string {
  const value = words[index];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function usage(): never {
  console.error(`Usage:
  npm run bugops -- clickup list [--status "Ready for Agent"] [--limit 20]
  npm run bugops -- clickup claim TASK_ID
  npm run bugops -- clickup update TASK_ID [--status STATUS] [--comment TEXT]
  npm run bugops -- grafana incident FINGERPRINT [--from 24h]
  npm run bugops -- grafana query --expr LOGQL [--from 1h] [--datasource-uid UID] [--limit 200]

Credentials are read only from environment variables. See docs/operations/grafana-bug-automation.md.`);
  process.exit(2);
}

async function main(): Promise<void> {
  const { words, flags } = parseArgs(process.argv.slice(2));
  const system = words[0];
  const action = words[1];
  let result: unknown;

  if (system === "clickup") {
    const client = new ClickUpClient(process.env);
    if (action === "list") {
      result = await client.list(
        stringFlag(flags, "status") ?? "Ready for Agent",
        Number(stringFlag(flags, "limit") ?? "20"),
      );
    } else if (action === "claim") {
      result = await client.claim(requireWord(words, 2, "TASK_ID"));
    } else if (action === "update") {
      result = await client.update(requireWord(words, 2, "TASK_ID"), {
        status: stringFlag(flags, "status"),
        comment: stringFlag(flags, "comment"),
      });
    } else usage();
  } else if (system === "grafana") {
    const client = new GrafanaClient(process.env);
    const now = Date.now();
    const from = parseDuration(stringFlag(flags, "from") ?? "24h", now);
    if (action === "incident") {
      result = await client.incident(requireWord(words, 2, "FINGERPRINT"), from, now);
    } else if (action === "query") {
      const expression = stringFlag(flags, "expr");
      if (!expression) throw new Error("grafana query requires --expr");
      result = await client.query({
        expression,
        fromMs: from,
        toMs: now,
        datasourceUid: stringFlag(flags, "datasource-uid"),
        limit: Number(stringFlag(flags, "limit") ?? "200"),
      });
    } else usage();
  } else usage();

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`bugops: ${message}`);
  process.exit(1);
});
