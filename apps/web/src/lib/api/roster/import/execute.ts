/**
 * Roster import executor (B3) — phases 2 and 3.
 *
 * Phase 2 `resolveRosterImport` is a dry run: it reads, matches, predicts an
 * outcome per row and checks class capacity, but writes nothing. Phase 3
 * `commitRosterImport` writes in chunks.
 *
 * **Capacity is checked before any write.** `private.enforce_class_capacity`
 * (`20260829010000_class_manager_authorization.sql:130`) takes an advisory lock
 * and raises mid-statement, so discovering the limit during a batch would abort
 * it with rows already applied.
 *
 * **Idempotency, two levels.** Batch level: a confirmed import carries an
 * idempotency key, and re-submitting returns the stored report. Row level:
 * matching on email → student_code → phone means re-importing the same file
 * reports `skipped`, which is what makes fix-the-errors-and-re-upload safe.
 *
 * The types below are declared by hand because the migration
 * (`20260904130000_club_student_records.sql`) is **not applied**; regenerate
 * `types/supabase.ts` through the Supabase MCP once it is, and this file keeps
 * working because it selects an explicit column list.
 */
import "server-only";
import { inviteOrganizationMember } from "@/lib/api/organizations/workflows";
import { nameMatchKey } from "./normalize";
import type {
  PlannedRosterRow,
  RosterImportPlan,
  RosterImportReport,
  RosterRecordInput,
  RosterRowIssue,
  RosterRowResult,
} from "./types";
import { countOutcomes } from "./types";

/**
 * The untyped cookie-bound Supabase client, matching how
 * `app/actions/admin-classes.ts` already works. Reads and writes are RLS-gated
 * by the policies in the B3 migration; column names are pinned by the explicit
 * select list below rather than by generated types, because the migration is
 * not applied yet.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RosterDbClient = any;

const RECORD_COLUMNS =
  "id, club_id, user_id, full_name, student_code, email, date_of_birth, phone, guardian_name, guardian_phone, guardian_email, notes, status";

interface ExistingRecord {
  id: string;
  club_id: string;
  user_id: string | null;
  full_name: string;
  student_code: string | null;
  email: string | null;
  date_of_birth: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  notes: string | null;
  status: string;
}

export interface RosterImportContext {
  supabase: RosterDbClient;
  clubId: string;
  /** When set, imported students are also enrolled in this class. */
  classId: string | null;
  actorId: string;
}

export interface RosterCommitOptions {
  /** Batch replay guard. The dialog generates one per confirmed import. */
  idempotencyKey: string;
  sourceFilename?: string | null;
}

/** Rows are written in chunks so one failure never costs the whole batch. */
const CHUNK_SIZE = 25;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadExisting(ctx: RosterImportContext): Promise<ExistingRecord[]> {
  const { data, error } = await ctx.supabase
    .from("student_records")
    .select(RECORD_COLUMNS)
    .eq("club_id", ctx.clubId)
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExistingRecord[];
}

interface MatchIndex {
  byEmail: Map<string, ExistingRecord[]>;
  byCode: Map<string, ExistingRecord>;
  byPhone: Map<string, ExistingRecord[]>;
  byNameDob: Map<string, ExistingRecord[]>;
}

function indexExisting(records: readonly ExistingRecord[]): MatchIndex {
  const index: MatchIndex = {
    byEmail: new Map(),
    byCode: new Map(),
    byPhone: new Map(),
    byNameDob: new Map(),
  };
  const push = (map: Map<string, ExistingRecord[]>, key: string, record: ExistingRecord) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(record);
    else map.set(key, [record]);
  };
  for (const record of records) {
    if (record.email) push(index.byEmail, record.email.toLowerCase(), record);
    if (record.student_code) index.byCode.set(record.student_code.toLowerCase(), record);
    if (record.phone) push(index.byPhone, record.phone, record);
    push(index.byNameDob, nameMatchKey(record.full_name, record.date_of_birth), record);
  }
  return index;
}

type MatchResult =
  | { kind: "none" }
  | { kind: "hard"; record: ExistingRecord }
  /** Name + DOB only. Never merged automatically — `Nguyễn Văn A` is not unique. */
  | { kind: "soft"; record: ExistingRecord; count: number };

function matchExisting(values: RosterRecordInput, index: MatchIndex): MatchResult {
  if (values.email) {
    const hits = index.byEmail.get(values.email) ?? [];
    if (hits.length === 1) return { kind: "hard", record: hits[0] };
    if (hits.length > 1) return { kind: "soft", record: hits[0], count: hits.length };
  }
  if (values.studentCode) {
    const hit = index.byCode.get(values.studentCode.toLowerCase());
    if (hit) return { kind: "hard", record: hit };
  }
  if (values.phone) {
    const hits = index.byPhone.get(values.phone) ?? [];
    if (hits.length === 1) return { kind: "hard", record: hits[0] };
    if (hits.length > 1) return { kind: "soft", record: hits[0], count: hits.length };
  }
  if (values.fullName && values.dateOfBirth) {
    const hits = index.byNameDob.get(nameMatchKey(values.fullName, values.dateOfBirth)) ?? [];
    if (hits.length > 0) return { kind: "soft", record: hits[0], count: hits.length };
  }
  return { kind: "none" };
}

const FIELD_TO_COLUMN: Array<[keyof RosterRecordInput, keyof ExistingRecord]> = [
  ["fullName", "full_name"],
  ["studentCode", "student_code"],
  ["email", "email"],
  ["dateOfBirth", "date_of_birth"],
  ["phone", "phone"],
  ["guardianName", "guardian_name"],
  ["guardianPhone", "guardian_phone"],
  ["guardianEmail", "guardian_email"],
  ["notes", "notes"],
];

/**
 * Only non-null incoming values are written. A partial sheet must never blank a
 * phone number that someone typed in by hand last term — an importer that
 * quietly deletes data is worse than one that refuses to run.
 */
function diffAgainst(
  values: RosterRecordInput,
  record: ExistingRecord,
): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const [field, column] of FIELD_TO_COLUMN) {
    const incoming = values[field];
    if (incoming === null || incoming === "") continue;
    if (record[column] !== incoming) patch[column] = incoming;
  }
  return patch;
}

function insertPayload(
  values: RosterRecordInput,
  ctx: RosterImportContext,
  batchId: string | null,
): Record<string, unknown> {
  return {
    club_id: ctx.clubId,
    full_name: values.fullName,
    student_code: values.studentCode,
    email: values.email,
    date_of_birth: values.dateOfBirth,
    phone: values.phone,
    guardian_name: values.guardianName,
    guardian_phone: values.guardianPhone,
    guardian_email: values.guardianEmail,
    notes: values.notes,
    import_batch_id: batchId,
    created_by: ctx.actorId,
  };
}

async function loadCapacity(
  ctx: RosterImportContext,
): Promise<{ max: number | null; current: number }> {
  if (!ctx.classId) return { max: null, current: 0 };
  const [classRes, membershipRes, enrollmentRes] = await Promise.all([
    ctx.supabase.from("classes").select("max_students").eq("id", ctx.classId).maybeSingle(),
    ctx.supabase
      .from("class_memberships")
      .select("id", { count: "exact", head: true })
      .eq("class_id", ctx.classId)
      .eq("member_role", "student")
      .eq("status", "active"),
    ctx.supabase
      .from("student_record_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", ctx.classId)
      .eq("status", "active"),
  ]);
  if (classRes.error) throw new Error(classRes.error.message);
  return {
    max: (classRes.data?.max_students as number | null) ?? null,
    current: Math.max(membershipRes.count ?? 0, enrollmentRes.count ?? 0),
  };
}

interface RowPlanEntry {
  row: PlannedRosterRow;
  match: MatchResult;
  patch: Record<string, string | null>;
}

function classifyRows(
  plan: RosterImportPlan,
  index: MatchIndex,
): { entries: RowPlanEntry[]; results: RosterRowResult[] } {
  const entries: RowPlanEntry[] = [];
  const results: RosterRowResult[] = [];
  for (const row of plan.rows) {
    if (row.blocked) {
      results.push({
        rowNumber: row.rowNumber,
        fullName: row.values.fullName,
        email: row.values.email,
        outcome: "error",
        studentRecordId: null,
        issues: row.issues,
      });
      continue;
    }
    const match = matchExisting(row.values, index);
    if (match.kind === "soft") {
      results.push({
        rowNumber: row.rowNumber,
        fullName: row.values.fullName,
        email: row.values.email,
        outcome: "needs_review",
        studentRecordId: match.record.id,
        issues: [
          ...row.issues,
          {
            field: "fullName",
            code: "ambiguous_name_match",
            detail: `${match.record.full_name}${match.count > 1 ? ` (${match.count})` : ""}`,
          } satisfies RosterRowIssue,
        ],
      });
      continue;
    }
    const patch = match.kind === "hard" ? diffAgainst(row.values, match.record) : {};
    entries.push({ row, match, patch });
    results.push({
      rowNumber: row.rowNumber,
      fullName: row.values.fullName,
      email: row.values.email,
      outcome:
        match.kind === "none"
          ? "created"
          : Object.keys(patch).length > 0
            ? "updated"
            : "skipped",
      studentRecordId: match.kind === "hard" ? match.record.id : null,
      issues: [],
    });
  }
  return { entries, results };
}

function applyCapacity(
  results: RosterRowResult[],
  capacity: { max: number | null; current: number },
): { max: number | null; current: number; incoming: number } {
  const incoming = results.filter((row) => row.outcome === "created").length;
  if (capacity.max !== null && capacity.current + incoming > capacity.max) {
    let allowed = Math.max(0, capacity.max - capacity.current);
    for (const result of results) {
      if (result.outcome !== "created") continue;
      if (allowed > 0) {
        allowed -= 1;
        continue;
      }
      result.outcome = "error";
      result.issues = [
        ...result.issues,
        { field: null, code: "class_at_capacity", detail: `${capacity.max}` },
      ];
    }
  }
  return { ...capacity, incoming };
}

/** Phase 2. Reads and predicts; writes nothing. */
export async function resolveRosterImport(
  plan: RosterImportPlan,
  ctx: RosterImportContext,
): Promise<RosterImportReport> {
  const index = indexExisting(await loadExisting(ctx));
  const { results } = classifyRows(plan, index);
  const capacity = applyCapacity(results, await loadCapacity(ctx));
  return {
    batchId: null,
    dryRun: true,
    counts: countOutcomes(results),
    rows: results,
    warnings: plan.warnings,
    capacity: ctx.classId ? capacity : null,
  };
}

async function findReplay(
  ctx: RosterImportContext,
  idempotencyKey: string,
): Promise<RosterImportReport | null> {
  const { data, error } = await ctx.supabase
    .from("roster_import_batches")
    .select("id, report")
    .eq("club_id", ctx.clubId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error || !data) return null;
  const report = data.report as RosterImportReport | null;
  if (!report || !Array.isArray(report.rows)) return null;
  return { ...report, batchId: data.id as string };
}

async function enrollRecords(
  ctx: RosterImportContext,
  recordIds: readonly string[],
  batchId: string,
): Promise<void> {
  if (!ctx.classId || recordIds.length === 0) return;
  const { error } = await ctx.supabase.from("student_record_enrollments").upsert(
    recordIds.map((id) => ({
      student_record_id: id,
      class_id: ctx.classId,
      status: "active",
      removed_at: null,
      import_batch_id: batchId,
    })),
    { onConflict: "student_record_id,class_id" },
  );
  if (error) throw new Error(error.message);
}

async function writeChunk(
  entries: readonly RowPlanEntry[],
  byRow: Map<number, RosterRowResult>,
  ctx: RosterImportContext,
  batchId: string,
): Promise<string[]> {
  const touched: string[] = [];
  const inserts = entries.filter((entry) => entry.match.kind === "none");
  if (inserts.length > 0) {
    const { data, error } = await ctx.supabase
      .from("student_records")
      .insert(inserts.map((entry) => insertPayload(entry.row.values, ctx, batchId)))
      .select("id");
    if (error) {
      for (const entry of inserts) {
        const result = byRow.get(entry.row.rowNumber);
        if (!result) continue;
        result.outcome = "error";
        result.issues = [
          ...result.issues,
          { field: null, code: "write_failed", detail: error.message },
        ];
      }
    } else {
      // PostgREST returns inserted rows in submission order, so position maps
      // back to the source row. Guard the assumption rather than trust it: a
      // mismatch would attach the wrong record id to the wrong student.
      const ids = (data ?? []).map((record: { id: string }) => record.id);
      if (ids.length === inserts.length) {
        ids.forEach((id: string, position: number) => {
          const result = byRow.get(inserts[position].row.rowNumber);
          if (result) result.studentRecordId = id;
          touched.push(id);
        });
      } else {
        touched.push(...ids);
      }
    }
  }

  for (const entry of entries) {
    if (entry.match.kind !== "hard") continue;
    const result = byRow.get(entry.row.rowNumber);
    if (entry.match.record.id) touched.push(entry.match.record.id);
    if (Object.keys(entry.patch).length === 0) continue;
    const { error } = await ctx.supabase
      .from("student_records")
      .update({ ...entry.patch, import_batch_id: batchId })
      .eq("id", entry.match.record.id);
    if (error && result) {
      result.outcome = "error";
      result.issues = [
        ...result.issues,
        { field: null, code: "write_failed", detail: error.message },
      ];
    }
  }
  return touched;
}

/** Phase 3. Chunked, per-row failure, replay-safe. */
export async function commitRosterImport(
  plan: RosterImportPlan,
  ctx: RosterImportContext,
  options: RosterCommitOptions,
): Promise<RosterImportReport> {
  const replay = await findReplay(ctx, options.idempotencyKey);
  if (replay) return replay;

  const index = indexExisting(await loadExisting(ctx));
  const { entries, results } = classifyRows(plan, index);
  const capacity = applyCapacity(results, await loadCapacity(ctx));
  const byRow = new Map(results.map((result) => [result.rowNumber, result]));

  const { data: batch, error: batchError } = await ctx.supabase
    .from("roster_import_batches")
    .insert({
      club_id: ctx.clubId,
      class_id: ctx.classId,
      created_by: ctx.actorId,
      source_filename: options.sourceFilename ?? null,
      idempotency_key: options.idempotencyKey,
      row_count: plan.rows.length,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    // A unique-violation here means a concurrent identical submit won the race.
    const raced = await findReplay(ctx, options.idempotencyKey);
    if (raced) return raced;
    throw new Error(batchError?.message ?? "Could not start the roster import.");
  }
  const batchId = batch.id as string;

  const writable = entries.filter((entry) => byRow.get(entry.row.rowNumber)?.outcome !== "error");
  const touched: string[] = [];
  for (const group of chunk(writable, CHUNK_SIZE)) {
    try {
      touched.push(...(await writeChunk(group, byRow, ctx, batchId)));
    } catch (error) {
      for (const entry of group) {
        const result = byRow.get(entry.row.rowNumber);
        if (!result || result.outcome === "error") continue;
        result.outcome = "error";
        result.issues = [
          ...result.issues,
          { field: null, code: "write_failed", detail: errorMessage(error) },
        ];
      }
    }
  }

  const warnings = [...plan.warnings];
  try {
    await enrollRecords(ctx, touched, batchId);
  } catch (error) {
    warnings.push(`Students were saved but not enrolled: ${errorMessage(error)}`);
  }

  const counts = countOutcomes(results);
  const report: RosterImportReport = {
    batchId,
    dryRun: false,
    counts,
    rows: results,
    warnings,
    capacity: ctx.classId ? capacity : null,
  };
  await ctx.supabase
    .from("roster_import_batches")
    .update({
      created_count: counts.created,
      updated_count: counts.updated,
      skipped_count: counts.skipped,
      error_count: counts.error,
      report,
    })
    .eq("id", batchId);
  return report;
}

export interface InvitationRunResult {
  invited: number;
  skipped: number;
  remaining: number;
  failures: Array<{ email: string; reason: string }>;
}

/**
 * The account rail, run separately from the record write and in bounded
 * batches.
 *
 * Deliberately **not** part of `commitRosterImport`: 150 invitation emails
 * sequentially would blow a server action's time budget, and a timeout there
 * would leave the roster half-written. Records land first (fast, safe); this is
 * resumable and idempotent, so the dialog can call it until `remaining` is 0.
 *
 * Uses `inviteOrganizationMember` — the audited, idempotency-keyed workflow that
 * `/join/club/[token]` already redeems. Nothing here provisions an account
 * directly: the student creates their own password when they claim the invite.
 */
export async function sendRosterInvitations(
  ctx: RosterImportContext,
  batchId: string,
  limit = 20,
): Promise<InvitationRunResult> {
  // `user_id` stays null until the student claims the invite, so pending is
  // keyed on `invitation_sent_at` — otherwise every run re-mails the same
  // people. Fetching limit+1 tells us whether more remain without a count query.
  const { data, error } = await ctx.supabase
    .from("student_records")
    .select("id, email")
    .eq("club_id", ctx.clubId)
    .eq("import_batch_id", batchId)
    .is("user_id", null)
    .is("invitation_sent_at", null)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit + 1);
  if (error) throw new Error(error.message);

  const pending = (data ?? []) as Array<{ id: string; email: string }>;
  const batch = pending.slice(0, limit);
  const failures: InvitationRunResult["failures"] = [];
  const sentIds: string[] = [];

  for (const record of batch) {
    try {
      await inviteOrganizationMember({
        organizationId: ctx.clubId,
        email: record.email,
        role: "student",
        // Stable per record, so a retry after a timeout re-uses the invitation
        // rather than issuing a second one.
        idempotencyKey: `roster:${batchId}:${record.id}`,
      });
      sentIds.push(record.id);
    } catch (inviteError) {
      failures.push({ email: record.email, reason: errorMessage(inviteError) });
    }
  }

  if (sentIds.length > 0) {
    // Marked after the fact: a crash between send and mark costs a duplicate
    // email, which the idempotency key absorbs. Marking first would cost a
    // student their only invitation, which nothing absorbs.
    await ctx.supabase
      .from("student_records")
      .update({ invitation_sent_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  const { count } = await ctx.supabase
    .from("student_records")
    .select("id", { count: "exact", head: true })
    .eq("import_batch_id", batchId)
    .not("invitation_sent_at", "is", null);
  await ctx.supabase
    .from("roster_import_batches")
    .update({ invited_count: count ?? sentIds.length })
    .eq("id", batchId);

  return {
    invited: sentIds.length,
    skipped: failures.length,
    remaining: Math.max(0, pending.length - batch.length),
    failures,
  };
}

