import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const routeFile = resolve(
  here,
  "../../../app/[locale]/(protected)/ielts/attempts/[attemptId]/results/page.tsx",
);
const require = createRequire(import.meta.url);
const rscServerPath =
  require.resolve("next/dist/compiled/react-server-dom-webpack/server.node");

const virtualModules: Record<string, string> = {
  "next/link": `
    import React from "react";
    export default function Link({ children, ...props }) {
      return React.createElement("a", props, children);
    }
  `,
  "next/navigation": `
    export function notFound() { throw new Error("NEXT_NOT_FOUND"); }
  `,
  "@/lib/api/ielts/results-repository": `
    export async function loadAttemptResults(attemptId) {
      if (attemptId === "unknown" || attemptId === "unauthorized") return null;
      return {
        attemptId, userId: "learner-7", testTitle: "Academic Mock 1",
        testSlug: attemptId === "progress-no-slug" ? null : "academic-01",
        module: "academic", attemptStatus: attemptId.startsWith("progress") ? "in_progress" : "completed",
        submittedAt: "2026-09-05T00:00:00Z", skillsInTest: ["writing"],
        listeningRaw:null,readingRaw:null,listeningBand:null,readingBand:null,
        storedWritingBand:null,storedSpeakingBand:null,objectiveQuestions:[],bandConversions:[],speakingParts:[],
        writingTasks:[{questionId:"w1",prompt:null,taskNumber:2,status:attemptId==="pending"?"pending":attemptId==="failed"?"failed":"scored",essay:"Synthetic response",wordCount:2,taskResponseBand:null,coherenceCohesionBand:null,lexicalResourceBand:null,grammarBand:null,taskBand:null,criteriaFeedback:{},inlineCorrections:[],paragraphFeedback:[],modelAnswer:null,feedbackLanguage:"en"}],
      };
    }
  `,
  "@/lib/api/ielts/study-plan-repository": `
    export async function loadActiveIeltsBandTargets() { return {overall:7,skills:{}}; }
  `,
  "@/lib/ielts/results/assignment-context": `
    export async function loadResultsAssignmentContext(attemptId) { return attemptId === "assigned" ? {assignmentId:"a-1",title:"Weekly mock",className:"Class A"} : null; }
  `,
  "@/components/ielts/results/IeltsResultsView": `
    import { createClientModuleProxy } from ${JSON.stringify(rscServerPath)};
    export const IeltsResultsView = createClientModuleProxy("results-view").IeltsResultsView;
  `,
  "@/components/ui/button": `
    import { createClientModuleProxy } from ${JSON.stringify(rscServerPath)};
    const clientButton = createClientModuleProxy("components/ui/button");
    export const Button = clientButton.Button;
    export const buttonVariants = clientButton.buttonVariants;
  `,
};

async function loadRoute() {
  const dir = await mkdtemp(join(tmpdir(), "thinkfy-results-rsc-"));
  const output = join(dir, "route.cjs");
  await build({
    entryPoints: [routeFile],
    outfile: output,
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    conditions: ["react-server"],
    tsconfig: resolve(here, "../../../../tsconfig.json"),
    external: [rscServerPath],
    plugins: [
      {
        name: "results-route-test-doubles",
        setup(plugin) {
          plugin.onResolve(
            { filter: /^(next\/link|next\/navigation|@\/)/ },
            (args) => {
              if (
                args.path in virtualModules ||
                args.path === "next/link" ||
                args.path === "next/navigation"
              ) {
                return {
                  path: args.path,
                  namespace: "results-route-test-double",
                };
              }
              if (args.path.startsWith("@/")) {
                const source = resolve(
                  here,
                  "../../../..",
                  "src",
                  args.path.slice(2),
                );
                const path = [source, `${source}.ts`, `${source}.tsx`].find(
                  (candidate) =>
                    existsSync(candidate) && statSync(candidate).isFile(),
                );
                return path ? { path } : undefined;
              }
              return undefined;
            },
          );
          plugin.onLoad(
            { filter: /.*/, namespace: "results-route-test-double" },
            (args) => ({
              contents: virtualModules[args.path] ?? "export {};",
              loader: "js",
              resolveDir: resolve(here, "../../../.."),
            }),
          );
        },
      },
    ],
  });
  const loaded = await import(pathToFileURL(output).href + `?v=${Date.now()}`);
  return {
    dir,
    route: loaded.default as (args: {
      params: Promise<{ locale: string; attemptId: string }>;
    }) => Promise<unknown>,
  };
}

async function renderRsc(value: unknown) {
  const rscServerModule =
    "next/dist/compiled/react-server-dom-webpack/server.node";
  const { renderToReadableStream } = await import(rscServerModule);
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(
    value,
    {
      "results-view#IeltsResultsView": {
        id: "results-view",
        chunks: [],
        name: "IeltsResultsView",
        async: false,
      },
      "components/ui/button#Button": {
        id: "components/ui/button",
        chunks: [],
        name: "Button",
        async: false,
      },
    },
    {
      onError(error: unknown) {
        errors.push(error);
      },
    },
  );
  const bytes = await new Response(stream as ReadableStream).arrayBuffer();
  assert.deepEqual(errors, []);
  return new TextDecoder().decode(bytes);
}

test("client button variants cannot be invoked from an RSC server route", () => {
  const { createClientModuleProxy } = require(rscServerPath) as {
    createClientModuleProxy: (
      id: string,
    ) => Record<string, (...args: unknown[]) => unknown>;
  };
  const clientButton = createClientModuleProxy("components/ui/button");
  assert.throws(
    () => clientButton.buttonVariants({}),
    /Attempted to call .* from the server/,
  );
});

test("results route renders in-progress resume as an RSC stream with attempt context", async () => {
  const { dir, route } = await loadRoute();
  try {
    const tree = await route({
      params: Promise.resolve({ locale: "vi", attemptId: "progress-assigned" }),
    });
    const payload = await renderRsc(tree);
    assert.match(payload, /Tiếp tục làm bài/);
    assert.match(
      payload,
      /\/vi\/ielts\/mock\/academic-01\?attempt=progress-assigned/,
    );
    assert.doesNotMatch(payload, /buttonVariants invoked during RSC render/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("submitted results preserve scored, pending, and failed writing states", async () => {
  const { dir, route } = await loadRoute();
  try {
    for (const status of ["completed", "pending", "failed"]) {
      const tree = await route({
        params: Promise.resolve({ locale: "en", attemptId: status }),
      });
      const payload = await renderRsc(tree);
      assert.match(
        payload,
        new RegExp(`"status":"${status === "completed" ? "scored" : status}"`),
      );
      assert.match(payload, /\/en\/ielts\/study-plan/);
      assert.match(payload, /Academic Mock 1/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("results route omits a resume CTA when the attempt has no slug", async () => {
  const { dir, route } = await loadRoute();
  try {
    const tree = await route({
      params: Promise.resolve({ locale: "en", attemptId: "progress-no-slug" }),
    });
    const payload = await renderRsc(tree);
    assert.match(payload, /Browse mocks/);
    assert.match(payload, /\/en\/ielts\/tests/);
    assert.doesNotMatch(payload, /Resume mock/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("results route rejects unknown and unauthorized attempts through notFound", async () => {
  const { dir, route } = await loadRoute();
  try {
    for (const attemptId of ["unknown", "unauthorized"]) {
      await assert.rejects(
        route({ params: Promise.resolve({ locale: "en", attemptId }) }),
        /NEXT_NOT_FOUND/,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("assigned results serialize the authorized class destination in both locales", async () => {
  const { dir, route } = await loadRoute();
  try {
    for (const locale of ["en", "vi"]) {
      const payload = await renderRsc(
        await route({
          params: Promise.resolve({ locale, attemptId: "assigned" }),
        }),
      );
      assert.match(
        payload,
        new RegExp(`/${locale}/ielts/assigned#assignment-a-1`),
      );
      assert.match(payload, /Class A · Weekly mock/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
