import { createClient } from "@/lib/supabase/client";
import { RIGHTS_ATTESTATION_VERSION } from "./contracts";
import { IELTS_QUESTION_TYPES } from "@/lib/api/ielts/schema";

export type BrowserDraftQuestion = {
  id: string;
  type: string;
  skill?: string;
  prompt: string;
  answer: string;
  page: number;
  documentId?: string;
  sourceFileName?: string;
  sourceSha256?: string;
  needsMedia?: boolean;
  aiSuggested?: boolean;
  accepted?: boolean;
  rejected?: boolean;
  published?: boolean;
  answerSource?: string;
  payload: Record<string, unknown>;
};

export type QuestionImportSnapshot = {
  status: string;
  questions: BrowserDraftQuestion[];
  module?: "academic" | "general_training";
  documents?: Array<{
    id: string;
    materialId: string;
    versionId: string;
    title: string;
    status: string;
    error: string | null;
  }>;
};

type RpcResult = { data: unknown; error: { message: string } | null };
type BrowserDb = ReturnType<typeof createClient> & {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
};

async function digestSha256(file: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);

function answerPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return { answer: parsed };
  } catch {
    return { answer: value };
  }
}

async function rpc(db: BrowserDb, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function responseJson(response: Response) {
  const value = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(String(value.error ?? "QUESTION_IMPORT_REQUEST_FAILED"));
  return value;
}

export function createQuestionImportBrowserAdapter(config: {
  clubId: string;
  locale: "en" | "vi";
  module?: "academic" | "general_training";
  db?: BrowserDb;
  fetchImpl?: typeof fetch;
}) {
  const db = config.db ?? (createClient() as BrowserDb);
  const fetchImpl = config.fetchImpl ?? fetch;
  const resumeKey = `thinkfy:question-import:${config.clubId}`;
  let batchId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(resumeKey);
  let collectionId: string | null = null;
  let activeModule = config.module ?? "academic";
  const uploadKeys = new Map<string, Promise<string>>();

  function rememberBatch(value: string | null) {
    batchId = value;
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(resumeKey, value);
    else window.localStorage.removeItem(resumeKey);
  }

  async function uploadMaterial(file: File) {
    if (!batchId) throw new Error("QUESTION_IMPORT_BATCH_MISSING");
    const fileHash = await digestSha256(file);
    const fileKey = `${file.name}:${file.size}:${file.type}:${fileHash}`;
    const idempotencyKey = await (uploadKeys.get(fileKey) ??
      (() => {
        const key = Promise.resolve(`${batchId}:${fileHash}`);
        uploadKeys.set(fileKey, key);
        return key;
      })());
    const prepared = await responseJson(
      await fetchImpl("/api/admin/lms/materials/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clubId: config.clubId,
          programType: "ielts",
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          title: file.name,
          description: null,
          rights: { basis: "unknown" },
          idempotencyKey,
          purpose: "question_import",
          questionImport: {
            batchId,
            rightsAttestationVersion: RIGHTS_ATTESTATION_VERSION,
            rightsAttested: true,
          },
        }),
      }),
    );
    const upload = prepared.upload as {
      bucket: string;
      path: string;
      token: string;
    } | null;
    if (!upload) return { ingestionId: prepared.versionId, sha256: fileHash };
    const stored = await db.storage
      .from(upload.bucket)
      .uploadToSignedUrl(upload.path, upload.token, file, {
        contentType: file.type,
      });
    // A lost upload response may leave the exact hash-bound object in Storage.
    // Finalization rechecks its SHA-256 before queueing it.
    if (stored.error && !["Duplicate", "ResourceAlreadyExists"].includes(String("error" in stored.error ? stored.error.error : "")) && String(stored.error.statusCode) !== "409")
      throw new Error(stored.error.message);
    return {
      ingestionId: prepared.versionId,
      sha256: fileHash,
    };
  }

  async function finalizeMaterial(material: {
    ingestionId: unknown;
    sha256: string;
  }) {
    await responseJson(
      await fetchImpl("/api/admin/lms/materials/ingest/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ingestionId: material.ingestionId,
          purpose: "question_import",
          sha256: material.sha256,
        }),
      }),
    );
  }

  async function permissions() {
    const auth = await db.auth.getUser();
    if (!auth.data.user) return { canPublish: false };
    const membership = await db
      .from("club_memberships")
      .select("role")
      .eq("club_id", config.clubId)
      .eq("user_id", auth.data.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membership.error) throw new Error(membership.error.message);
    return {
      canPublish: ["owner", "admin", "head_teacher"].includes(
        String(membership.data?.role),
      ),
    };
  }
  return {
    permissions,
    async recent() {
      const result = await db
        .from("question_import_batches")
        .select("id,title,status")
        .eq("club_id", config.clubId)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (result.error) throw new Error(result.error.message);
      return result.data ?? [];
    },
    selectBatch(id: string) {
      rememberBatch(id);
      collectionId = null;
    },
    newBatch() {
      rememberBatch(null);
      collectionId = null;
      uploadKeys.clear();
    },
    async prepare(input: {
      files: File[];
      audio: File | null;
      rightsAccepted: boolean;
    }) {
      if (
        input.files.length < 1 ||
        input.files.length > 5 ||
        (input.audio && input.files.length !== 1)
      )
        throw new Error("IMPORT_FILE_LIMIT_EXCEEDED");
      if (!input.rightsAccepted) throw new Error("RIGHTS_ATTESTATION_REQUIRED");
      if (input.audio && !SUPPORTED_AUDIO_MIME_TYPES.has(input.audio.type))
        throw new Error("UNSUPPORTED_AUDIO_MIME");
      const auth = await db.auth.getUser();
      if (!auth.data.user) throw new Error("UNAUTHENTICATED");
      if (!batchId)
        rememberBatch(
          String(
            await rpc(db, "create_question_import_batch", {
              p_club_id: config.clubId,
              p_title:
                input.files[0]?.name.replace(/\.pdf$/i, "") ||
                "Question import",
              p_module: activeModule,
              p_copyright_attestation_version: RIGHTS_ATTESTATION_VERSION,
              p_copyright_attestation_locale: config.locale,
              p_actor_id: auth.data.user.id,
            }),
          ),
        );
      const uploaded = [];
      for (const file of input.files) uploaded.push(await uploadMaterial(file));
      const audioUpload = input.audio
        ? await uploadMaterial(input.audio)
        : null;
      if (audioUpload) await finalizeMaterial(audioUpload);
      for (const material of uploaded) await finalizeMaterial(material);
    },
    async load(): Promise<QuestionImportSnapshot> {
      if (!batchId) throw new Error("QUESTION_IMPORT_BATCH_MISSING");
      const batch = await db
        .from("question_import_batches")
        .select("status,module")
        .eq("id", batchId)
        .single();
      if (batch.error) {
        rememberBatch(null);
        throw new Error(batch.error.message);
      }
      activeModule = batch.data.module as "academic" | "general_training";
      const documents = await db
        .from("question_import_batch_documents")
        .select(
          "id,material_id,version_id,source_file_name,sha256,status,error_message,media_version_id",
        )
        .eq("batch_id", batchId);
      if (documents.error) throw new Error(documents.error.message);
      const drafts = await db
        .from("question_import_draft_items")
        .select(
          "id,document_id,question_type,skill,ordinal,payload,source_evidence,answer_source,status",
        )
        .eq("batch_id", batchId)
        .order("ordinal");
      if (drafts.error) throw new Error(drafts.error.message);
      const ids = (drafts.data ?? []).map((row) => String(row.id));
      const keys = ids.length
        ? await db
            .from("question_import_draft_keys")
            .select("draft_item_id,answer_payload")
            .in("draft_item_id", ids)
        : { data: [], error: null };
      if (keys.error) throw new Error(keys.error.message);
      const answers = new Map(
        (keys.data ?? []).map((row) => [
          String(row.draft_item_id),
          (() => {
            const value =
              (row.answer_payload as Record<string, unknown>)?.answer ?? "";
            return typeof value === "string" ? value : JSON.stringify(value);
          })(),
        ]),
      );
      const status = String(batch.data.status);

      return {
        status,
        module: activeModule,
        documents: (documents.data ?? []).map((d) => ({
          id: d.id,
          materialId: String(d.material_id),
          versionId: String(d.version_id),
          title: d.source_file_name,
          status: d.status,
          error: d.error_message,
        })),
        questions: (drafts.data ?? []).map((row) => {
          const payload = (row.payload ?? {}) as Record<string, unknown>;
          const evidence = (row.source_evidence ?? {}) as Record<
            string,
            unknown
          >;
          return {
            id: String(row.id),
            type: String(row.question_type),
            skill: String(row.skill),
            prompt: String(
              payload.prompt ?? payload.question ?? payload.text ?? "",
            ),
            answer: answers.get(String(row.id)) ?? "",
            page: Number(evidence.page ?? 1),
            documentId: String(row.document_id),
            sourceFileName: documents.data?.find((d) => d.id === row.document_id)?.source_file_name,
            sourceSha256: documents.data?.find((d) => d.id === row.document_id)?.sha256 ?? undefined,
            needsMedia:
              row.skill === "listening" &&
              !(documents.data ?? []).some((d) => d.id === row.document_id && d.media_version_id),
            aiSuggested: row.answer_source === "ai_suggested",
            accepted: row.status === "accepted" || row.status === "submitted",
            rejected: row.status === "rejected",
            published: row.status === "published",
            answerSource: row.answer_source,
            payload,
          };
        }),
      };
    },
    async quota() {
      return (await rpc(db, "get_question_import_quota", {
        p_club_id: config.clubId,
      })) as { pagesRemaining: number; questionsRemaining: number };
    },
    async save(question: BrowserDraftQuestion, accepted: boolean) {
      const isObjective = IELTS_QUESTION_TYPES.slice(0, 14).includes(
        String(
          question.payload.question_type,
        ) as (typeof IELTS_QUESTION_TYPES)[number],
      );
      await rpc(db, "save_question_import_draft", {
        p_draft_item_id: question.id,
        p_payload: { ...question.payload, prompt: question.prompt },
        p_status: accepted ? (isObjective ? "draft" : "accepted") : "rejected",
        p_review_note: null,
      });
      if (accepted && isObjective)
        await rpc(db, "confirm_question_import_answer", {
          p_draft_item_id: question.id,
          p_answer_payload: answerPayload(question.answer),
        });
      if (accepted && isObjective)
        await rpc(db, "save_question_import_draft", {
          p_draft_item_id: question.id,
          p_payload: { ...question.payload, prompt: question.prompt },
          p_status: "accepted",
          p_review_note: null,
        });
    },
    async submit() {
      if (!batchId) throw new Error("QUESTION_IMPORT_BATCH_MISSING");
      await rpc(db, "submit_question_import", { p_batch_id: batchId });
    },
    async requestChanges(note: string) {
      if (!batchId) throw new Error("QUESTION_IMPORT_BATCH_MISSING");
      await rpc(db, "request_question_import_changes", {
        p_batch_id: batchId,
        p_note: note,
      });
    },
    async sourceAction(
      action: "quarantined" | "restored" | "deleted",
      reason: string,
    ) {
      if (!batchId) throw new Error("QUESTION_IMPORT_BATCH_MISSING");
      await rpc(db, "mark_question_import_source_action", {
        p_batch_id: batchId,
        p_action: action,
        p_reason: reason,
      });
    },
    async retryDocumentVersion(materialId: string, versionId: string) {
      const value = await responseJson(
        await fetchImpl(
          `/api/admin/lms/materials/${encodeURIComponent(materialId)}/retry`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              versionId,
              purpose: "question_import",
              idempotencyKey: crypto.randomUUID(),
            }),
          },
        ),
      );
      return value;
    },
    async publish(questionIds: string[]) {
      if (!batchId) throw new Error("QUESTION_IMPORT_BATCH_MISSING");
      const publishKey = await digestSha256(
        new Blob([questionIds.slice().sort().join(",")]),
      );
      const idempotencyKey = `${batchId}:publish:${publishKey}`;
      // A receipt survives reloads, another browser, and a lost RPC response.
      const receipt = await db.from("question_import_publication_receipts")
        .select("collection_id").eq("batch_id", batchId)
        .eq("idempotency_key", idempotencyKey).maybeSingle();
      if (receipt.error) throw new Error(receipt.error.message);
      const collectionKey = `${resumeKey}:${batchId}:collection`;
      collectionId = receipt.data?.collection_id ?? collectionId ??
        (typeof window === "undefined" ? null : window.localStorage.getItem(collectionKey));
      if (!collectionId) {
        const prior = await db.from("question_import_publication_receipts")
          .select("collection_id").eq("batch_id", batchId).limit(1).maybeSingle();
        if (prior.error) throw new Error(prior.error.message);
        collectionId = prior.data?.collection_id ?? String(
          await rpc(db, "create_question_bank_collection", {
            p_club_id: config.clubId,
            p_title: config.locale === "vi" ? "Câu hỏi IELTS đã nhập" : "Imported IELTS questions",
            p_kind: "loose_items",
            p_module: activeModule,
          }),
        );
      }
      if (typeof window !== "undefined") window.localStorage.setItem(collectionKey, collectionId!);
      await rpc(db, "publish_question_import_items", {
        p_batch_id: batchId,
        p_collection_id: collectionId,
        p_item_ids: questionIds,
        p_idempotency_key: idempotencyKey,
      });
    },
  };
}

export type QuestionImportBrowserAdapter = ReturnType<
  typeof createQuestionImportBrowserAdapter
>;
