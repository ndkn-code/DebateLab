/**
 * Teacher-facing IELTS class study-plan loader (C7 / WS-5.3 follow-up).
 *
 * Authorization stays manager-gated: club/classes/roster are read through the
 * cookie-bound client and existing manager RLS. Learner-owned data (profiles,
 * active study plans, plan items, and skill states) is then read with the
 * service-role client, scoped to the roster user ids and batched by table. This
 * mirrors the WS-5.3 assignment results loader and avoids PostgREST embed
 * ambiguity around profiles/classes.
 */
import "server-only";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  buildIeltsClassStudyPlanView,
  type IeltsClassStudyPlanClassInput,
  type IeltsClassStudyPlanItemInput,
  type IeltsClassStudyPlanMembershipInput,
  type IeltsClassStudyPlanPlanInput,
  type IeltsClassStudyPlanProfileInput,
  type IeltsClassStudyPlanSurfaceView,
  type IeltsClassStudyPlanWeakSubskillInput,
} from "@/lib/ielts/study-plan/class-view";
import type { IeltsDbClient } from "./client";
import { requireClubManager, type IeltsServerClient } from "./assignment-access";

const PLAN_COLUMNS =
  "id, user_id, status, module, predicted_overall_band, target_overall_band, generated_at, next_reassessment_at";
const ITEM_COLUMNS = "id, plan_id, status, scheduled_date";
const PROFILE_COLUMNS = "id, display_name, email";
const SKILL_STATE_COLUMNS =
  "user_id, subskill_key, skill, band_estimate, confidence, weakness_weight, evidence_count, last_evidence_at";
const SUBSKILL_COLUMNS = "key, label_en, label_vi";

interface LoadIeltsClassStudyPlanOptions {
  classes?: IeltsClassStudyPlanClassInput[];
  client?: IeltsServerClient;
  todayIso?: string;
}

interface SkillStateRow {
  user_id: string;
  subskill_key: string;
  skill: IeltsClassStudyPlanWeakSubskillInput["skill"];
  band_estimate: number | null;
  confidence: number;
  weakness_weight: number;
  evidence_count: number;
  last_evidence_at: string | null;
}

interface SubskillLabelRow {
  key: string;
  label_en: string;
  label_vi: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function fallbackSubskillLabel(key: string): string {
  const [, tail = key] = key.split(":");
  return tail
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadActiveClasses(
  client: IeltsServerClient,
  clubId: string,
): Promise<IeltsClassStudyPlanClassInput[]> {
  const { data, error } = await client
    .from("classes")
    .select("id, title")
    .eq("club_id", clubId)
    .eq("status", "active")
    .order("title", { ascending: true });
  if (error) throw new Error(`loadIeltsClassStudyPlan(active classes): ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title }));
}

async function loadRoster(
  client: IeltsServerClient,
  classIds: string[],
): Promise<IeltsClassStudyPlanMembershipInput[]> {
  if (classIds.length === 0) return [];
  const { data, error } = await client
    .from("class_memberships")
    .select("class_id, user_id")
    .in("class_id", classIds)
    .eq("member_role", "student")
    .eq("status", "active")
    .order("joined_at", { ascending: true });
  if (error) throw new Error(`loadIeltsClassStudyPlan(roster): ${error.message}`);
  return (data ?? []).map((row) => ({ classId: row.class_id, userId: row.user_id }));
}

async function loadProfiles(
  admin: IeltsDbClient,
  userIds: string[],
): Promise<IeltsClassStudyPlanProfileInput[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin.from("profiles").select(PROFILE_COLUMNS).in("id", userIds);
  if (error) throw new Error(`loadIeltsClassStudyPlan(profiles): ${error.message}`);
  return (data ?? []).map((row) => ({
    userId: row.id,
    displayName: row.display_name,
    email: row.email,
  }));
}

async function loadActivePlans(
  admin: IeltsDbClient,
  userIds: string[],
): Promise<IeltsClassStudyPlanPlanInput[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from("ielts_study_plans")
    .select(PLAN_COLUMNS)
    .in("user_id", userIds)
    .eq("status", "active")
    .order("generated_at", { ascending: false });
  if (error) throw new Error(`loadIeltsClassStudyPlan(plans): ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    status: row.status,
    module: row.module,
    predictedOverallBand: row.predicted_overall_band,
    targetOverallBand: row.target_overall_band,
    generatedAt: row.generated_at,
    nextReassessmentAt: row.next_reassessment_at,
  }));
}

async function loadPlanItems(
  admin: IeltsDbClient,
  planIds: string[],
): Promise<IeltsClassStudyPlanItemInput[]> {
  if (planIds.length === 0) return [];
  const { data, error } = await admin
    .from("ielts_study_plan_items")
    .select(ITEM_COLUMNS)
    .in("plan_id", planIds);
  if (error) throw new Error(`loadIeltsClassStudyPlan(items): ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    planId: row.plan_id,
    status: row.status,
    scheduledDate: row.scheduled_date,
  }));
}

async function loadSubskillLabels(
  admin: IeltsDbClient,
  keys: string[],
): Promise<Map<string, SubskillLabelRow>> {
  const uniqueKeys = unique(keys);
  if (uniqueKeys.length === 0) return new Map();
  const { data, error } = await admin
    .from("ielts_subskills")
    .select(SUBSKILL_COLUMNS)
    .in("key", uniqueKeys);
  if (error) throw new Error(`loadIeltsClassStudyPlan(subskills): ${error.message}`);
  return new Map(((data ?? []) as SubskillLabelRow[]).map((row) => [row.key, row]));
}

async function loadWeakSubskills(
  admin: IeltsDbClient,
  userIds: string[],
): Promise<IeltsClassStudyPlanWeakSubskillInput[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from("ielts_skill_states")
    .select(SKILL_STATE_COLUMNS)
    .in("user_id", userIds)
    .gt("weakness_weight", 0)
    .gt("confidence", 0)
    .order("weakness_weight", { ascending: false });
  if (error) throw new Error(`loadIeltsClassStudyPlan(skill states): ${error.message}`);

  const rows = (data ?? []) as SkillStateRow[];
  const labels = await loadSubskillLabels(admin, rows.map((row) => row.subskill_key));
  return rows.map((row) => {
    const label = labels.get(row.subskill_key);
    const fallback = fallbackSubskillLabel(row.subskill_key);
    return {
      userId: row.user_id,
      key: row.subskill_key,
      skill: row.skill,
      labelEn: label?.label_en ?? fallback,
      labelVi: label?.label_vi ?? fallback,
      bandEstimate: row.band_estimate,
      confidence: row.confidence,
      weaknessWeight: row.weakness_weight,
      evidenceCount: row.evidence_count,
      lastEvidenceAt: row.last_evidence_at,
    };
  });
}

export async function loadIeltsClassStudyPlanForManager(
  clubId: string,
  options: LoadIeltsClassStudyPlanOptions = {},
): Promise<IeltsClassStudyPlanSurfaceView> {
  const supabase = options.client ?? (await createTypedServerClient());
  await requireClubManager(supabase, clubId);

  const classes = options.classes ?? (await loadActiveClasses(supabase, clubId));
  const roster = await loadRoster(supabase, classes.map((classRow) => classRow.id));
  const userIds = unique(roster.map((row) => row.userId));

  if (userIds.length === 0) {
    return buildIeltsClassStudyPlanView({
      classes,
      memberships: roster,
      profiles: [],
      plans: [],
      items: [],
      weakSubskills: [],
      todayIso: options.todayIso ?? todayIsoUtc(),
    });
  }

  const admin = createTypedAdminClient();
  const [profiles, plans, weakSubskills] = await Promise.all([
    loadProfiles(admin, userIds),
    loadActivePlans(admin, userIds),
    loadWeakSubskills(admin, userIds),
  ]);
  const items = await loadPlanItems(admin, plans.map((plan) => plan.id));

  return buildIeltsClassStudyPlanView({
    classes,
    memberships: roster,
    profiles,
    plans,
    items,
    weakSubskills,
    todayIso: options.todayIso ?? todayIsoUtc(),
  });
}
