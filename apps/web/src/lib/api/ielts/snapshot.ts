/**
 * Pure builder for a content-version snapshot (WS-1.1). Serializes the full test
 * tree (INCLUDING answer keys) into the jsonb stored in `ielts_content_versions`.
 * Kept pure (type-only tree import) so the snapshot shape is unit-testable and
 * the security-sensitive "keys are embedded" property is asserted in tests.
 */
import type { Json } from "@/types/supabase";
import type { IeltsTestTree } from "./tree";

export interface IeltsContentSnapshot {
  schema: "ielts.test.v1";
  capturedVersion: number;
  test: Json;
  passages: Json;
  listeningSections: Json;
  questions: Json;
}

export function buildTestSnapshot(tree: IeltsTestTree): IeltsContentSnapshot {
  return {
    schema: "ielts.test.v1",
    capturedVersion: tree.test.version,
    test: tree.test as unknown as Json,
    passages: tree.passages as unknown as Json,
    listeningSections: tree.listeningSections as unknown as Json,
    questions: tree.questions as unknown as Json,
  };
}
