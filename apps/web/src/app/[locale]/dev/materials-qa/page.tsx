import { TeacherMaterialLibrary } from "@/components/lms/TeacherMaterialLibrary";
import { notFound } from "next/navigation";
import type {
  LearnerMaterialProjection,
  TeacherMaterialSummary,
} from "@/components/materials/material-ui-model";

const MATERIAL_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const PLACEMENT_ID = "33333333-3333-4333-8333-333333333333";

const learnerPreview: LearnerMaterialProjection = {
  materialId: MATERIAL_ID,
  placementId: PLACEMENT_ID,
  versionId: VERSION_ID,
  title: "Evidence map · Week 3",
  description:
    "A compact model for connecting claims, evidence, and reasoning.",
  mediaKind: "document",
  mimeType: "application/pdf",
  processingStatus: "ready",
  placementStatus: "published",
  accessState: "available",
  lockReasons: [],
  required: true,
  lessonTitle: "Building a case",
  availableAt: null,
  preview: null,
  document: {
    schemaVersion: 1,
    title: "Evidence map",
    sourceVersionId: VERSION_ID,
    language: "en",
    sections: [
      {
        id: "overview",
        title: "Claim → evidence → reasoning",
        blocks: [
          {
            id: "intro",
            type: "paragraph",
            text: "A strong argument makes the connection between evidence and the claim explicit.",
          },
          {
            id: "tip",
            type: "callout",
            tone: "tip",
            text: "Ask: what does this evidence prove, and why does it matter?",
          },
          {
            id: "practice",
            type: "question",
            prompt: "What is the reasoning step in your current case?",
            responseMode: "long_text",
          },
        ],
      },
    ],
  },
  renditions: [],
};

const materials: TeacherMaterialSummary[] = [
  {
    materialId: MATERIAL_ID,
    versionId: VERSION_ID,
    title: learnerPreview.title,
    description: learnerPreview.description,
    sourceFileName: "evidence-map.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2_480_000,
    processingStatus: "ready",
    rightsBasis: "original",
    rightsApproved: true,
    updatedAt: "2026-08-30T14:00:00.000Z",
    preview: null,
    document: learnerPreview.document,
    renditions: [],
    placements: [
      {
        id: PLACEMENT_ID,
        targetType: "occurrence",
        targetId: "44444444-4444-4444-8444-444444444444",
        targetLabel: "Week 3 · Building a case",
        status: "published",
        releaseAt: null,
        expiresAt: null,
        required: true,
        audienceCount: 18,
        rules: [],
      },
    ],
  },
  {
    materialId: "55555555-5555-4555-8555-555555555555",
    versionId: "66666666-6666-4666-8666-666666666666",
    title: "Model rebuttal audio",
    description: "Teacher-created speaking model.",
    sourceFileName: "model-rebuttal.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 7_120_000,
    processingStatus: "converting",
    rightsBasis: "original",
    rightsApproved: true,
    updatedAt: "2026-08-30T13:00:00.000Z",
    preview: null,
    document: null,
    renditions: [],
    placements: [],
  },
  {
    materialId: "77777777-7777-4777-8777-777777777777",
    versionId: "88888888-8888-4888-8888-888888888888",
    title: "Tournament handbook",
    description: "Imported handbook awaiting rights approval.",
    sourceFileName: "tournament-handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_340_000,
    processingStatus: "ready",
    rightsBasis: "open_license",
    rightsApproved: false,
    updatedAt: "2026-08-29T13:00:00.000Z",
    preview: null,
    document: null,
    renditions: [],
    placements: [],
  },
];

export default async function MaterialsQaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  return (
    <TeacherMaterialLibrary
      locale={locale}
      materials={materials}
      targets={[]}
      learnerPreviews={[learnerPreview]}
    />
  );
}
