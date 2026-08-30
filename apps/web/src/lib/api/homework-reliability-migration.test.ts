import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260829030000_homework_submission_reliability.sql"),
  "utf8",
);
const authorizationMigration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260829010000_class_manager_authorization.sql"),
  "utf8",
);
const action = readFileSync(resolve(process.cwd(), "src/app/actions/club-homework.ts"), "utf8");
const homeworkRepository = readFileSync(resolve(process.cwd(), "src/lib/api/club-homework.ts"), "utf8");
const classManagerAccess = readFileSync(resolve(process.cwd(), "src/lib/api/class-manager-access.ts"), "utf8");
const cleanupRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/cron/homework-cleanup/route.ts"),
  "utf8",
);

assert.match(migration, /create or replace function public\.cleanup_stale_homework_submissions/);
assert.match(migration, /auth\.role\(\).*service_role/);
assert.match(migration, /returns table \(submission_id uuid, previous_state text, removed_paths jsonb\)/);
assert.match(cleanupRoute, /\.from\("assignment-submissions"\)/);
assert.match(cleanupRoute, /\.remove\(row\.removed_paths\)/);
assert.match(migration, /FAILED_SUBMISSION_REQUIRES_NEW_IDEMPOTENCY_KEY/);
assert.match(migration, /app\.homework_grade_transition/);
assert.match(migration, /can_manage_class\(s\.class_id/);
assert.match(migration, /can_manage_new_class\(s\.club_id/);
assert.match(migration, /create or replace function private\.can_submit_homework_assignment/);
assert.match(migration, /cm\.role = 'student'/);
assert.match(migration, /private\.can_upload_homework_storage_path/);
assert.match(migration, /private\.can_delete_homework_storage_path/);
assert.match(migration, /and f\.state = 'verified'/);
assert.match(migration, /if path_user <> p_user_id then return false; end if;/);
assert.match(migration, /if not found or assignment_club <> path_club then return false; end if;/);
assert.match(migration, /f\.club_id = path_club/);
assert.match(authorizationMigration, /class_id is null\s+and private\.can_view_club\(club_id/);
assert.match(authorizationMigration, /c\.club_id = club_assignments\.club_id/);
assert.doesNotMatch(action, /\.storage\s*\.from\(HOMEWORK_BUCKET\)\s*\.list/);
assert.doesNotMatch(action, /requireClubManager/);
assert.match(action, /requireClassManager\(supabase, submission\.class_id\)/);
assert.match(action, /requireClubOwner\(supabase, input\.clubId\)/);
assert.doesNotMatch(homeworkRepository, /requireClubManager/);
assert.match(homeworkRepository, /requireClassManager\(supabase, assignmentRow\.class_id\)/);
assert.match(homeworkRepository, /requireClubOwner\(supabase, clubId\)/);
assert.match(classManagerAccess, /export async function requireClubOwner/);
assert.match(classManagerAccess, /profile\?\.role === "admin"/);
assert.match(classManagerAccess, /\.in\("role", \["owner", "admin"\]\)/);

console.log("Homework reliability migration contract tests passed");
