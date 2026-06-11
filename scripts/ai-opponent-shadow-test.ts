import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import Module from "node:module";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

type Side = "proposition" | "opposition";
type AiDifficulty = "easy" | "medium" | "hard";

type AttemptRound = {
  roundNumber: number;
  type: "user-speech" | "ai-rebuttal";
  label: string;
  transcript?: string;
  aiResponse?: string;
  duration?: number;
};

type AttemptRow = {
  id: string;
  user_id: string;
  topic_title: string;
  side: Side;
  practice_track: "debate" | "speaking";
  practice_language: "vi" | "en";
  ai_difficulty: AiDifficulty | null;
  speech_time: number | null;
  rounds: unknown;
  created_at: string;
};

const DEFAULT_FIXTURES = [
  {
    label: "nam-latest",
    email: "baonam05032009@gmail.com",
    attemptId: "506c27a8-809d-4663-8a17-fba67305fc5b",
  },
  {
    label: "nam-original",
    email: "baonam05032009@gmail.com",
    attemptId: "e5c41194-fe78-4463-abc2-76afed7dc58a",
  },
  {
    label: "ndkn",
    email: "ndkn.work@gmail.com",
    attemptId: "5e7b7041-3810-40e9-96ed-4ae9867f85d9",
  },
] as const;

function installServerOnlyShim() {
  const requireForShim = Module.createRequire(import.meta.url);
  const serverOnlyPath = requireForShim.resolve("server-only");
  requireForShim.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    paths: [],
  } as NodeModule & { paths: string[] };
}

function parseArgs() {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = process.argv[index + 1];
    if (inlineValue != null) {
      args.set(key, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      args.set(key, nextValue);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing ${name}${fallback ? ` or ${fallback}` : ""}`);
  return value;
}

function hashText(value: string | null | undefined) {
  return createHash("sha256").update(value ?? "").digest("hex");
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function aiSideForStudentSide(side: Side): Side {
  return side === "proposition" ? "opposition" : "proposition";
}

function aiSideLabel(side: Side) {
  return side === "proposition" ? "Proposition (FOR)" : "Opposition (AGAINST)";
}

function modeFromRoundLabel(roundLabel: string): "rebuttal" | "closing" {
  return roundLabel.toLowerCase().includes("closing") ? "closing" : "rebuttal";
}

function normalizeRounds(value: unknown): AttemptRound[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((round): AttemptRound | null => {
      if (!round || typeof round !== "object" || Array.isArray(round)) return null;
      const source = round as Record<string, unknown>;
      const type = source.type;
      if (type !== "user-speech" && type !== "ai-rebuttal") return null;
      return {
        roundNumber:
          typeof source.roundNumber === "number" ? source.roundNumber : 0,
        type,
        label:
          typeof source.label === "string"
            ? source.label
            : type === "user-speech"
              ? "User Speech"
              : "AI Rebuttal",
        transcript:
          typeof source.transcript === "string" ? source.transcript : undefined,
        aiResponse:
          typeof source.aiResponse === "string" ? source.aiResponse : undefined,
        duration: typeof source.duration === "number" ? source.duration : undefined,
      };
    })
    .filter((round): round is AttemptRound => Boolean(round))
    .sort((left, right) => left.roundNumber - right.roundNumber);
}

function roundText(round: AttemptRound) {
  return round.type === "ai-rebuttal" ? round.aiResponse ?? "" : round.transcript ?? "";
}

function acceptanceForMetrics(metrics: {
  directRebuttalCueCount: number;
  standaloneClaimCount: number;
  hasWeighing: boolean;
  hasInventedEvidenceRisk?: boolean;
  hasClosingCrystallization: boolean;
  hasClosingNewArgumentRisk?: boolean;
}, mode: "rebuttal" | "closing") {
  const standaloneOffense =
    mode === "rebuttal" ? metrics.standaloneClaimCount > 0 : true;
  const noClosingNewArgument =
    mode === "closing" ? !metrics.hasClosingNewArgumentRisk : true;
  const closingCrystallization =
    mode === "closing" ? metrics.hasClosingCrystallization : true;

  return {
    directClash: metrics.directRebuttalCueCount > 0,
    standaloneOffense,
    weighing: metrics.hasWeighing,
    noInventedEvidence: !metrics.hasInventedEvidenceRisk,
    closingCrystallization,
    noClosingNewArgument,
    passed:
      metrics.directRebuttalCueCount > 0 &&
      standaloneOffense &&
      metrics.hasWeighing &&
      !metrics.hasInventedEvidenceRisk &&
      closingCrystallization &&
      noClosingNewArgument,
  };
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  loadEnvConfig(path.resolve(process.cwd(), "../.."));
  installServerOnlyShim();

  const args = parseArgs();
  const generate = args.get("generate") === "true";
  const cacheProbe = args.get("cache-probe") === "true";
  const outDir =
    args.get("outDir") ??
    path.resolve(process.cwd(), "../../qa-artifacts/ai-opponent-shadow");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");

  const [
    { difficultyPrompts },
    { getPracticeLanguageConfig },
    {
      buildFuzzyEvidenceHintBlock,
      buildTruongTeenRebuttalPromptAddendum,
      buildTruongTeenRoundInstructions,
      getTruongTeenWordTarget,
      shouldUseTruongTeenPrompt,
    },
    {
      createTruongTeenOpponentCasePlanMetadata,
      formatTruongTeenOpponentCasePlanPromptBlock,
      getTruongTeenOpponentCasePlan,
    },
    { analyzeTruongTeenOpponentOutput, ensureTruongTeenStandaloneOffense },
    {
      buildDeepSeekRebuttalMessages,
      getDeepSeekRebuttalPromptPrefixHash,
    },
    { getRebuttalMaxOutputTokens, getRebuttalWordTarget },
    { createDeepSeekChatCompletion },
    { retrieveDebateCorpusContext, createDebateCorpusRetrievalMetadata },
    { normalizeStructuredRebuttalResponse },
  ] = await Promise.all([
    import("../apps/web/src/lib/rebuttal/difficulty-prompts"),
    import("../apps/web/src/lib/practice-language"),
    import("../apps/web/src/lib/truong-teen/debate-dna"),
    import("../apps/web/src/lib/truong-teen/opponent-case-plan"),
    import("../apps/web/src/lib/truong-teen/opponent-quality"),
    import("../apps/web/src/lib/rebuttal/rebuttal-messages"),
    import("../apps/web/src/lib/rebuttal/debate-continuity"),
    import("../apps/web/src/lib/ai/deepseek"),
    import("../apps/web/src/lib/corpus/retrieval"),
    import("../apps/web/src/lib/rebuttal/structured-response"),
  ]);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reports = [];
  const fixtures = [...DEFAULT_FIXTURES];
  const cacheProbeFixture =
    DEFAULT_FIXTURES.find((fixture) => fixture.label === "ndkn") ??
    DEFAULT_FIXTURES[DEFAULT_FIXTURES.length - 1];
  if (cacheProbe) fixtures.push(cacheProbeFixture);

  for (const fixture of fixtures) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,display_name")
      .eq("email", fixture.email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id) throw new Error(`Missing profile for ${fixture.email}`);

    const { data: attempt, error: attemptError } = await supabase
      .from("practice_attempts")
      .select(
        "id,user_id,topic_title,side,practice_track,practice_language,ai_difficulty,speech_time,rounds,created_at"
      )
      .eq("id", fixture.attemptId)
      .single();
    if (attemptError) throw attemptError;

    const row = attempt as AttemptRow;
    const difficulty = row.ai_difficulty ?? "medium";
    const aiSide = aiSideForStudentSide(row.side);
    const languageConfig = getPracticeLanguageConfig(row.practice_language);
    const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
      practiceLanguage: row.practice_language,
      practiceTrack: row.practice_track,
    });
    const rounds = normalizeRounds(row.rounds);
    const replayedRounds: Array<{ label: string; speaker: string; text: string }> = [];
    const fixtureReport = {
      fixture: fixture.label,
      email: fixture.email,
      profileId: profile.id as string,
      attemptId: row.id,
      topic: row.topic_title,
      studentSide: row.side,
      aiSide,
      generated: generate,
      rounds: [] as unknown[],
    };

    for (const round of rounds) {
      if (round.type === "user-speech") {
        replayedRounds.push({
          label: round.label,
          speaker: "student",
          text: round.transcript ?? "",
        });
        continue;
      }

      const previousUserRound = [...replayedRounds]
        .reverse()
        .find((item) => item.speaker === "student");
      const userTranscript = previousUserRound?.text ?? "";
      const existingText = round.aiResponse ?? "";
      const debateFormat = modeFromRoundLabel(round.label);
      const opponentQualitySourceText = [
        userTranscript,
        ...replayedRounds.map((item) => item.text),
      ].join("\n\n");
      const baseWordTarget = getRebuttalWordTarget(
        row.speech_time ?? round.duration ?? 180,
        round.label
      );
      const wordTarget = getTruongTeenWordTarget({
        enabled: useTruongTeenPrompt,
        difficulty,
        target: baseWordTarget,
      });
      const existingMetrics = analyzeTruongTeenOpponentOutput(
        existingText,
        debateFormat,
        { sourceText: opponentQualitySourceText }
      );

      let generatedResult = null;
      if (generate) {
        const [corpusRetrieval, casePlan] = await Promise.all([
          retrieveDebateCorpusContext({
            purpose: "rebuttal",
            practiceLanguage: row.practice_language,
            practiceTrack: row.practice_track,
            topic: row.topic_title,
            side: row.side,
            transcript: userTranscript,
            roundsText: replayedRounds.map((item) => item.text),
            userId: profile.id as string,
            sourceRoute: "/scripts/ai-opponent-shadow-test",
            supabase,
          }),
          getTruongTeenOpponentCasePlan({
            supabase,
            userId: profile.id as string,
            topic: row.topic_title,
            aiSide,
            studentSide: row.side,
            difficulty,
            debateFormat,
            practiceLanguage: row.practice_language,
            practiceTrack: row.practice_track,
            sourceRoute: "/scripts/ai-opponent-shadow-test",
          }),
        ]);
        const casePlanPromptContext =
          formatTruongTeenOpponentCasePlanPromptBlock(casePlan, debateFormat);
        const truongTeenPromptContext = useTruongTeenPrompt
          ? buildTruongTeenRebuttalPromptAddendum({
              difficulty,
              wordTarget,
              debateFormat,
            })
          : "";
        const transcriptCorpus = [
          userTranscript,
          ...replayedRounds.map((item) => item.text),
        ];
        const evidenceHintContext = useTruongTeenPrompt
          ? buildFuzzyEvidenceHintBlock(transcriptCorpus)
          : "";
        const responseLanguageInstruction =
          row.practice_language === "vi"
            ? "Write the rebuttal and highlight notes in Vietnamese. Preserve Vietnamese diacritics and use natural spoken Vietnamese debate language."
            : "Write the rebuttal and highlight notes in English for students practicing English debate.";
        const learnerContext =
          row.practice_language === "vi"
            ? "This is for Vietnamese high school students practicing debate in Vietnamese, so be a challenging but fair practice partner."
            : "This is for Vietnamese high school students practicing debate in English, so be a challenging but fair practice partner.";
        const messages = buildDeepSeekRebuttalMessages({
          aiSide: aiSideLabel(aiSide),
          topic: row.topic_title,
          motionBriefContext: "",
          debateMemoryContext: "",
          difficultyInstructions: difficultyPrompts[difficulty],
          previousRounds: replayedRounds,
          roundLabel: round.label,
          currentRoundNumber: round.roundNumber,
          speechTimeSeconds: row.speech_time ?? round.duration ?? 180,
          wordTarget,
          track: row.practice_track,
          languageLabel: languageConfig.label,
          responseLanguageInstruction,
          userTranscript,
          roundInstructions: buildTruongTeenRoundInstructions({
            debateFormat,
            speechTimeSeconds: row.speech_time ?? round.duration ?? 180,
            wordTarget,
          }),
          learnerContext,
          truongTeenPromptContext,
          casePlanPromptContext,
          corpusContext: corpusRetrieval.contextBlock,
          evidenceHintContext,
        });
        const promptPrefixHash = getDeepSeekRebuttalPromptPrefixHash(messages);
        const startedAt = Date.now();
        const generation = await createDeepSeekChatCompletion({
          messages,
          thinking: { type: "disabled" },
          responseFormat: "json_object",
          maxTokens: getRebuttalMaxOutputTokens(wordTarget),
          temperature: 0.7,
          timeoutMs: 55_000,
          userId: profile.id as string,
          sourceRoute: "/scripts/ai-opponent-shadow-test",
          outputType: "rebuttal",
          metadata: {
            stage: "ai_opponent_shadow_replay",
            fixture: fixture.label,
            attemptId: row.id,
            roundNumber: round.roundNumber,
            promptPrefixHash,
            textOnly: true,
            noTts: true,
          },
        });
        let structured = normalizeStructuredRebuttalResponse(generation.content);
        const offenseGuardrail = ensureTruongTeenStandaloneOffense({
          text: structured.rebuttal,
          mode: debateFormat,
          casePlan,
          sourceText: opponentQualitySourceText,
        });
        structured = {
          ...structured,
          rebuttal: offenseGuardrail.text,
        };
        const generatedMetrics = offenseGuardrail.metrics;
        generatedResult = {
          provider: "deepseek",
          model: generation.model,
          latencyMs: Date.now() - startedAt,
          promptPrefixHash,
          textHash: hashText(structured.rebuttal),
          wordCount: wordCount(structured.rebuttal),
          preview: structured.rebuttal.slice(0, 1200),
          metrics: generatedMetrics,
          acceptance: acceptanceForMetrics(generatedMetrics, debateFormat),
          standaloneOffenseGuardrailInserted: offenseGuardrail.inserted,
          usage: {
            inputTokens: generation.usage?.prompt_tokens ?? null,
            outputTokens: generation.usage?.completion_tokens ?? null,
            cacheHitTokens: generation.usage?.prompt_cache_hit_tokens ?? null,
            cacheMissTokens: generation.usage?.prompt_cache_miss_tokens ?? null,
          },
          casePlan: createTruongTeenOpponentCasePlanMetadata(casePlan),
          corpus: createDebateCorpusRetrievalMetadata(corpusRetrieval),
        };
        replayedRounds.push({
          label: round.label,
          speaker: "AI",
          text: structured.rebuttal,
        });
      } else {
        replayedRounds.push({
          label: round.label,
          speaker: "AI",
          text: existingText,
        });
      }

      fixtureReport.rounds.push({
        roundNumber: round.roundNumber,
        label: round.label,
        inputTranscriptHash: hashText(userTranscript),
        inputWordCount: wordCount(userTranscript),
        baseline: {
          textHash: hashText(existingText),
          wordCount: wordCount(existingText),
          metrics: existingMetrics,
          acceptance: acceptanceForMetrics(existingMetrics, debateFormat),
        },
        generated: generatedResult,
      });
    }

    reports.push(fixtureReport);
  }

  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    textOnly: true,
    noTts: true,
    generated: generate,
    cacheProbe,
    promptVersion: "truong-teen-2025-v2",
    reports,
  };
  await mkdir(outDir, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `${stamp}.json`);
  const mdPath = path.join(outDir, `${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify(summary, null, 2));
  await writeFile(
    mdPath,
    [
      "# AI Opponent Shadow Test",
      "",
      `Generated: ${generatedAt}`,
      `Mode: ${generate ? "generated" : "dry-run baseline only"}`,
      `Text only: yes`,
      `TTS involved: no`,
      "",
      ...reports.flatMap((report) => [
        `## ${report.fixture} · ${report.email}`,
        "",
        `Attempt: ${report.attemptId}`,
        `Motion: ${report.topic}`,
        `Student side: ${report.studentSide}`,
        `AI side: ${report.aiSide}`,
        "",
        ...report.rounds.flatMap((round: any) => [
          `### Round ${round.roundNumber}: ${round.label}`,
          "",
          `Input words: ${round.inputWordCount}`,
          `Baseline standalone offense: ${round.baseline.metrics.hasStandaloneOffense ? "yes" : "no"}`,
          `Baseline only-rebuttal risk: ${round.baseline.metrics.onlyRebuttalRisk}`,
          round.generated
            ? `Generated standalone offense: ${round.generated.metrics.hasStandaloneOffense ? "yes" : "no"}`
            : "Generated standalone offense: not run",
          round.generated
            ? `Generated only-rebuttal risk: ${round.generated.metrics.onlyRebuttalRisk}`
            : "Generated only-rebuttal risk: not run",
          round.generated
            ? `Generated guardrail inserted: ${round.generated.standaloneOffenseGuardrailInserted ? "yes" : "no"}`
            : "Generated guardrail inserted: not run",
          round.generated
            ? `Generated invented evidence risk: ${round.generated.metrics.hasInventedEvidenceRisk ? "yes" : "no"}`
            : "Generated invented evidence risk: not run",
          round.generated
            ? `Generated closing new-argument risk: ${round.generated.metrics.hasClosingNewArgumentRisk ? "yes" : "no"}`
            : "Generated closing new-argument risk: not run",
          round.generated
            ? `DeepSeek cache: ${round.generated.usage.cacheHitTokens ?? 0} hit / ${round.generated.usage.cacheMissTokens ?? 0} miss`
            : "DeepSeek cache: not run",
          round.generated
            ? `Acceptance: ${round.generated.acceptance.passed ? "pass" : "fail"}`
            : "Acceptance: not run",
          "",
        ]),
      ]),
    ].join("\n")
  );

  console.info(JSON.stringify({ jsonPath, mdPath, generated: generate, cacheProbe }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
