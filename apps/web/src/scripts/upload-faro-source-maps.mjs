import { readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const outputPath = path.resolve(".next/static");

async function removeSourceMaps(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return removeSourceMaps(entryPath);
      if (entry.name.endsWith(".map")) await rm(entryPath, { force: true });
    })
  );
}

if (process.env.GRAFANA_FARO_SOURCE_MAPS_ENABLED !== "true") {
  process.exit(0);
}

const required = {
  GRAFANA_FARO_SOURCEMAP_ENDPOINT:
    process.env.GRAFANA_FARO_SOURCEMAP_ENDPOINT,
  GRAFANA_FARO_SOURCEMAP_API_KEY:
    process.env.GRAFANA_FARO_SOURCEMAP_API_KEY,
  GRAFANA_FARO_STACK_ID: process.env.GRAFANA_FARO_STACK_ID,
  GRAFANA_FARO_APP_ID: process.env.GRAFANA_FARO_APP_ID,
  VERCEL_GIT_COMMIT_SHA:
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
};
const missing = Object.entries(required)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

if (missing.length > 0) {
  await removeSourceMaps(outputPath);
  throw new Error(
    `Grafana source-map upload is enabled but these variables are missing: ${missing.join(", ")}`
  );
}

const upload = spawnSync(
  "faro-cli",
  [
    "upload",
    "--endpoint",
    required.GRAFANA_FARO_SOURCEMAP_ENDPOINT,
    "--api-key",
    required.GRAFANA_FARO_SOURCEMAP_API_KEY,
    "--stack-id",
    required.GRAFANA_FARO_STACK_ID,
    "--app-id",
    required.GRAFANA_FARO_APP_ID,
    "--bundle-id",
    required.VERCEL_GIT_COMMIT_SHA,
    "--output-path",
    outputPath,
    "--recursive",
    "--gzip-contents",
    // Keep each request comfortably below the Faro API/Vercel upload limit.
    // The CLI still measures source-map bytes before gzip, so bound both the
    // byte size and the number of files in a batch.
    "--max-upload-size",
    "8388608",
    "--batch-size",
    "10",
    "--gzip-payload",
  ],
  { stdio: "inherit" }
);

// Never let source maps remain in the deployable artifact, even when upload
// fails. The Grafana copy is private and authenticated.
await removeSourceMaps(outputPath);

if (upload.status !== 0) {
  throw new Error(`Grafana source-map upload failed with exit code ${upload.status}`);
}
