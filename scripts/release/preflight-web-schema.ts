/**
 * Production-only, read-only schema gate for the web build.
 *
 * It uses only the public Supabase URL and anon key. No service-role secret is
 * read or sent. The probes validate the exact contract needed by /api/chat.
 */
import {
  hasRequiredChatContract,
  isRetryableSchemaProbeStatus,
} from "./preflight-web-schema-core";

const MAX_PROBE_ATTEMPTS = 3;

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const isProductionBuild =
    process.env.VERCEL_ENV === "production" ||
    process.env.RELEASE_TARGET === "production";

  if (!isProductionBuild) {
    console.log("release:preflight:web: skipped outside production.");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    console.error(
      "release:preflight:web: production requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  let tableProbe: Response | undefined;
  for (let attempt = 1; attempt <= MAX_PROBE_ATTEMPTS; attempt += 1) {
    tableProbe = await fetch(
      `${supabaseUrl}/rest/v1/chat_conversations?select=product_context&limit=0`,
      { headers },
    );
    if (
      hasRequiredChatContract(tableProbe.status) ||
      !isRetryableSchemaProbeStatus(tableProbe.status) ||
      attempt === MAX_PROBE_ATTEMPTS
    ) {
      break;
    }
    await delay(250 * attempt);
  }
  if (!tableProbe) throw new Error("Schema probe did not run.");
  if (!hasRequiredChatContract(tableProbe.status)) {
    console.error(
      "release:preflight:web: required coach schema is not ready; apply Supabase migrations before deploying Vercel.",
    );
    console.error(
      JSON.stringify({
        tableProbeStatus: tableProbe.status,
      }),
    );
    process.exitCode = 1;
    return;
  }

  console.log("release:preflight:web: coach schema contract is ready.");
}

main().catch((error) => {
  console.error(
    "release:preflight:web: schema probe failed before receiving a response.",
  );
  console.error(
    JSON.stringify({
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  process.exitCode = 1;
});
