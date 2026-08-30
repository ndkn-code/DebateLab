import assert from "node:assert/strict";
import {
  loadLearnerMaterialsForWeek,
  listManagerMaterials,
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
  preview_kind: "pdf_preview",
  preview_mime_type: "application/pdf",
  page_count: 2,
  native_document: null,
  access_state: "available",
  lock_reasons: [],
};

assert.equal(
  parseLearnerMaterialRows({
    rows: [
      learnerProjection,
      { ...learnerProjection, preview_kind: "original" },
    ],
  }).length,
  1,
);
assert.deepEqual(
  parseLearnerMaterialRows({
    rows: [
      {
        ...learnerProjection,
        access_state: "locked",
        lock_reasons: ["Complete the lesson"],
      },
    ],
  })[0]?.previews,
  [],
);
assert.equal(
  parseLearnerMaterialRows({
    rows: [
      {
        ...learnerProjection,
        access_state: "processing",
        preview_kind: null,
        preview_rendition_id: null,
      },
    ],
  }).length,
  1,
);
assert.deepEqual(
  parseManagerMaterialPage({ rows: [], next_cursor: "cursor-2" }).nextCursor,
  "cursor-2",
);

const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
const fakeClient: MaterialRpcClient = {
  rpc: async (name, args) => {
    calls.push({ name, args: args ?? {} });
    if (name === SHARED_MATERIAL_RPCS.listLearner)
      return { data: [learnerProjection], error: null };
    if (name === "can_access_lms_material_preview")
      return { data: true, error: null };
    return { data: [], error: null };
  },
};

const fakeRenditionLookup = {
  eq: () => fakeRenditionLookup,
  maybeSingle: async () => ({
    data: {
      bucket_id: "lms-material-previews",
      storage_path: `preview/${renditionId}.pdf`,
      rendition_kind: "pdf_preview",
      processing_status: "ready",
    },
    error: null,
  }),
};

const fakeService = {
  from: () => ({
    select: () => fakeRenditionLookup,
  }),
  storage: {
    from: () => ({
      createSignedUrl: async () => ({
        data: { signedUrl: "https://signed.example/preview" },
        error: null,
      }),
    }),
  },
};

async function main() {
  const managerRows = [
    {
      id: materialId,
      version_id: versionId,
      title: "Week 1 handout",
      description: null,
      processing_status: "ready",
      content_review_status: "approved",
      rights_approved: true,
      version_number: 1,
      created_at: "2026-09-01T10:00:00.000Z",
      updated_at: "2026-09-02T10:00:00.000Z",
      placements: [],
    },
  ];
  const managerPage = await listManagerMaterials(
    { limit: 1 },
    {
      rpc: async () => ({ data: managerRows, error: null }),
    },
  );
  assert.equal(
    managerPage.nextCursor,
    `2026-09-02T10:00:00.000Z|${materialId}`,
  );
  assert.equal(managerPage.rows[0]?.contentReviewStatus, "approved");
  assert.equal(managerPage.rows[0]?.rightsApproved, true);

  const loaded = await loadLearnerMaterialsForWeek(
    {
      classId: learnerProjection.class_id,
      from: "2026-09-01",
      to: "2026-09-07",
    },
    fakeClient,
    fakeService,
  );
  assert.equal(
    loaded[0]?.previews[0]?.viewerUrl,
    "https://signed.example/preview",
  );
  assert.equal(loaded[0]?.previews[0]?.renditionId, renditionId);
  assert.equal(typeof loaded[0]?.previews[0]?.expiresAt, "string");
  assert.equal(loaded[0]?.unlocked, true);
  assert.equal(calls[0]?.name, SHARED_MATERIAL_RPCS.listLearner);
  assert.deepEqual(calls[0]?.args, {
    p_class_id: learnerProjection.class_id,
    p_from: "2026-09-01",
    p_to: "2026-09-07",
  });
  assert.equal(calls[1]?.args.p_rendition_id, renditionId);
  assert.equal(Object.hasOwn(loaded[0] ?? {}, "signedUrl"), false);
  assert.equal(
    Object.hasOwn(loaded[0]?.previews[0] ?? {}, "storagePath"),
    false,
  );
  console.log("shared LMS materials repository contracts passed");
}

void main();
