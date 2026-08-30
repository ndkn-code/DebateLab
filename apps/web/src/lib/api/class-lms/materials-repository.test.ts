import assert from "node:assert/strict";
import {
  loadLearnerMaterialsForWeek,
  parseLearnerMaterialRows,
  parseManagerMaterialPage,
  SHARED_MATERIAL_RPCS,
  type MaterialRpcClient,
} from "./materials-repository";

const materialId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
const placementId = "00000000-0000-4000-8000-000000000003";
const renditionId = "00000000-0000-4000-8000-000000000004";

const learnerProjection = {
  material_id: materialId,
  version_id: versionId,
  placement_id: placementId,
  title: "Week 1 handout",
  description: "Published preview",
  target_type: "class",
  class_id: "00000000-0000-4000-8000-000000000005",
  course_id: null,
  occurrence_id: null,
  assignment_id: null,
  placement_status: "published",
  release_at: null,
  expires_at: null,
  required: true,
  order_index: 0,
  processing_status: "ready",
  preview_rendition_id: renditionId,
  preview_kind: "preview",
  preview_mime_type: "application/pdf",
  page_count: 2,
  native_document: null,
  access_state: "available",
  lock_reasons: [],
};

assert.equal(parseLearnerMaterialRows({ rows: [learnerProjection, { ...learnerProjection, preview_kind: "original" }] }).length, 1);
assert.equal(parseLearnerMaterialRows({ rows: [{ ...learnerProjection, access_state: "locked", lock_reasons: ["Complete the lesson"] }] })[0]?.signedUrl, null);
assert.deepEqual(parseManagerMaterialPage({ rows: [], next_cursor: "cursor-2" }).nextCursor, "cursor-2");

const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
const fakeClient: MaterialRpcClient = {
  rpc: async (name, args) => {
    calls.push({ name, args: args ?? {} });
    if (name === SHARED_MATERIAL_RPCS.listLearner) return { data: [learnerProjection], error: null };
    if (name === "can_access_lms_material_preview") return { data: true, error: null };
    return { data: [], error: null };
  },
};

const fakeService = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: async () => ({ data: { bucket_id: "lms-material-previews", storage_path: `preview/${renditionId}.pdf` }, error: null }),
          maybeSingle: async () => ({ data: { bucket_id: "lms-material-previews", storage_path: `preview/${renditionId}.pdf` }, error: null }),
        }),
        maybeSingle: async () => ({ data: { bucket_id: "lms-material-previews", storage_path: `preview/${renditionId}.pdf` }, error: null }),
      }),
    }),
  }),
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/preview" }, error: null }) }) },
};

const loaded = await loadLearnerMaterialsForWeek({ classId: learnerProjection.class_id, from: "2026-09-01", to: "2026-09-07" }, fakeClient, fakeService);
assert.equal(loaded[0]?.signedUrl, "https://signed.example/preview");
assert.equal(loaded[0]?.unlocked, true);
assert.equal(calls[0]?.name, SHARED_MATERIAL_RPCS.listLearner);
assert.deepEqual(calls[0]?.args, { p_class_id: learnerProjection.class_id, p_from: "2026-09-01", p_to: "2026-09-07" });
assert.equal(calls[1]?.args.p_rendition_id, renditionId);
assert.equal(Object.hasOwn(loaded[0] ?? {}, "storagePath"), false);

console.log("shared LMS materials repository contracts passed");
