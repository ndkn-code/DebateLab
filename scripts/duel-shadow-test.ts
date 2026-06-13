/**
 * Duel shadow test.
 *
 * Exercises the human-vs-human duel judging + hidden-Elo pipeline end to end
 * against the live (project) database, in full isolation:
 *
 *   1. Creates throwaway auth users (deleted at the end — cascades clean up
 *      every duel row they touch).
 *   2. Fakes a 4-speech duel and calls the REAL Gemini duel judge
 *      (judgeDebateDuel) so the model is genuinely exercised.
 *   3. Validates the judged-rating Elo math (process_debate_duel_rating_internal),
 *      the low-confidence exclusion branch, and the forfeit asymmetry
 *      (process_debate_duel_forfeit_internal) with deterministic assertions.
 *   4. Writes a QA artifact under qa-artifacts/duel-shadow/.
 *
 * Run from apps/web so .env.local is picked up:
 *   npm run duel:shadow            (dry: no model call, rating math only)
 *   npm run duel:shadow -- --judge (calls the real Gemini judge)
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import Module from "node:module";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Side = "proposition" | "opposition";

const SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MOTION = "This house would ban homework in primary schools";
const TOPIC_CATEGORY = "education";

const SPEECHES: Array<{
  roundNumber: number;
  speechType: "opening" | "rebuttal";
  side: Side;
  label: string;
  transcript: string;
}> = [
  {
    roundNumber: 1,
    speechType: "opening",
    side: "proposition",
    label: "Proposition Opening",
    transcript:
      "We propose banning homework in primary schools. First, mechanism: young children learn best through play and rest, and the school day already provides enough structured instruction. Homework eats into the recovery time a seven year old needs, which harms attention the next day. Second, equity: children from low income homes often lack a quiet desk, internet, or a parent free to help, so homework widens the gap between rich and poor pupils rather than closing it. Third, evidence weighing: studies of primary aged children show little to no academic benefit from homework, while the stress cost is real. Because the harm is concentrated on the most vulnerable and the benefit is near zero, the proposition stands.",
  },
  {
    roundNumber: 2,
    speechType: "opening",
    side: "opposition",
    label: "Opposition Opening",
    transcript:
      "We oppose. Homework in moderation builds the habit of independent study that children will need for the rest of their education. If we wait until secondary school to introduce it, the jump is far harsher. On equity, the answer to unequal home support is to fund libraries and supervised homework clubs, not to abolish the practice entirely, which throws away the benefit for everyone. On the evidence, light reading at home is consistently linked to stronger literacy, and reading is homework. A blanket ban is a blunt instrument that removes a tool teachers can calibrate to each class.",
  },
  {
    roundNumber: 3,
    speechType: "rebuttal",
    side: "proposition",
    label: "Proposition Rebuttal",
    transcript:
      "The opposition says homework builds study habits, but habit formation at age seven is better served by structured class routines than by unsupervised tasks that parents often end up doing. On their homework club rebuttal: clubs require staffing and funding that the poorest schools precisely lack, so their fix re-creates the very inequality we identified. We agree reading matters, but reading for pleasure is not the worksheet homework we are banning, and our model explicitly protects shared reading. Weighing: they protect a speculative future benefit; we prevent a present, measured harm to the most vulnerable children. Prefer concrete harm avoided over speculative gain.",
  },
  {
    roundNumber: 4,
    speechType: "rebuttal",
    side: "opposition",
    label: "Opposition Rebuttal",
    transcript:
      "Proposition concedes that reading is valuable and should continue, which already softens their own ban into something narrower than the motion. If exceptions are needed, the policy is calibration, not abolition, which is our case. On habits: routines in class and small tasks at home are complements, not substitutes. On equity: defunding the response to inequality does not remove inequality, it just removes the lever schools have to act on it. The cleaner world keeps a small, optional, well supported homework load and invests in the children who need help, rather than removing the tool from every child to protect some.",
  },
];

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

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing ${name}${fallback ? ` or ${fallback}` : ""}`);
  return value;
}

function shareCode() {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  }
  return code;
}

// Mirror of the SQL Elo math for cross-checking the DB output.
function expectedScore(self: number, opp: number) {
  return 1 / (1 + Math.pow(10, (opp - self) / 400));
}
function kFactor(matches: number, provisional: boolean) {
  if (provisional || matches < 5) return 40;
  if (matches < 20) return 32;
  return 24;
}
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

type Assertion = { name: string; pass: boolean; detail: string };
function assert(results: Assertion[], name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
}

async function getBalance(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("orb_balance")
    .eq("id", userId)
    .single();
  return Number(data?.orb_balance ?? 0);
}

async function createTempUser(supabase: SupabaseClient, label: string) {
  const email = `duel-shadow-${label}-${Date.now()}-${randomBytes(3).toString("hex")}@thinkfy-shadow.test`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { display_name: `Shadow ${label.toUpperCase()}` },
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  return data.user.id;
}

async function createDuel(
  supabase: SupabaseClient,
  opts: { creatorId: string; opponentId: string }
) {
  let code = shareCode();
  // Extremely unlikely to collide; retry a couple of times to be safe.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("debate_duels")
      .insert({
        share_code: code,
        creator_id: opts.creatorId,
        topic_title: MOTION,
        topic_category: TOPIC_CATEGORY,
        topic_difficulty: "intermediate",
        practice_language: "en",
        duel_kind: "matchmaking",
        rated: true,
        status: "in_progress",
        current_phase: "opposition-rebuttal",
        phase_started_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .select("id, share_code")
      .single();
    if (!error && data) return data as { id: string; share_code: string };
    if (error && !error.message.includes("share_code")) {
      throw new Error(`createDuel failed: ${error.message}`);
    }
    code = shareCode();
  }
  throw new Error("createDuel failed: share_code collisions");
}

async function addParticipants(
  supabase: SupabaseClient,
  duelId: string,
  propUser: string,
  oppUser: string
) {
  const { data, error } = await supabase
    .from("debate_duel_participants")
    .insert([
      { duel_id: duelId, user_id: propUser, role: "proposition", display_name_snapshot: "Shadow Prop" },
      { duel_id: duelId, user_id: oppUser, role: "opposition", display_name_snapshot: "Shadow Opp" },
    ])
    .select("id, role, user_id");
  if (error || !data) throw new Error(`addParticipants failed: ${error?.message}`);
  const byRole = new Map(data.map((p) => [p.role as Side, p]));
  return byRole;
}

async function addSpeeches(
  supabase: SupabaseClient,
  duelId: string,
  byRole: Map<Side, { id: string }>
) {
  const rows = SPEECHES.map((s) => ({
    duel_id: duelId,
    participant_id: byRole.get(s.side)!.id,
    round_number: s.roundNumber,
    speech_type: s.speechType,
    side: s.side,
    transcript: s.transcript,
    duration_seconds: 90,
    metadata: { shadow: true },
  }));
  const { error } = await supabase.from("debate_duel_speeches").insert(rows);
  if (error) throw new Error(`addSpeeches failed: ${error.message}`);
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  loadEnvConfig(path.resolve(process.cwd(), "../.."));
  installServerOnlyShim();

  const runJudge = process.argv.includes("--judge");
  const runAi = process.argv.includes("--ai");
  const outDir =
    process.argv.find((a) => a.startsWith("--outDir="))?.slice("--outDir=".length) ??
    path.resolve(process.cwd(), "../../qa-artifacts/duel-shadow");

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: Assertion[] = [];
  const createdUsers: string[] = [];
  const createdDuelIds: string[] = [];
  let judgeReport: Record<string, unknown> | null = null;
  let aiReport: Record<string, unknown> | null = null;

  try {
    // ---- Scenario 1: real judge call + judged-rating Elo --------------------
    const [propUser, oppUser] = await Promise.all([
      createTempUser(supabase, "p1"),
      createTempUser(supabase, "o1"),
    ]);
    createdUsers.push(propUser, oppUser);

    const duel1 = await createDuel(supabase, { creatorId: propUser, opponentId: oppUser });
    createdDuelIds.push(duel1.id);
    const byRole1 = await addParticipants(supabase, duel1.id, propUser, oppUser);
    await addSpeeches(supabase, duel1.id, byRole1);

    let judgeWinnerSide: Side = "proposition";
    let judgeConfidence = 0.8;
    if (runJudge) {
      const { judgeDebateDuel } = await import("../apps/web/src/lib/gemini");
      const startedAt = Date.now();
      const judgment = await judgeDebateDuel(
        {
          motion: MOTION,
          topicCategory: TOPIC_CATEGORY,
          practiceLanguage: "en",
          participants: {
            proposition: { participantId: byRole1.get("proposition")!.id, displayName: "Shadow Prop" },
            opposition: { participantId: byRole1.get("opposition")!.id, displayName: "Shadow Opp" },
          },
          speeches: SPEECHES.map((s) => ({
            id: randomUUID(),
            roundNumber: s.roundNumber,
            speechType: s.speechType,
            side: s.side,
            label: s.label,
            transcript: s.transcript,
            durationSeconds: 90,
            qualityFlags: [],
          })),
        },
        propUser
      );
      judgeWinnerSide = judgment.winnerSide;
      judgeConfidence = judgment.confidence;
      judgeReport = {
        winnerSide: judgment.winnerSide,
        confidence: judgment.confidence,
        model: judgment.model,
        summaryPreview: (judgment.summary ?? "").slice(0, 400),
        latencyMs: Date.now() - startedAt,
        hasComparativeBallot: Boolean((judgment as Record<string, unknown>).comparativeBallot),
        roundBreakdownCount: Array.isArray((judgment as Record<string, unknown>).roundBreakdown)
          ? ((judgment as Record<string, unknown>).roundBreakdown as unknown[]).length
          : 0,
      };
      assert(results, "judge: returns a winner side", judgeWinnerSide === "proposition" || judgeWinnerSide === "opposition", `winnerSide=${judgeWinnerSide}`);
      assert(results, "judge: confidence in [0,1]", judgeConfidence >= 0 && judgeConfidence <= 1, `confidence=${judgeConfidence}`);
    } else {
      judgeReport = { skipped: true, note: "run with --judge to call the real model" };
    }

    // Insert a ratable judgment (confidence forced >= 0.55 so the Elo math runs
    // deterministically; the *real* model confidence is captured separately in
    // judgeReport above).
    const winnerParticipantId = byRole1.get(judgeWinnerSide)!.id;
    {
      const { error } = await supabase.from("debate_duel_judgments").insert({
        duel_id: duel1.id,
        winner_participant_id: winnerParticipantId,
        winner_side: judgeWinnerSide,
        judge_model: runJudge ? "gemini-shadow" : "synthetic-shadow",
        confidence: 0.8,
        verdict: { shadow: true, winnerSide: judgeWinnerSide },
        summary: "Shadow rating-math validation judgment.",
      });
      if (error) throw new Error(`insert judgment failed: ${error.message}`);
    }
    await supabase
      .from("debate_duels")
      .update({ status: "completed", current_phase: "completed", completed_at: new Date().toISOString() })
      .eq("id", duel1.id);

    const { data: rated, error: ratingErr } = await supabase.rpc(
      "process_debate_duel_rating_internal",
      { p_duel_id: duel1.id }
    );
    if (ratingErr) throw new Error(`process_debate_duel_rating_internal failed: ${ratingErr.message}`);
    assert(results, "rating: returns true for a ratable duel", rated === true, `returned=${rated}`);

    const winnerUser = judgeWinnerSide === "proposition" ? propUser : oppUser;
    const loserUser = judgeWinnerSide === "proposition" ? oppUser : propUser;
    const expWinner = expectedScore(1000, 1000); // 0.5
    const expWinnerDelta = round2(kFactor(0, true) * (1 - expWinner)); // +20.00
    const expLoserDelta = round2(kFactor(0, true) * (0 - expWinner)); // -20.00

    const { data: mmr1 } = await supabase
      .from("duel_mmr_profiles")
      .select("user_id, rating, wins, losses, matches_count, provisional")
      .in("user_id", [winnerUser, loserUser]);
    const winnerMmr = mmr1?.find((m) => m.user_id === winnerUser);
    const loserMmr = mmr1?.find((m) => m.user_id === loserUser);

    assert(results, "rating: winner +20.00 from 1000", Number(winnerMmr?.rating) === 1020, `winner rating=${winnerMmr?.rating} expected 1020 (delta ${expWinnerDelta})`);
    assert(results, "rating: loser -20.00 from 1000", Number(loserMmr?.rating) === 980, `loser rating=${loserMmr?.rating} expected 980 (delta ${expLoserDelta})`);
    assert(results, "rating: winner wins=1 losses=0 matches=1", winnerMmr?.wins === 1 && winnerMmr?.losses === 0 && winnerMmr?.matches_count === 1, JSON.stringify(winnerMmr));
    assert(results, "rating: loser wins=0 losses=1 matches=1", loserMmr?.wins === 0 && loserMmr?.losses === 1 && loserMmr?.matches_count === 1, JSON.stringify(loserMmr));

    const { data: events1 } = await supabase
      .from("duel_rating_events")
      .select("user_id, result, rating_delta, expected_score, k_factor")
      .eq("duel_id", duel1.id);
    assert(results, "rating: exactly 2 rating events written", events1?.length === 2, `count=${events1?.length}`);
    const winEvent = events1?.find((e) => e.result === "win");
    const lossEvent = events1?.find((e) => e.result === "loss");
    assert(results, "rating: win event delta = +20.00", Number(winEvent?.rating_delta) === 20, `delta=${winEvent?.rating_delta}`);
    assert(results, "rating: loss event delta = -20.00", Number(lossEvent?.rating_delta) === -20, `delta=${lossEvent?.rating_delta}`);
    assert(results, "rating: K-factor 40 (provisional)", Number(winEvent?.k_factor) === 40, `k=${winEvent?.k_factor}`);

    // Idempotency: a second call must not double-apply.
    const { data: ratedAgain } = await supabase.rpc("process_debate_duel_rating_internal", { p_duel_id: duel1.id });
    const { data: mmrAfter } = await supabase
      .from("duel_mmr_profiles")
      .select("rating")
      .eq("user_id", winnerUser)
      .single();
    assert(results, "rating: idempotent (second call returns false)", ratedAgain === false, `returned=${ratedAgain}`);
    assert(results, "rating: idempotent (rating unchanged at 1020)", Number(mmrAfter?.rating) === 1020, `rating=${mmrAfter?.rating}`);

    // ---- Scenario 2: low-confidence exclusion -------------------------------
    const [propUser2, oppUser2] = await Promise.all([
      createTempUser(supabase, "p2"),
      createTempUser(supabase, "o2"),
    ]);
    createdUsers.push(propUser2, oppUser2);
    const duel2 = await createDuel(supabase, { creatorId: propUser2, opponentId: oppUser2 });
    createdDuelIds.push(duel2.id);
    const byRole2 = await addParticipants(supabase, duel2.id, propUser2, oppUser2);
    await addSpeeches(supabase, duel2.id, byRole2);
    await supabase.from("debate_duel_judgments").insert({
      duel_id: duel2.id,
      winner_participant_id: byRole2.get("proposition")!.id,
      winner_side: "proposition",
      judge_model: "synthetic-shadow",
      confidence: 0.4, // below the 0.55 rating gate
      verdict: { shadow: true },
      summary: "Low-confidence shadow judgment.",
    });
    await supabase
      .from("debate_duels")
      .update({ status: "completed", current_phase: "completed", completed_at: new Date().toISOString() })
      .eq("id", duel2.id);
    const { data: rated2 } = await supabase.rpc("process_debate_duel_rating_internal", { p_duel_id: duel2.id });
    const { data: duel2Row } = await supabase
      .from("debate_duels")
      .select("rating_excluded_reason, rating_processed_at")
      .eq("id", duel2.id)
      .single();
    const { data: events2 } = await supabase.from("duel_rating_events").select("id").eq("duel_id", duel2.id);
    assert(results, "low-confidence: rating returns false", rated2 === false, `returned=${rated2}`);
    assert(results, "low-confidence: excluded_reason = low_judge_confidence", duel2Row?.rating_excluded_reason === "low_judge_confidence", `reason=${duel2Row?.rating_excluded_reason}`);
    assert(results, "low-confidence: no rating events written", events2?.length === 0, `count=${events2?.length}`);

    // ---- Scenario 3: forfeit asymmetry --------------------------------------
    const [propUser3, oppUser3] = await Promise.all([
      createTempUser(supabase, "p3"),
      createTempUser(supabase, "o3"),
    ]);
    createdUsers.push(propUser3, oppUser3);
    const duel3 = await createDuel(supabase, { creatorId: propUser3, opponentId: oppUser3 });
    createdDuelIds.push(duel3.id);
    await addParticipants(supabase, duel3.id, propUser3, oppUser3);
    // propUser3 forfeits.
    const { data: forfeited } = await supabase.rpc("process_debate_duel_forfeit_internal", {
      p_duel_id: duel3.id,
      p_forfeiter_user_id: propUser3,
    });
    assert(results, "forfeit: returns true for rated matchmaking", forfeited === true, `returned=${forfeited}`);

    const { data: mmr3 } = await supabase
      .from("duel_mmr_profiles")
      .select("user_id, rating, wins, losses, matches_count")
      .in("user_id", [propUser3, oppUser3]);
    const forfeiterMmr = mmr3?.find((m) => m.user_id === propUser3);
    const opponentMmr = mmr3?.find((m) => m.user_id === oppUser3);
    assert(results, "forfeit: forfeiter loses 20 (1000 -> 980)", Number(forfeiterMmr?.rating) === 980, `forfeiter rating=${forfeiterMmr?.rating}`);
    assert(results, "forfeit: forfeiter losses=1 matches=1", forfeiterMmr?.losses === 1 && forfeiterMmr?.matches_count === 1, JSON.stringify(forfeiterMmr));
    assert(
      results,
      "forfeit: opponent unchanged (no gain, no match counted)",
      opponentMmr === undefined || (Number(opponentMmr?.rating) === 1000 && opponentMmr?.matches_count === 0 && opponentMmr?.wins === 0),
      JSON.stringify(opponentMmr ?? "no opponent mmr row (also valid: untouched)")
    );
    const { data: events3 } = await supabase.from("duel_rating_events").select("user_id, result").eq("duel_id", duel3.id);
    assert(results, "forfeit: exactly 1 rating event (forfeiter loss only)", events3?.length === 1 && events3?.[0]?.result === "loss" && events3?.[0]?.user_id === propUser3, JSON.stringify(events3));

    // ---- Scenario 4: forfeit a started duel (opponent-only refund + Elo) ----
    const [propUser4, oppUser4] = await Promise.all([
      createTempUser(supabase, "p4"),
      createTempUser(supabase, "o4"),
    ]);
    createdUsers.push(propUser4, oppUser4);
    const duel4 = await createDuel(supabase, { creatorId: propUser4, opponentId: oppUser4 });
    createdDuelIds.push(duel4.id);
    const byRole4 = await addParticipants(supabase, duel4.id, propUser4, oppUser4);
    // At least one speech exists -> forfeiter is NOT refunded, opponent IS.
    await supabase.from("debate_duel_speeches").insert({
      duel_id: duel4.id,
      participant_id: byRole4.get("proposition")!.id,
      round_number: 1,
      speech_type: "opening",
      side: "proposition",
      transcript: SPEECHES[0].transcript,
      duration_seconds: 90,
      metadata: { shadow: true },
    });
    const baseProp4 = await getBalance(supabase, propUser4);
    const baseOpp4 = await getBalance(supabase, oppUser4);
    const { error: f4err } = await supabase.rpc("forfeit_debate_duel_internal", {
      p_duel_id: duel4.id,
      p_forfeiter_user_id: propUser4,
    });
    assert(results, "forfeit: resolver runs without error", !f4err, f4err?.message ?? "ok");
    const { data: duel4Row } = await supabase
      .from("debate_duels")
      .select("status, outcome_reason, forfeited_by")
      .eq("id", duel4.id)
      .single();
    assert(results, "forfeit: duel completed + outcome=forfeit + forfeited_by set", duel4Row?.status === "completed" && duel4Row?.outcome_reason === "forfeit" && duel4Row?.forfeited_by === propUser4, JSON.stringify(duel4Row));
    assert(results, "forfeit: opponent refunded +200 (had a speech)", (await getBalance(supabase, oppUser4)) === baseOpp4 + 200, `opp ${baseOpp4} -> ${await getBalance(supabase, oppUser4)}`);
    assert(results, "forfeit: forfeiter NOT refunded", (await getBalance(supabase, propUser4)) === baseProp4, `forfeiter ${baseProp4} -> ${await getBalance(supabase, propUser4)}`);
    const { data: refundTxns4 } = await supabase
      .from("orb_transactions")
      .select("user_id, amount")
      .eq("type", "duel_refund")
      .eq("reference_id", duel4.id);
    assert(results, "forfeit: exactly 1 duel_refund txn (opponent, +200)", refundTxns4?.length === 1 && refundTxns4?.[0]?.user_id === oppUser4 && refundTxns4?.[0]?.amount === 200, JSON.stringify(refundTxns4));
    const { data: f4mmr } = await supabase
      .from("duel_mmr_profiles")
      .select("user_id, rating, losses")
      .in("user_id", [propUser4, oppUser4]);
    const f4forfeiter = f4mmr?.find((m) => m.user_id === propUser4);
    const f4opp = f4mmr?.find((m) => m.user_id === oppUser4);
    assert(results, "forfeit: forfeiter Elo -20 -> 980, loss recorded", Number(f4forfeiter?.rating) === 980 && f4forfeiter?.losses === 1, JSON.stringify(f4forfeiter));
    assert(results, "forfeit: opponent Elo untouched (1000)", f4opp === undefined || Number(f4opp?.rating) === 1000, JSON.stringify(f4opp ?? "none"));

    // ---- Scenario 5: abandon before any speech -> both refunded -------------
    const [propUser5, oppUser5] = await Promise.all([
      createTempUser(supabase, "p5"),
      createTempUser(supabase, "o5"),
    ]);
    createdUsers.push(propUser5, oppUser5);
    const duel5 = await createDuel(supabase, { creatorId: propUser5, opponentId: oppUser5 });
    createdDuelIds.push(duel5.id);
    await addParticipants(supabase, duel5.id, propUser5, oppUser5);
    const baseProp5 = await getBalance(supabase, propUser5);
    const baseOpp5 = await getBalance(supabase, oppUser5);
    await supabase.rpc("forfeit_debate_duel_internal", {
      p_duel_id: duel5.id,
      p_forfeiter_user_id: propUser5,
    });
    assert(results, "abandon (0 speeches): both players refunded +200", (await getBalance(supabase, propUser5)) === baseProp5 + 200 && (await getBalance(supabase, oppUser5)) === baseOpp5 + 200, `prop ${baseProp5}->${await getBalance(supabase, propUser5)}, opp ${baseOpp5}->${await getBalance(supabase, oppUser5)}`);
    const { data: refundTxns5 } = await supabase
      .from("orb_transactions")
      .select("user_id")
      .eq("type", "duel_refund")
      .eq("reference_id", duel5.id);
    assert(results, "abandon (0 speeches): exactly 2 duel_refund txns", refundTxns5?.length === 2, String(refundTxns5?.length));

    // ---- Scenario 6: AI opponent plays a full duel (--ai) -------------------
    if (runAi) {
      const aiUser = await createTempUser(supabase, "ai");
      createdUsers.push(aiUser);
      const { generateDuelAiSpeech } = await import(
        "../apps/web/src/lib/debate-duels/ai-opponent"
      );
      const humanOpening = SPEECHES[0].transcript;
      const aiOpening = await generateDuelAiSpeech({
        motion: MOTION,
        aiSide: "opposition",
        speechType: "opening",
        practiceLanguage: "en",
        priorSpeeches: [
          { side: "proposition", speechType: "opening", transcript: humanOpening },
        ],
        targetSeconds: 180,
        userId: aiUser,
      });
      assert(results, "ai: opp opening generated (>=60 words)", wordCount(aiOpening.transcript) >= 60, `words=${wordCount(aiOpening.transcript)} model=${aiOpening.model}`);

      const humanRebuttal = SPEECHES[2].transcript;
      const aiRebuttal = await generateDuelAiSpeech({
        motion: MOTION,
        aiSide: "opposition",
        speechType: "rebuttal",
        practiceLanguage: "en",
        priorSpeeches: [
          { side: "proposition", speechType: "opening", transcript: humanOpening },
          { side: "opposition", speechType: "opening", transcript: aiOpening.transcript },
          { side: "proposition", speechType: "rebuttal", transcript: humanRebuttal },
        ],
        targetSeconds: 120,
        userId: aiUser,
      });
      assert(results, "ai: opp rebuttal generated (>=60 words)", wordCount(aiRebuttal.transcript) >= 60, `words=${wordCount(aiRebuttal.transcript)} model=${aiRebuttal.model}`);

      const { judgeDebateDuel } = await import("../apps/web/src/lib/gemini");
      const aiDuelJudgment = await judgeDebateDuel(
        {
          motion: MOTION,
          topicCategory: TOPIC_CATEGORY,
          practiceLanguage: "en",
          participants: {
            proposition: { participantId: null, displayName: "Human" },
            opposition: { participantId: null, displayName: "AI Sparring Partner" },
          },
          speeches: [
            { id: randomUUID(), roundNumber: 1, speechType: "opening", side: "proposition", label: "Proposition Opening", transcript: humanOpening, durationSeconds: 120, qualityFlags: [] },
            { id: randomUUID(), roundNumber: 2, speechType: "opening", side: "opposition", label: "Opposition Opening", transcript: aiOpening.transcript, durationSeconds: 120, qualityFlags: [] },
            { id: randomUUID(), roundNumber: 3, speechType: "rebuttal", side: "proposition", label: "Proposition Rebuttal", transcript: humanRebuttal, durationSeconds: 90, qualityFlags: [] },
            { id: randomUUID(), roundNumber: 4, speechType: "rebuttal", side: "opposition", label: "Opposition Rebuttal", transcript: aiRebuttal.transcript, durationSeconds: 90, qualityFlags: [] },
          ],
        },
        aiUser
      );
      assert(results, "ai: judge decides the AI duel", aiDuelJudgment.winnerSide === "proposition" || aiDuelJudgment.winnerSide === "opposition", `winner=${aiDuelJudgment.winnerSide}`);
      aiReport = {
        speechModel: aiOpening.model,
        openingWords: wordCount(aiOpening.transcript),
        rebuttalWords: wordCount(aiRebuttal.transcript),
        openingPreview: aiOpening.transcript.slice(0, 240),
        judge: {
          winnerSide: aiDuelJudgment.winnerSide,
          confidence: aiDuelJudgment.confidence,
          model: aiDuelJudgment.model,
        },
      };
    } else {
      aiReport = { skipped: true, note: "run with --ai to generate AI speeches via the real model" };
    }

    // ---- Scenario 7: AI-backfill DB flow (create + AI turns + advance) -------
    const [humanUser7, aiUser7] = await Promise.all([
      createTempUser(supabase, "h7"),
      createTempUser(supabase, "ai7"),
    ]);
    createdUsers.push(humanUser7, aiUser7);
    const { data: aiShareCode, error: aiCreateErr } = await supabase.rpc(
      "create_ai_backfill_duel",
      {
        p_human_user_id: humanUser7,
        p_ai_user_id: aiUser7,
        p_practice_topic_key: null,
        p_topic_title: MOTION,
        p_topic_category: TOPIC_CATEGORY,
        p_topic_category_key: TOPIC_CATEGORY,
        p_topic_difficulty: "intermediate",
        p_topic_description: "",
        p_practice_language: "en",
        p_prep_time_seconds: 120,
        p_opening_time_seconds: 180,
        p_rebuttal_time_seconds: 120,
      }
    );
    assert(results, "ai-backfill: create returns a 6-char share code", !aiCreateErr && typeof aiShareCode === "string" && aiShareCode.length === 6, aiCreateErr?.message ?? String(aiShareCode));

    const { data: aiDuel } = await supabase
      .from("debate_duels")
      .select("id, ai_opponent, rated, status, current_phase, entry_cost")
      .eq("share_code", aiShareCode)
      .single();
    if (aiDuel?.id) createdDuelIds.push(aiDuel.id);
    assert(results, "ai-backfill: ai_opponent + unrated + in_progress + prep + 200", aiDuel?.ai_opponent === true && aiDuel?.rated === false && aiDuel?.status === "in_progress" && aiDuel?.current_phase === "prep" && aiDuel?.entry_cost === 200, JSON.stringify(aiDuel));
    assert(results, "ai-backfill: human charged 200 (1250 -> 1050)", (await getBalance(supabase, humanUser7)) === 1050, `balance=${await getBalance(supabase, humanUser7)}`);

    const { data: aiParts } = await supabase
      .from("debate_duel_participants")
      .select("id, user_id, role")
      .eq("duel_id", aiDuel!.id);
    const humanPart = aiParts?.find((p) => p.role === "proposition");
    const aiPart = aiParts?.find((p) => p.role === "opposition");
    assert(results, "ai-backfill: human=proposition, AI=opposition", humanPart?.user_id === humanUser7 && aiPart?.user_id === aiUser7, JSON.stringify(aiParts));

    const CANNED_AI = "I rise in opposition. The proposition overstates the harm and understates the value of light, guided practice. Their equity concern is real, but the remedy is investment in supervised study, not abolition — so the comparative still favours our side.";

    // Reach the AI's opening turn: human has delivered round 1.
    await supabase
      .from("debate_duels")
      .update({ current_phase: "opposition-opening", phase_started_at: new Date().toISOString() })
      .eq("id", aiDuel!.id);
    await supabase.from("debate_duel_speeches").insert({
      duel_id: aiDuel!.id,
      participant_id: humanPart!.id,
      round_number: 1,
      speech_type: "opening",
      side: "proposition",
      transcript: SPEECHES[0].transcript,
      duration_seconds: 120,
      metadata: { shadow: true },
    });

    const aiNext2 = (await supabase.rpc("submit_ai_duel_speech", { p_duel_id: aiDuel!.id, p_round_number: 2, p_transcript: CANNED_AI, p_duration_seconds: 90 })).data;
    const aiNext2Again = (await supabase.rpc("submit_ai_duel_speech", { p_duel_id: aiDuel!.id, p_round_number: 2, p_transcript: CANNED_AI, p_duration_seconds: 90 })).data;
    assert(results, "ai-backfill: AI opening advances to rebuttal-prep", aiNext2 === "rebuttal-prep", String(aiNext2));
    assert(results, "ai-backfill: second AI-opening submit is an idempotent no-op", aiNext2Again === "rebuttal-prep", String(aiNext2Again));
    const { data: aiRound2Speech } = await supabase.from("debate_duel_speeches").select("side, speech_type").eq("duel_id", aiDuel!.id).eq("round_number", 2).single();
    assert(results, "ai-backfill: round 2 is the AI's opposition opening", aiRound2Speech?.side === "opposition" && aiRound2Speech?.speech_type === "opening", JSON.stringify(aiRound2Speech));

    // Reach the AI's rebuttal turn: human has delivered round 3.
    await supabase
      .from("debate_duels")
      .update({ current_phase: "opposition-rebuttal", phase_started_at: new Date().toISOString() })
      .eq("id", aiDuel!.id);
    await supabase.from("debate_duel_speeches").insert({
      duel_id: aiDuel!.id,
      participant_id: humanPart!.id,
      round_number: 3,
      speech_type: "rebuttal",
      side: "proposition",
      transcript: SPEECHES[2].transcript,
      duration_seconds: 90,
      metadata: { shadow: true },
    });

    const aiNext4 = (await supabase.rpc("submit_ai_duel_speech", { p_duel_id: aiDuel!.id, p_round_number: 4, p_transcript: CANNED_AI, p_duration_seconds: 90 })).data;
    assert(results, "ai-backfill: AI rebuttal advances to judging", aiNext4 === "judging", String(aiNext4));
    const { data: aiDuelAfter } = await supabase.from("debate_duels").select("status, current_phase").eq("id", aiDuel!.id).single();
    const { data: aiSpeeches } = await supabase.from("debate_duel_speeches").select("round_number").eq("duel_id", aiDuel!.id);
    assert(results, "ai-backfill: duel now judging with all 4 speeches", aiDuelAfter?.status === "judging" && aiDuelAfter?.current_phase === "judging" && aiSpeeches?.length === 4, `${JSON.stringify(aiDuelAfter)} speeches=${aiSpeeches?.length}`);

    // ---- Scenario 8: no-cookie internal finalize (pg_net handoff path) ------
    // Exercises judgeDebateDuelRoomInternal — the exact code path the pg_net
    // watchdog hits via /judge when BOTH players have disconnected: no session,
    // service-role client only. Gated behind --judge (calls the real model).
    if (runJudge) {
      const { judgeDebateDuelRoomInternal } = await import(
        "../apps/web/src/lib/api/debate-duels"
      );
      const [propUser8, oppUser8] = await Promise.all([
        createTempUser(supabase, "p8"),
        createTempUser(supabase, "o8"),
      ]);
      createdUsers.push(propUser8, oppUser8);
      const duel8 = await createDuel(supabase, { creatorId: propUser8, opponentId: oppUser8 });
      createdDuelIds.push(duel8.id);
      const byRole8 = await addParticipants(supabase, duel8.id, propUser8, oppUser8);
      await addSpeeches(supabase, duel8.id, byRole8);
      // Park it in `judging`, exactly as the watchdog leaves an abandoned duel.
      await supabase
        .from("debate_duels")
        .update({ status: "judging", current_phase: "judging", phase_started_at: null })
        .eq("id", duel8.id);

      const internalResult = (await judgeDebateDuelRoomInternal(duel8.share_code)) as {
        finalized?: boolean;
        reason?: string;
      };
      assert(results, "internal-finalize: returns finalized=true", internalResult?.finalized === true, JSON.stringify(internalResult));

      const { data: duel8Row } = await supabase
        .from("debate_duels")
        .select("status, current_phase, completed_at, rating_processed_at, stats_finalized_at")
        .eq("id", duel8.id)
        .single();
      assert(results, "internal-finalize: duel completed (no cookie)", duel8Row?.status === "completed" && duel8Row?.current_phase === "completed" && !!duel8Row?.completed_at, JSON.stringify(duel8Row));
      assert(results, "internal-finalize: hidden rating processed", !!duel8Row?.rating_processed_at, `rating_processed_at=${duel8Row?.rating_processed_at}`);
      assert(results, "internal-finalize: stats finalized (XP/streak path ran)", !!duel8Row?.stats_finalized_at, `stats_finalized_at=${duel8Row?.stats_finalized_at}`);

      const { data: judg8 } = await supabase
        .from("debate_duel_judgments")
        .select("winner_side")
        .eq("duel_id", duel8.id)
        .maybeSingle();
      assert(results, "internal-finalize: a real judgment row was written", !!judg8?.winner_side, JSON.stringify(judg8));

      const { data: events8 } = await supabase
        .from("duel_rating_events")
        .select("id")
        .eq("duel_id", duel8.id);
      assert(results, "internal-finalize: rating resolved cleanly (0 or 2 events, never partial)", events8?.length === 0 || events8?.length === 2, `count=${events8?.length}`);

      // Idempotency: a second handoff (pg_net retry / racing client) no-ops.
      const internalAgain = (await judgeDebateDuelRoomInternal(duel8.share_code)) as {
        finalized?: boolean;
        reason?: string;
      };
      assert(results, "internal-finalize: idempotent (already_completed)", internalAgain?.finalized === false && internalAgain?.reason === "already_completed", JSON.stringify(internalAgain));
    }
  } finally {
    // Teardown. orb_transactions -> profiles has NO on-delete-cascade, so the
    // signup-bonus row blocks auth-user deletion (which otherwise cascades all
    // duel rows). Clear duel rows + orb rows first, then delete the users.
    if (createdDuelIds.length > 0) {
      await supabase.from("debate_duels").delete().in("id", createdDuelIds);
    }
    if (createdUsers.length > 0) {
      await supabase.from("duel_mmr_profiles").delete().in("user_id", createdUsers);
      await supabase.from("orb_transactions").delete().in("user_id", createdUsers);
    }
    const teardownErrors: string[] = [];
    for (const userId of createdUsers) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) teardownErrors.push(`${userId}: ${error.message}`);
    }
    if (teardownErrors.length > 0) {
      console.error("TEARDOWN INCOMPLETE — shadow users left behind:", teardownErrors);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    judgeCalled: runJudge,
    judge: judgeReport,
    aiCalled: runAi,
    ai: aiReport,
    totals: { passed, failed, total: results.length },
    assertions: results,
  };

  await mkdir(outDir, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/g, "-");
  await writeFile(path.join(outDir, `${stamp}.json`), JSON.stringify(summary, null, 2));

  console.info(
    JSON.stringify(
      {
        artifact: path.join(outDir, `${stamp}.json`),
        judgeCalled: runJudge,
        judge: judgeReport,
        aiCalled: runAi,
        ai: aiReport,
        passed,
        failed,
        failures: results.filter((r) => !r.pass),
      },
      null,
      2
    )
  );

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
