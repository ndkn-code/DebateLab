import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
const psql = "/opt/homebrew/opt/postgresql@15/bin/psql";
const args = [
  "-h",
  "/tmp",
  "-p",
  "5432",
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
  "-d",
  "thinkfy_reuse_571d",
];
const actor = "70000000-0000-4000-8000-000000000001";
const source = "70000000-0000-4000-8000-000000000020";
const course = "70000000-0000-4000-8000-000000000030";
const assignment = "70000000-0000-4000-8000-000000000040";
const material = "70000000-0000-4000-8000-000000000053";
const input = {
  sourceClassId: source,
  title: "Behavior test cohort",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  dateMode: "clear",
  timezone: "America/New_York",
  courseIds: [course],
  materialPlacementIds: [material],
  assignmentIds: [assignment],
  idempotencyKey: "70000000-0000-4000-8000-000000000099",
};
function sql(s) {
  return execFileSync(psql, args, {
    input: s,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function body(s) {
  sql(`BEGIN; SET LOCAL request.jwt.claim.sub='${actor}'; ${s} ROLLBACK;`);
}
function payload(extra = {}) {
  return `'${JSON.stringify({ ...input, ...extra })}'::jsonb || jsonb_build_object('previewFingerprint',public.preview_class_curriculum_reuse('${source}')->>'fingerprint')`;
}
function checkFail(expression, expected) {
  return `BEGIN PERFORM ${expression}; RAISE EXCEPTION 'EXPECTED_FAILURE'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%${expected}%' THEN RAISE; END IF; END;`;
}

test("fixture is isolated and real PostgreSQL", () =>
  assert.equal(sql("select current_database()"), "thinkfy_reuse_571d"));
test("draft copy preserves configured submissions, excludes learner tables and clears dates", () =>
  body(`DO $$ DECLARE r jsonb; n uuid; before_counts jsonb; after_counts jsonb; BEGIN
before_counts:=jsonb_build_array((select count(*) from class_memberships),(select count(*) from attendance_records),(select count(*) from club_assignment_submissions),(select count(*) from student_grades),(select count(*) from student_progress),(select count(*) from private_feedback),(select count(*) from lms_announcements),(select count(*) from lms_outbox_events));
r:=public.create_class_curriculum_reuse(${payload()}); n:=(r->>'classId')::uuid;
IF (select status from classes where id=n)<>'draft' OR (select count(*) from class_course_assignments where class_id=n)<>1 OR (select count(*) from lms_material_placements where class_id=n and status='draft' and release_at is null)<>1 THEN RAISE EXCEPTION 'BAD_COPY'; END IF;
IF NOT EXISTS(select 1 from club_assignments where class_id=n and status='draft' and due_at is null and metadata='{}' and submission_instructions='Write your own response') THEN RAISE EXCEPTION 'ASSIGNMENT_CONFIGURATION'; END IF;
after_counts:=jsonb_build_array((select count(*) from class_memberships),(select count(*) from attendance_records),(select count(*) from club_assignment_submissions),(select count(*) from student_grades),(select count(*) from student_progress),(select count(*) from private_feedback),(select count(*) from lms_announcements),(select count(*) from lms_outbox_events));
IF before_counts<>after_counts THEN RAISE EXCEPTION 'LEARNER_DATA_COPIED'; END IF; END $$;`));
test("duplicate receipt returns same class; different payload conflicts", () =>
  body(
    `DO $$ DECLARE p jsonb:=${payload()}; a jsonb; b jsonb; BEGIN a:=public.create_class_curriculum_reuse(p); b:=public.create_class_curriculum_reuse(p); IF a<>b THEN RAISE EXCEPTION 'DUPLICATE'; END IF; ${checkFail("public.create_class_curriculum_reuse(p||jsonb_build_object('title','changed'))", "IDEMPOTENCY_KEY_REUSE")} END $$;`,
  ));
test("permission is rechecked on receipt replay", () =>
  body(
    `DO $$ DECLARE p jsonb:=${payload()}; BEGIN PERFORM public.create_class_curriculum_reuse(p); UPDATE club_memberships SET status='removed' WHERE user_id='${actor}'; ${checkFail("public.create_class_curriculum_reuse(p)", "FORBIDDEN")} END $$;`,
  ));
test("ordinary teacher and cross-center source denied", () =>
  body(
    `UPDATE club_memberships SET role='teacher' WHERE user_id='${actor}'; DO $$ BEGIN ${checkFail(`public.preview_class_curriculum_reuse('${source}')`, "FORBIDDEN")} END $$; UPDATE club_memberships SET role='owner',club_id='70000000-0000-4000-8000-000000000011' WHERE user_id='${actor}'; DO $$ BEGIN ${checkFail(`public.preview_class_curriculum_reuse('${source}')`, "FORBIDDEN")} END $$;`,
  ));
test("ineligible, cross-center and duplicate selections roll back class", () =>
  body(`DO $$ DECLARE n int:=(select count(*) from classes); BEGIN
${checkFail(`public.create_class_curriculum_reuse(${payload({ courseIds: ["70000000-0000-4000-8000-000000000999"] })})`, "REUSE_INELIGIBLE_SELECTION")}
${checkFail(`public.create_class_curriculum_reuse(${payload({ assignmentIds: [assignment, assignment] })})`, "REUSE_INVALID_INPUT")}
IF n<>(select count(*) from classes) THEN RAISE EXCEPTION 'PARTIAL_CLASS'; END IF; END $$;`));
test("late insert failure rolls back every write; same request retries after repair", () =>
  body(`CREATE FUNCTION pg_temp.reject_copy() RETURNS trigger LANGUAGE plpgsql AS $t$ BEGIN IF NEW.class_id<>'${source}' THEN RAISE EXCEPTION 'QA_LATE_FAILURE'; END IF; RETURN NEW; END $t$; CREATE TRIGGER qa_reuse_failure BEFORE INSERT ON club_assignments FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_copy();
DO $$ DECLARE n int:=(select count(*) from classes); p jsonb:=${payload()}; BEGIN ${checkFail("public.create_class_curriculum_reuse(p)", "QA_LATE_FAILURE")} IF n<>(select count(*) from classes) OR EXISTS(select 1 from organization_operation_idempotency where idempotency_key='${input.idempotencyKey}') THEN RAISE EXCEPTION 'PARTIAL_WRITE'; END IF; END $$;
DROP TRIGGER qa_reuse_failure ON club_assignments; SELECT public.create_class_curriculum_reuse(${payload()});`));
test("source change invalidates preview", () =>
  body(
    `DO $$ DECLARE p jsonb:=${payload()}; BEGIN UPDATE club_assignments SET title='Changed' WHERE id='${assignment}'; ${checkFail("public.create_class_curriculum_reuse(p)", "REUSE_SOURCE_CHANGED")} END $$;`,
  ));
test("module changes invalidate preview", () =>
  body(
    `DO $$ DECLARE p jsonb:=${payload()}; BEGIN UPDATE course_modules SET title='Changed module' WHERE course_id='${course}'; ${checkFail("public.create_class_curriculum_reuse(p)", "REUSE_SOURCE_CHANGED")} END $$;`,
  ));
test("rights revoked, selected audiences and class scope excluded", () =>
  body(
    `UPDATE lms_material_rights_approvals SET decision='revoked'; DO $$ BEGIN IF (public.preview_class_curriculum_reuse('${source}')->'materials'->0->>'eligible')::boolean THEN RAISE EXCEPTION 'RIGHTS'; END IF; END $$; UPDATE lms_material_rights_approvals SET decision='approved'; UPDATE lms_material_placements SET audience_mode='selected'; DO $$ BEGIN IF (public.preview_class_curriculum_reuse('${source}')->'materials'->0->>'eligible')::boolean THEN RAISE EXCEPTION 'AUDIENCE'; END IF; END $$; UPDATE lms_material_placements SET audience_mode='all'; UPDATE lms_materials SET scope_class_id='${source}'; DO $$ BEGIN IF (public.preview_class_curriculum_reuse('${source}')->'materials'->0->>'eligible')::boolean THEN RAISE EXCEPTION 'SCOPE'; END IF; END $$;`,
  ));
test("wall-clock offset across DST and null dates match preview/readback", () =>
  body(`UPDATE classes SET start_date='2026-10-25' WHERE id='${source}'; UPDATE club_assignments SET due_at='2026-10-26T15:00:00Z' WHERE id='${assignment}';
DO $$ DECLARE p jsonb:=${payload({ dateMode: "shift", startDate: "2026-11-01", endDate: "2026-11-30", materialPlacementIds: [] })}; r jsonb; preview jsonb; BEGIN preview:=public.preview_class_curriculum_reuse('${source}',p); r:=public.create_class_curriculum_reuse(p); IF (select due_at from club_assignments where class_id=(r->>'classId')::uuid)<>'2026-11-02T16:00:00Z'::timestamptz THEN RAISE EXCEPTION 'DST_WALL_CLOCK'; END IF; IF (preview->'datePreview'->'assignments'->0->>'dueAt')::timestamptz<>(select due_at from club_assignments where class_id=(r->>'classId')::uuid) THEN RAISE EXCEPTION 'DATE_PREVIEW'; END IF; END $$;
UPDATE club_assignments SET due_at=null WHERE id='${assignment}'; DO $$ BEGIN IF private.class_curriculum_reuse_shift_timestamp(null,'2026-01-01','2026-02-01','UTC') IS NOT NULL THEN RAISE EXCEPTION 'NULL_DATE'; END IF; END $$;`));
test("nonexistent DST times rejected; empty selection avoids unrelated date failure", () =>
  body(
    `UPDATE classes SET start_date='2026-03-01' WHERE id='${source}'; UPDATE club_assignments SET due_at='2026-03-01T07:30:00Z' WHERE id='${assignment}'; DO $$ BEGIN ${checkFail(`public.create_class_curriculum_reuse(${payload({ dateMode: "shift", startDate: "2026-03-08", endDate: "2026-04-01", materialPlacementIds: [] })})`, "REUSE_DST_GAP")} PERFORM public.create_class_curriculum_reuse(${payload({ dateMode: "shift", startDate: "2026-03-08", endDate: "2026-04-01", materialPlacementIds: [], assignmentIds: [] })}); END $$;`,
  ));
test("outside class dates, missing start, invalid calendar and bad timezone rejected", () =>
  body(`DO $$ BEGIN
${checkFail(`public.create_class_curriculum_reuse(${payload({ dateMode: "shift", endDate: "2026-10-02" })})`, "REUSE_DATE_OUTSIDE_CLASS")}
${checkFail(`public.create_class_curriculum_reuse(${payload({ dateMode: "shift", startDate: null })})`, "REUSE_INVALID_DATES")}
${checkFail(`public.create_class_curriculum_reuse(${payload({ startDate: "2026-02-31" })})`, "REUSE_INVALID_DATES")}
${checkFail(`public.create_class_curriculum_reuse(${payload({ timezone: "Mars/Olympus" })})`, "REUSE_INVALID_TIMEZONE")}
END $$;`));
test("anonymous execution is denied", () =>
  assert.throws(
    () => sql("SET ROLE anon; SELECT public.list_class_reuse_sources();"),
    /Command failed/,
  ));
test("simultaneous duplicate submit serializes on the same receipt", async () => {
  const p = JSON.parse(
    sql(
      `SET request.jwt.claim.sub='${actor}'; SELECT ${payload({ idempotencyKey: crypto.randomUUID(), title: "Concurrent QA" })};`,
    ),
  );
  const command = `SET request.jwt.claim.sub='${actor}'; SELECT public.create_class_curriculum_reuse('${JSON.stringify(p)}'::jsonb);`;
  const run = promisify(execFile);
  const results = await Promise.all([
    run(psql, [...args, "-c", command]),
    run(psql, [...args, "-c", command]),
  ]);
  assert.deepEqual(
    JSON.parse(results[0].stdout),
    JSON.parse(results[1].stdout),
  );
});
