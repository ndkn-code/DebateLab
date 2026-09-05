/**
 * Roster identity resolver (B3 export fix).
 *
 * The bug this guards: `profiles` RLS is admin-or-self, so a club owner or class
 * teacher exporting their own roster got "Unnamed student" in every row and a
 * blank email column. The fix escalates to the service-role client — but only
 * after `requireClassManager` has returned a context, and only for ids that
 * belong to that context's class.
 *
 * No database. The resolver's reads are behind `RosterIdentityReader`, so the
 * fake below is the whole world: what the class contains, what `profiles`
 * holds, and what the B3 `student_records` table holds. Run with
 * `--conditions=react-server` because the module under test is `server-only`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cellText } from "@/lib/export";
import {
  CLASS_ROSTER_EXPORT_COLUMNS,
  IELTS_GRADEBOOK_EXPORT_COLUMNS,
} from "@/lib/api/class-exports";
import type { AdminClassRosterRow } from "@/lib/types/admin-classes";
import type { IeltsGradebookRow } from "@/lib/api/ielts/gradebook-repository";
import type { ClassManagerContext } from "./class-manager-access";
import {
  projectRosterIdentity,
  resolveRosterIdentities,
  rosterScopeFromClassManager,
  type RosterIdentity,
  type RosterIdentityReader,
  type RosterIdentityScope,
  type RosterProfileRow,
  type RosterStudentRecordRow,
} from "./roster-identity";

const CLASS_ID = "00000000-0000-4000-8000-0000000000c1";
const OTHER_CLASS_ID = "00000000-0000-4000-8000-0000000000c2";
const CLUB_ID = "00000000-0000-4000-8000-0000000000b1";
const TEACHER_ID = "00000000-0000-4000-8000-0000000000f1";

const REGISTERED = "00000000-0000-4000-8000-000000000001";
const NAMELESS = "00000000-0000-4000-8000-000000000002";
const OUTSIDER = "00000000-0000-4000-8000-000000000003";
const PAPER_RECORD = "00000000-0000-4000-8000-0000000000a1";

/** A class teacher, exactly what `requireClassManager` returns for one. */
function teacherContext(classId = CLASS_ID): ClassManagerContext {
  return { userId: TEACHER_ID, classId, clubId: CLUB_ID, role: "teacher" };
}

const MEMBERSHIPS: Record<string, string[]> = {
  [CLASS_ID]: [REGISTERED, NAMELESS],
  [OTHER_CLASS_ID]: [OUTSIDER],
};

const PROFILES: RosterProfileRow[] = [
  {
    id: REGISTERED,
    display_name: "Nguyễn Thị Mai",
    email: "mai@example.com",
    avatar_url: "https://cdn.example.com/mai.png",
    role: "student",
  },
  // Claimed the invite, never set a name: this is the row the centre's own
  // roster spelling has to rescue.
  { id: NAMELESS, display_name: "  ", email: null, avatar_url: null, role: "student" },
  {
    id: OUTSIDER,
    display_name: "Trần Văn Bình",
    email: "binh@example.com",
    avatar_url: null,
    role: "student",
  },
];

const RECORDS: RosterStudentRecordRow[] = [
  { id: "rec-nameless", user_id: NAMELESS, full_name: "Lê Hoàng Anh", email: "anh@example.com" },
  // Imported, never registered: `user_id` is null and `full_name` is all we have.
  { id: PAPER_RECORD, user_id: null, full_name: "Phạm Gia Huy", email: "huy@example.com" },
];

interface ReaderCalls {
  memberships: number;
  profileIds: string[][];
}

function fakeReader(calls: ReaderCalls, clubId = CLUB_ID): RosterIdentityReader {
  return {
    async classMemberUserIds(classId, userIds) {
      calls.memberships += 1;
      const members = new Set(MEMBERSHIPS[classId] ?? []);
      return userIds.filter((id) => members.has(id));
    },
    async profiles(userIds) {
      calls.profileIds.push([...userIds]);
      return PROFILES.filter((row) => userIds.includes(row.id));
    },
    async studentRecords(input) {
      if (input.clubId !== clubId) return [];
      return RECORDS.filter(
        (row) =>
          (row.user_id !== null && input.userIds.includes(row.user_id)) ||
          input.recordIds.includes(row.id),
      );
    },
  };
}

function noCalls(): ReaderCalls {
  return { memberships: 0, profileIds: [] };
}

// ---- name precedence, pure -----------------------------------------------

test("profile name wins, student record rescues a nameless profile", () => {
  const profile = PROFILES[0];
  const record = RECORDS[0];
  assert.equal(projectRosterIdentity(profile, record)?.displayName, "Nguyễn Thị Mai");
  assert.equal(projectRosterIdentity(profile, record)?.source, "profile");

  const rescued = projectRosterIdentity(PROFILES[1], record);
  assert.equal(rescued?.displayName, "Lê Hoàng Anh");
  assert.equal(rescued?.source, "student_record");
  assert.equal(rescued?.email, "anh@example.com");
});

test("an email local part is the last resort, and nothing resolves to nothing", () => {
  const emailOnly = projectRosterIdentity(
    { id: REGISTERED, display_name: null, email: "mai@example.com", avatar_url: null, role: null },
    null,
  );
  assert.equal(emailOnly?.displayName, "mai");
  assert.equal(emailOnly?.source, null);
  assert.equal(projectRosterIdentity(null, null), null);
});

// ---- the manager path ----------------------------------------------------

test("a class manager resolves real names and emails for their own roster", async () => {
  const calls = noCalls();
  const identities = await resolveRosterIdentities(
    rosterScopeFromClassManager(teacherContext()),
    [
      { key: REGISTERED, userId: REGISTERED },
      { key: NAMELESS, userId: NAMELESS },
    ],
    fakeReader(calls),
  );

  assert.equal(identities.get(REGISTERED)?.displayName, "Nguyễn Thị Mai");
  assert.equal(identities.get(REGISTERED)?.email, "mai@example.com");
  assert.equal(identities.get(REGISTERED)?.avatarUrl, "https://cdn.example.com/mai.png");
  // The nameless profile falls through to the centre's imported spelling.
  assert.equal(identities.get(NAMELESS)?.displayName, "Lê Hoàng Anh");
});

test("the resolved name is what the roster sheet prints", () => {
  const identity: RosterIdentity = {
    displayName: "Nguyễn Thị Mai",
    email: "mai@example.com",
    avatarUrl: null,
    role: "student",
    source: "profile",
  };
  const row: AdminClassRosterRow = {
    membershipId: "m1",
    id: REGISTERED,
    displayName: identity.displayName || "Unnamed student",
    email: identity.email,
    avatarUrl: identity.avatarUrl,
    role: identity.role,
    memberRole: "student",
    status: "active",
    joinedAt: "2026-09-01T00:00:00.000Z",
    attendanceRate30d: 1,
    present30d: 4,
    late30d: 0,
    absent30d: 0,
  };
  const name = CLASS_ROSTER_EXPORT_COLUMNS[0];
  const email = CLASS_ROSTER_EXPORT_COLUMNS[1];
  assert.equal(cellText(name.value(row, "vi")), "Nguyễn Thị Mai");
  assert.equal(cellText(email.value(row, "vi")), "mai@example.com");
});

// ---- the rejection path --------------------------------------------------

test("a scope that did not come from an ownership check is rejected", async () => {
  const calls = noCalls();
  // Exactly the right shape, never minted by `rosterScopeFromClassManager`.
  const forged = {
    classId: CLASS_ID,
    clubId: CLUB_ID,
    managerUserId: TEACHER_ID,
    role: "admin",
  } as RosterIdentityScope;

  await assert.rejects(
    () => resolveRosterIdentities(forged, [{ key: REGISTERED, userId: REGISTERED }], fakeReader(calls)),
    /Forbidden/,
  );
  // The service-role read never happened.
  assert.equal(calls.memberships, 0);
  assert.deepEqual(calls.profileIds, []);
});

test("authorizing one class does not resolve another class's students", async () => {
  const calls = noCalls();
  const identities = await resolveRosterIdentities(
    rosterScopeFromClassManager(teacherContext()),
    [
      { key: REGISTERED, userId: REGISTERED },
      { key: OUTSIDER, userId: OUTSIDER },
    ],
    fakeReader(calls),
  );

  assert.equal(identities.get(REGISTERED)?.displayName, "Nguyễn Thị Mai");
  assert.equal(identities.has(OUTSIDER), false);
  // `profiles` was only ever asked about the ids that survived the class check.
  assert.deepEqual(calls.profileIds, [[REGISTERED]]);
});

test("no service-role client means callers keep their own fallback, not blanks", async () => {
  const identities = await resolveRosterIdentities(
    rosterScopeFromClassManager(teacherContext()),
    [{ key: REGISTERED, userId: REGISTERED }],
    null,
  );
  assert.equal(identities.size, 0);
});

// ---- roster-first, account-later -----------------------------------------

test("an imported student with no account still exports their real name", async () => {
  const calls = noCalls();
  const identities = await resolveRosterIdentities(
    rosterScopeFromClassManager(teacherContext()),
    [{ key: PAPER_RECORD, userId: null, studentRecordId: PAPER_RECORD }],
    fakeReader(calls),
  );

  const identity = identities.get(PAPER_RECORD);
  assert.equal(identity?.displayName, "Phạm Gia Huy");
  assert.equal(identity?.source, "student_record");
  assert.equal(identity?.email, "huy@example.com");
  // No user id was requested, so no profile lookup was made at all.
  assert.deepEqual(calls.profileIds, [[]]);

  const row = {
    userId: PAPER_RECORD,
    displayName: identity?.displayName ?? "Unnamed student",
    email: identity?.email ?? "",
    membershipStatus: "active",
    historical: false,
    attendance: { present: 0, late: 0, absent: 0, rate: null },
    courses: [],
    assignments: [],
  } as unknown as IeltsGradebookRow;
  assert.equal(cellText(IELTS_GRADEBOOK_EXPORT_COLUMNS[0].value(row, "vi")), "Phạm Gia Huy");
  assert.equal(cellText(IELTS_GRADEBOOK_EXPORT_COLUMNS[1].value(row, "vi")), "huy@example.com");
});

test("a student record from another club resolves to nothing", async () => {
  const calls = noCalls();
  const identities = await resolveRosterIdentities(
    rosterScopeFromClassManager({ ...teacherContext(), clubId: "00000000-0000-4000-8000-0000000000b2" }),
    [{ key: PAPER_RECORD, userId: null, studentRecordId: PAPER_RECORD }],
    fakeReader(calls),
  );
  assert.equal(identities.has(PAPER_RECORD), false);
});
