import { materialDocumentV1Schema, type MaterialDocumentV1 } from "@/lib/api/class-lms/material-contracts";

/**
 * Release-2 boundary: this is intentionally a teacher-review draft. It gives
 * the authoring surface a stable page/rendition anchor without pretending that
 * semantic extraction succeeded when the Sandbox only returned text.
 */
export function buildDraftMaterialDocument(input: {
  title: string;
  versionId: string;
  renditionId: string;
  text?: string;
}): MaterialDocumentV1 {
  const text = input.text?.trim() ?? "";
  const document = {
    schemaVersion: 1 as const,
    title: input.title,
    sourceVersionId: input.versionId,
    language: "en",
    sections: [{
      id: "section-1",
      title: input.title,
      blocks: [
        { id: "page-preview-1", type: "page_preview" as const, renditionId: input.renditionId, pageNumber: 1, alt: `${input.title} preview` },
        ...(text ? [{ id: "extracted-text-1", type: "paragraph" as const, text }] : []),
      ],
    }],
  };
  return materialDocumentV1Schema.parse(document);
}

export function isDraftMaterialDocument(value: unknown): value is MaterialDocumentV1 {
  return materialDocumentV1Schema.safeParse(value).success;
}
