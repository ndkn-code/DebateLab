import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const STATUS_PATH = "/tmp/thinkfy-workbench-local-status.json";
const FIXTURE_PATH = "/tmp/thinkfy-class-workbench-fixture.json";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function fail(message) {
  throw new Error(message);
}

function uuid() {
  return randomUUID();
}

function emailFor(runTag, role) {
  return `d300-${runTag}-${role}@local.thinkfy.test`;
}

function passwordFor(runTag) {
  return `D3bate!${runTag}Qa#${randomUUID().slice(0, 8)}`;
}

async function readLocalStatus() {
  const status = JSON.parse(await readFile(STATUS_PATH, "utf8"));
  const urlValue = String(status.API_URL ?? "").trim();
  const url = new URL(urlValue);
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    fail("Refusing to seed a non-loopback Supabase URL.");
  }
  if (url.hostname !== "127.0.0.1" || url.port !== "54321") {
    fail("Refusing to seed any Supabase URL other than http://127.0.0.1:54321.");
  }
  const serviceRoleKey = String(status.SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = String(status.ANON_KEY ?? "").trim();
  if (!serviceRoleKey || !anonKey) fail("Local Supabase credentials are missing.");
  return { url: url.toString().replace(/\/$/, ""), serviceRoleKey, anonKey };
}

async function createAuthUser(admin, email, password, displayName, role) {
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) fail(`Could not create ${role} auth user: ${result.error?.message ?? "unknown error"}`);
  const profile = await admin.from("profiles").upsert(
    { id: result.data.user.id, email, display_name: displayName, role, onboarding_completed: true },
    { onConflict: "id" },
  );
  if (profile.error) fail(`Could not create ${role} profile: ${profile.error.message}`);
  return result.data.user.id;
}

async function insertOrFail(client, table, rows) {
  const result = await client.from(table).insert(rows);
  if (result.error) fail(`Could not seed ${table}: ${result.error.message}`);
}

async function uploadOrFail(admin, bucket, path, body, contentType) {
  const result = await admin.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (result.error) fail(`Could not upload ${bucket}/${path}: ${result.error.message}`);
}

function makePdf(label) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(`BT /F1 12 Tf 24 72 Td (${label}) Tj ET`, "utf8")} >>\nstream\nBT /F1 12 Tf 24 72 Td (${label}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

async function rpcOrFail(client, name, args) {
  const result = await client.rpc(name, args);
  if (result.error) fail(`${name} failed: ${result.error.message}`);
  return result.data;
}

async function main() {
  const { url, serviceRoleKey, anonKey } = await readLocalStatus();
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const runTag = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = passwordFor(runTag.replace(/[^a-zA-Z0-9]/g, "").slice(-18));
  const teacherEmail = emailFor(runTag, "teacher");
  const learnerEmail = emailFor(runTag, "learner");
  const outsiderEmail = emailFor(runTag, "outsider");
  const teacherId = await createAuthUser(admin, teacherEmail, password, "D300 QA Teacher", "teacher");
  const learnerId = await createAuthUser(admin, learnerEmail, password, "D300 QA Learner", "student");
  const outsiderId = await createAuthUser(admin, outsiderEmail, password, "D300 QA Outsider", "student");

  const clubId = uuid();
  const classOneId = uuid();
  const classTwoId = uuid();
  const assignmentSmokeId = uuid();
  const assignmentBrowserId = uuid();
  let submissionSmokeId;
  let submissionBrowserId;
  let attachmentSmokeId;
  let attachmentBrowserId;
  const materialId = uuid();
  const versionId = uuid();
  const sourcePlacementId = uuid();
  const originalRenditionId = uuid();
  const previewRenditionId = uuid();
  const rightsApprovalId = uuid();

  const now = new Date().toISOString();
  const later = new Date(Date.now() + 86_400_000).toISOString();
  await insertOrFail(admin, "clubs", {
    id: clubId,
    code: `D300-${runTag.slice(-12)}`,
    name: "D300 QA Academy",
    club_type: "school",
    country: "VN",
    status: "active",
    owner_user_id: teacherId,
    organization_type: "school",
  });
  await insertOrFail(admin, "club_memberships", [
    { club_id: clubId, user_id: teacherId, role: "teacher", status: "active" },
    { club_id: clubId, user_id: learnerId, role: "student", status: "active" },
  ]);
  await insertOrFail(admin, "classes", [
    {
      id: classOneId,
      code: `D300-A-${runTag.slice(-10)}`,
      club_id: clubId,
      title: "D300 Debate QA · Source class",
      description: "Local QA fixture.",
      grade_level: "Beginner",
      program_type: "debate",
      status: "active",
      teacher_user_id: null,
      created_by: teacherId,
      start_date: now.slice(0, 10),
      end_date: later.slice(0, 10),
    },
    {
      id: classTwoId,
      code: `D300-B-${runTag.slice(-10)}`,
      club_id: clubId,
      title: "D300 Debate QA · Destination class",
      description: "Local QA fixture.",
      grade_level: "Beginner",
      program_type: "debate",
      status: "active",
      teacher_user_id: null,
      created_by: teacherId,
      start_date: now.slice(0, 10),
      end_date: later.slice(0, 10),
    },
  ]);
  await insertOrFail(admin, "class_memberships", [
    { class_id: classOneId, user_id: teacherId, member_role: "teacher", status: "active", created_by: teacherId },
    { class_id: classTwoId, user_id: teacherId, member_role: "teacher", status: "active", created_by: teacherId },
    { class_id: classOneId, user_id: learnerId, member_role: "student", status: "active", created_by: teacherId },
    { class_id: classTwoId, user_id: learnerId, member_role: "student", status: "active", created_by: teacherId },
  ]);
  const classTeachers = await admin
    .from("classes")
    .update({ teacher_user_id: teacherId, updated_at: now })
    .in("id", [classOneId, classTwoId]);
  if (classTeachers.error) fail(`Could not attach class teachers: ${classTeachers.error.message}`);
  await insertOrFail(admin, "club_assignments", [
    {
      id: assignmentSmokeId,
      club_id: clubId,
      class_id: classOneId,
      title: "D300 QA smoke submission",
      description: "Local persistence smoke fixture.",
      assignment_type: "speech",
      assigned_track: "debate",
      topic_title: "Should schools teach media literacy?",
      status: "active",
      created_by: teacherId,
      submission_text_enabled: true,
      submission_files_enabled: true,
      submission_max_files: 1,
      submission_max_file_mb: 5,
    },
    {
      id: assignmentBrowserId,
      club_id: clubId,
      class_id: classOneId,
      title: "D300 QA browser grading",
      description: "Local browser acceptance fixture.",
      assignment_type: "speech",
      assigned_track: "debate",
      topic_title: "Should schools teach media literacy?",
      status: "active",
      created_by: teacherId,
      submission_text_enabled: true,
      submission_files_enabled: true,
      submission_max_files: 1,
      submission_max_file_mb: 5,
    },
  ]);
  const teacher = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const learner = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const outsider = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const [client, email] of [[teacher, teacherEmail], [learner, learnerEmail], [outsider, outsiderEmail]]) {
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) fail(`Could not sign in QA user: ${signedIn.error.message}`);
  }
  const attachmentBody = makePdf("D300 QA attachment");
  async function reserveAndFinalize(assignmentId, text, suffix) {
    const storagePath = `${clubId}/${assignmentId}/${learnerId}/${runTag}-${suffix}-note.pdf`;
    const reserved = await learner.rpc("reserve_homework_submission", {
      p_assignment_id: assignmentId,
      p_user_id: learnerId,
      p_idempotency_key: uuid(),
      p_submission_text: text,
      p_file_intents: [{ storagePath, fileName: "qa-note.pdf", mimeType: "application/pdf", sizeBytes: attachmentBody.byteLength }],
    });
    if (reserved.error || !reserved.data) fail(`Could not reserve ${suffix} submission: ${reserved.error?.message ?? "missing id"}`);
    const submissionId = String(reserved.data);
    await uploadOrFail(learner, "assignment-submissions", storagePath, attachmentBody, "application/pdf");
    const finalized = await learner.rpc("finalize_homework_submission", { p_submission_id: submissionId, p_user_id: learnerId, p_storage_paths: [storagePath] });
    if (finalized.error) fail(`Could not finalize ${suffix} submission: ${finalized.error.message}`);
    const file = await admin.from("assignment_submission_files").select("id").eq("submission_id", submissionId).single();
    if (file.error || !file.data) fail(`Could not read ${suffix} attachment: ${file.error?.message ?? "missing"}`);
    return { submissionId, attachmentId: file.data.id };
  }
  ({ submissionId: submissionSmokeId, attachmentId: attachmentSmokeId } = await reserveAndFinalize(assignmentSmokeId, "Media literacy helps learners question sources, compare evidence, and speak responsibly.", "smoke"));
  ({ submissionId: submissionBrowserId, attachmentId: attachmentBrowserId } = await reserveAndFinalize(assignmentBrowserId, "A strong debate claim should explain its evidence and acknowledge a reasonable counterpoint.", "browser"));

  const pdf = makePdf("D300 QA material preview");
  const materialOriginalPath = `${clubId}/${materialId}/${versionId}/original.pdf`;
  const materialPreviewPath = `${clubId}/${materialId}/${versionId}/preview.pdf`;
  await uploadOrFail(admin, "lms-material-originals", materialOriginalPath, pdf, "application/pdf");
  await uploadOrFail(admin, "lms-material-previews", materialPreviewPath, pdf, "application/pdf");
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  await insertOrFail(admin, "lms_materials", {
    id: materialId,
    club_id: clubId,
    scope_class_id: classOneId,
    program_type: "debate",
    title: "D300 QA Media Literacy Brief",
    description: "Original local QA teaching material.",
    material_kind: "file",
    status: "draft",
    rights_basis: "original",
    rights_provenance: "D300 local QA authored fixture",
    rights_holder: "Thinkfy QA",
    rights_approved_by: teacherId,
    rights_approved_at: now,
    rights_review_note: "D300 local QA original rights approved.",
    created_by: teacherId,
    updated_by: teacherId,
  });
  await insertOrFail(admin, "lms_material_versions", {
    id: versionId,
    material_id: materialId,
    version_number: 1,
    processing_status: "uploading",
    ingest_bucket: "lms-material-originals",
    ingest_path: materialOriginalPath,
    original_bucket: "lms-material-originals",
    original_path: materialOriginalPath,
    source_file_name: "d300-media-literacy-brief.pdf",
    source_mime_type: "application/pdf",
    detected_mime_type: "application/pdf",
    size_bytes: pdf.byteLength,
    sha256,
    content_review_status: "approved",
    content_reviewer_id: teacherId,
    content_reviewed_at: now,
    content_review_note: "D300 local QA approved original fixture.",
    native_document: {
      schemaVersion: 1,
      title: "D300 QA Media Literacy Brief",
      sourceVersionId: versionId,
      language: "en",
      sections: [{
        id: "qa",
        title: "Media literacy",
        blocks: [{ id: "intro", type: "paragraph", text: "Compare sources before choosing evidence." }],
      }],
    },
    created_by: teacherId,
  });
  await insertOrFail(admin, "lms_material_rights_approvals", {
    id: rightsApprovalId,
    material_id: materialId,
    version_id: versionId,
    decision: "approved",
    basis: "original",
    provenance: "D300 local QA authored fixture",
    rights_holder: "Thinkfy QA",
    evidence_note: "Original local fixture.",
    reviewer_id: teacherId,
    reviewed_at: now,
  });
  await insertOrFail(admin, "lms_material_renditions", [
    { id: originalRenditionId, version_id: versionId, rendition_kind: "original", processing_status: "ready", bucket_id: "lms-material-originals", storage_path: materialOriginalPath, mime_type: "application/pdf", size_bytes: pdf.byteLength, sha256, created_at: now },
    { id: previewRenditionId, version_id: versionId, rendition_kind: "pdf_preview", processing_status: "ready", bucket_id: "lms-material-previews", storage_path: materialPreviewPath, mime_type: "application/pdf", size_bytes: pdf.byteLength, sha256, page_number: 1, created_at: now },
  ]);
  const versionReady = await admin.from("lms_material_versions").update({ processing_status: "ready", updated_at: now }).eq("id", versionId);
  if (versionReady.error) fail(`Could not mark QA material ready: ${versionReady.error.message}`);
  await insertOrFail(admin, "lms_material_placements", {
    id: sourcePlacementId,
    material_id: materialId,
    version_id: versionId,
    club_id: clubId,
    target_type: "class",
    class_id: classOneId,
    status: "draft",
    audience_mode: "all",
    created_by: teacherId,
  });

  const smokeBefore = await admin.from("club_assignment_submissions").select("updated_at").eq("id", submissionSmokeId).single();
  if (smokeBefore.error || !smokeBefore.data) fail(`Could not read smoke submission: ${smokeBefore.error?.message ?? "missing"}`);
  const smokeKey = `d300-grade-${uuid()}`;
  const smokeArgs = {
    p_submission_id: submissionSmokeId,
    p_score: 8,
    p_score_max: 10,
    p_feedback: "Clear claim and evidence.",
    p_rubric_breakdown: { clarity: 4, evidence: 4 },
    p_expected_updated_at: smokeBefore.data.updated_at,
    p_idempotency_key: smokeKey,
  };
  const gradeResult = await rpcOrFail(teacher, "teacher_workspace_grade_homework", smokeArgs);
  const duplicateResult = await rpcOrFail(teacher, "teacher_workspace_grade_homework", smokeArgs);
  if (JSON.stringify(gradeResult) !== JSON.stringify(duplicateResult)) fail("Grade duplicate receipt did not replay the original result.");
  const persisted = await admin.from("club_assignment_submissions").select("grade_status,score,feedback,status").eq("id", submissionSmokeId).single();
  if (persisted.error || persisted.data?.grade_status !== "graded" || Number(persisted.data.score) !== 8) fail("Grading readback did not persist the expected score.");
  const outsiderBefore = await admin.from("club_assignment_submissions").select("updated_at").eq("id", submissionBrowserId).single();
  if (outsiderBefore.error || !outsiderBefore.data) fail(`Could not read outsider smoke submission: ${outsiderBefore.error?.message ?? "missing"}`);
  const outsiderAttempt = await outsider.rpc("teacher_workspace_grade_homework", {
    ...smokeArgs,
    p_submission_id: submissionBrowserId,
    p_expected_updated_at: outsiderBefore.data.updated_at,
    p_idempotency_key: `d300-outsider-${uuid()}`,
  });
  if (!outsiderAttempt.error || !/FORBIDDEN|permission/i.test(outsiderAttempt.error.message)) fail("Outsider grading did not receive a permission denial.");

  const fixture = {
    createdAt: now,
    supabaseUrl: url,
    organizationId: clubId,
    teacherId,
    teacherEmail,
    learnerId,
    learnerEmail,
    outsiderId,
    outsiderEmail,
    classIds: [classOneId, classTwoId],
    sourceClassId: classOneId,
    destinationClassId: classTwoId,
    assignmentSmokeId,
    assignmentBrowserId,
    submissionSmokeId,
    browserSubmissionId: submissionBrowserId,
    materialId,
    versionId,
    sourcePlacementId,
    attachmentSmokeId,
    attachmentBrowserId,
    materialPreviewPath,
    smoke: { gradePersisted: true, duplicateReceipt: true, outsiderDenied: true },
  };
  await writeFile(FIXTURE_PATH, JSON.stringify({ ...fixture, password }, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({
    fixture: {
      organizationId: clubId,
      teacherId,
      teacherEmail,
      learnerId,
      learnerEmail,
      outsiderId,
      outsiderEmail,
      sourceClassId: classOneId,
      destinationClassId: classTwoId,
      assignmentBrowserId,
      browserSubmissionId: submissionBrowserId,
      materialId,
      versionId,
      sourcePlacementId,
    },
    passwordFile: FIXTURE_PATH,
    smoke: fixture.smoke,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
