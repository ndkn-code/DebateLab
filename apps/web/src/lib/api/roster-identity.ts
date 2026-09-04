/**
 * Roster identity resolver — the one place a class roster turns user ids into
 * names an adult can read.
 *
 * WHY THIS EXISTS. `profiles` RLS is admin-or-self. A club owner or a class
 * teacher reading `profiles` for their own students gets `[]`, so every roster
 * row rendered "Unnamed student" with a blank email and the spreadsheet exports
 * — the manual fallback for reporting to parents — shipped empty.
 *
 * WHY NOT LOOSEN RLS. A `profiles` row is a *consumer* identity: it is read by
 * public and social surfaces (`private.get_profile_public_data`,
 * `search_profile_discovery`, leaderboards), guarded by
 * `private.prevent_profile_authority_escalation`, and dumped wholesale into a
 * user-downloadable JSON at `settings/export`. Widening the policy would leak
 * PII into surfaces that were never designed to hold it.
 *
 * SO: gate first, then escalate. This is the idiom the IELTS B2B assignment
 * path already uses — `getAssignmentResultsForManager` authorizes with
 * `requireClassManager`, *then* reads names with the service-role client
 * (`lib/api/ielts/assignment-results-repository.ts:133`). This module is that
 * read, generalized, so the legacy roster and all three exports share one
 * resolver instead of three copies of the same escalation.
 *
 * THREE THINGS KEEP THE ESCALATION HONEST:
 *   1. A scope can only be minted from a `ClassManagerContext`, which only
 *      `requireClassManager` / `requireClassOwner` produce. Scopes are tracked
 *      in a module-private `WeakSet`, so a hand-rolled literal is rejected at
 *      runtime, not merely discouraged by types.
 *   2. The requested ids are intersected with `class_memberships` for the
 *      scope's own class *before* `profiles` is touched. Authorizing class A
 *      and then asking for class B's ids resolves nothing.
 *   3. The `profiles` read is an explicit five-column list, never `select *`.
 *
 * UNRESOLVED KEYS ARE ABSENT, NOT BLANK. Callers keep whatever they already
 * had, so a missing service-role key degrades to today's behaviour instead of
 * erasing names that were already visible.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryCreateTypedAdminClient } from "@/lib/supabase/admin";
import { ROSTER_IMPORT_V1 } from "@/lib/features";
import type { ClassManagerContext } from "./class-manager-access";

/** What a resolved roster row knows about a person. */
export interface RosterIdentity {
  /** Null when neither source carried a usable name; the caller keeps its own fallback. */
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  /** Which source the name came from. Null when only an email was found. */
  source: "profile" | "student_record" | null;
}

/**
 * One roster row to resolve. `key` is whatever the caller wants to look the
 * result back up by — a user id for a `class_memberships` row, a record id for
 * an imported student who has not registered yet.
 */
export interface RosterIdentityRef {
  key: string;
  userId: string | null;
  /** B3 `student_records.id` for a paper-roster row with no account. */
  studentRecordId?: string | null;
}

/** Proof that an ownership check ran. Mint it with `rosterScopeFromClassManager`. */
export interface RosterIdentityScope {
  readonly classId: string;
  readonly clubId: string | null;
  readonly managerUserId: string;
  readonly role: ClassManagerContext["role"];
}

export interface RosterProfileRow {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
}

export interface RosterStudentRecordRow {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
}

/**
 * The reads this resolver performs, named so a test can supply them without a
 * database. `createServiceRoleRosterReader` is the production implementation.
 */
export interface RosterIdentityReader {
  /** Intersection of `userIds` with this class's memberships. The ownership check. */
  classMemberUserIds(
    classId: string,
    userIds: readonly string[],
  ): Promise<string[]>;
  profiles(userIds: readonly string[]): Promise<RosterProfileRow[]>;
  /** Club-scoped B3 records, matched by linked user id or by record id. */
  studentRecords(input: {
    clubId: string;
    userIds: readonly string[];
    recordIds: readonly string[];
  }): Promise<RosterStudentRecordRow[]>;
}

const authorizedScopes = new WeakSet<RosterIdentityScope>();

/**
 * The only way to get a scope. `ClassManagerContext` is produced exclusively by
 * `requireClassManager` (and `requireClassOwner`, which wraps it), so holding
 * one means the ownership check already ran and passed.
 */
export function rosterScopeFromClassManager(
  context: ClassManagerContext,
): RosterIdentityScope {
  const scope: RosterIdentityScope = {
    classId: context.classId,
    clubId: context.clubId,
    managerUserId: context.userId,
    role: context.role,
  };
  authorizedScopes.add(scope);
  return scope;
}

function localPart(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  const [name] = trimmed.split("@");
  return name || null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Name precedence, pure and unit-tested.
 *
 * The registered profile name wins because a student who set their own name is
 * the best authority on it. The imported `student_records.full_name` comes next
 * — that is the centre's own roster spelling, diacritics intact, and it is the
 * only name an imported-but-not-yet-registered student has. An email local part
 * is a last resort, better than "Unnamed student" but not by much.
 */
export function projectRosterIdentity(
  profile: RosterProfileRow | null | undefined,
  record: RosterStudentRecordRow | null | undefined,
): RosterIdentity | null {
  if (!profile && !record) return null;
  const profileName = clean(profile?.display_name);
  const recordName = clean(record?.full_name);
  const email = clean(profile?.email) ?? clean(record?.email);
  const displayName =
    profileName ?? recordName ?? localPart(profile?.email ?? record?.email);
  const source = profileName
    ? ("profile" as const)
    : recordName
      ? ("student_record" as const)
      : null;
  return {
    displayName,
    email,
    avatarUrl: clean(profile?.avatar_url),
    role: clean(profile?.role),
    source,
  };
}

function unique(values: ReadonlyArray<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Service-role reader. Every query is scoped: memberships by the authorized
 * class, profiles by the ids that survived that check, student records by the
 * authorized club.
 */
export function createServiceRoleRosterReader(): RosterIdentityReader | null {
  const admin = tryCreateTypedAdminClient();
  if (!admin) return null;
  return {
    async classMemberUserIds(classId, userIds) {
      if (userIds.length === 0) return [];
      const { data, error } = await admin
        .from("class_memberships")
        .select("user_id")
        .eq("class_id", classId)
        .in("user_id", [...userIds]);
      if (error) throw new Error(`roster identity memberships: ${error.message}`);
      return (data ?? []).map((row) => row.user_id);
    },
    async profiles(userIds) {
      if (userIds.length === 0) return [];
      const { data, error } = await admin
        .from("profiles")
        .select("id, display_name, email, avatar_url, role")
        .in("id", [...userIds]);
      if (error) throw new Error(`roster identity profiles: ${error.message}`);
      return (data ?? []) as RosterProfileRow[];
    },
    async studentRecords({ clubId, userIds, recordIds }) {
      // `student_records` ships in `20260904130000_club_student_records.sql`,
      // which is not applied yet, so it is absent from the generated `Database`
      // type — the same untyped hop `assignment-results-repository` takes for
      // `ielts_effective_attempt_scores`. The flag is the "has the migration
      // landed" signal (`lib/features.ts`), and it belongs here rather than in
      // the resolver: whether the table exists is a property of the reader.
      // Even with the flag on, a query error degrades to profile-only names —
      // the export must never fail over an enrichment.
      if (!ROSTER_IMPORT_V1) return [];
      const db = admin as unknown as SupabaseClient;
      const rows: RosterStudentRecordRow[] = [];
      const columns = "id, user_id, full_name, email";
      if (userIds.length > 0) {
        const { data, error } = await db
          .from("student_records")
          .select(columns)
          .eq("club_id", clubId)
          .in("user_id", [...userIds]);
        if (error) return rows;
        rows.push(...((data ?? []) as RosterStudentRecordRow[]));
      }
      if (recordIds.length > 0) {
        const { data, error } = await db
          .from("student_records")
          .select(columns)
          .eq("club_id", clubId)
          .in("id", [...recordIds]);
        if (error) return rows;
        rows.push(...((data ?? []) as RosterStudentRecordRow[]));
      }
      return rows;
    },
  };
}

/**
 * Resolve names for an already-authorized roster.
 *
 * Returns a map keyed by `RosterIdentityRef.key`, containing an entry only for
 * the refs that resolved. Anything the caller asked for that is not a member of
 * the scope's class (or a record in its club) is simply absent.
 */
export async function resolveRosterIdentities(
  scope: RosterIdentityScope,
  refs: readonly RosterIdentityRef[],
  reader: RosterIdentityReader | null = createServiceRoleRosterReader(),
): Promise<Map<string, RosterIdentity>> {
  if (!authorizedScopes.has(scope)) {
    // A scope that did not come out of `rosterScopeFromClassManager` did not
    // come out of an ownership check either.
    throw new Error("Forbidden");
  }
  const resolved = new Map<string, RosterIdentity>();
  if (!reader || refs.length === 0) return resolved;

  const requestedUserIds = unique(refs.map((ref) => ref.userId));
  const requestedRecordIds = unique(refs.map((ref) => ref.studentRecordId));

  // Ownership check on the ids themselves, before `profiles` is read at all.
  const allowedUserIds = new Set(
    requestedUserIds.length > 0
      ? await reader.classMemberUserIds(scope.classId, requestedUserIds)
      : [],
  );
  const userIds = requestedUserIds.filter((id) => allowedUserIds.has(id));

  const [profileRows, recordRows] = await Promise.all([
    reader.profiles(userIds),
    scope.clubId && (userIds.length > 0 || requestedRecordIds.length > 0)
      ? reader.studentRecords({
          clubId: scope.clubId,
          userIds,
          recordIds: requestedRecordIds,
        })
      : Promise.resolve<RosterStudentRecordRow[]>([]),
  ]);

  const profilesById = new Map(profileRows.map((row) => [row.id, row]));
  const recordsById = new Map(recordRows.map((row) => [row.id, row]));
  const recordsByUserId = new Map(
    recordRows.flatMap((row) => (row.user_id ? [[row.user_id, row] as const] : [])),
  );

  for (const ref of refs) {
    const profile = ref.userId ? profilesById.get(ref.userId) : null;
    const record =
      (ref.studentRecordId ? recordsById.get(ref.studentRecordId) : null) ??
      (ref.userId ? recordsByUserId.get(ref.userId) : null) ??
      null;
    // A record id the caller supplied but the club does not own resolves to
    // nothing, exactly like a user id outside the class.
    const identity = projectRosterIdentity(profile, record);
    if (identity) resolved.set(ref.key, identity);
  }
  return resolved;
}
