"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Save } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  materialDocumentV1Schema,
  type MaterialDocumentV1,
} from "@/lib/api/class-lms/material-contracts";

type Copy = {
  draft: string;
  explanation: string;
  section: string;
  save: string;
  approve: string;
  invalid: string;
};

function copyFor(locale: string): Copy {
  return locale === "vi"
    ? {
        draft: "Bản chuyển đổi cần giáo viên duyệt",
        explanation:
          "Nội dung được tạo tự động vẫn là bản nháp cho đến khi giáo viên kiểm tra và phê duyệt.",
        section: "Phần",
        save: "Lưu bản nháp",
        approve: "Phê duyệt bản này",
        invalid: "Tài liệu chưa đúng định dạng và chưa thể lưu.",
      }
    : {
        draft: "Teacher review required",
        explanation:
          "Automatically converted content stays a draft until a teacher checks and approves it.",
        section: "Section",
        save: "Save draft",
        approve: "Approve this version",
        invalid: "The document is not valid and cannot be saved yet.",
      };
}

export function MaterialDocumentEditorShell({
  document,
  locale,
  onSaveDraft,
  onApprove,
}: {
  document: MaterialDocumentV1;
  locale: string;
  onSaveDraft?: (document: MaterialDocumentV1) => Promise<void> | void;
  onApprove?: (document: MaterialDocumentV1) => Promise<void> | void;
}) {
  const copy = copyFor(locale);
  const [draft, setDraft] = useState(document);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "invalid">(
    "idle",
  );
  const valid = useMemo(
    () => materialDocumentV1Schema.safeParse(draft).success,
    [draft],
  );
  const updateText = (
    sectionIndex: number,
    blockIndex: number,
    text: string,
  ) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, currentSectionIndex) =>
        currentSectionIndex !== sectionIndex
          ? section
          : {
              ...section,
              blocks: section.blocks.map((block, currentBlockIndex) => {
                if (currentBlockIndex !== blockIndex || !("text" in block))
                  return block;
                return { ...block, text };
              }),
            },
      ),
    }));
    setStatus("idle");
  };
  const run = async (kind: "save" | "approve") => {
    if (!valid) {
      setStatus("invalid");
      return;
    }
    const handler = kind === "save" ? onSaveDraft : onApprove;
    if (!handler) return;
    setStatus("saving");
    await handler(draft);
    setStatus("saved");
  };

  return (
    <section
      aria-labelledby="material-document-editor-heading"
      className="rounded-control border border-outline-variant bg-surface"
    >
      <header className="border-b border-outline-variant p-4">
        <div className="flex gap-3 rounded-control border border-warning/25 bg-warning-container p-3 text-on-warning-container">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2
              id="material-document-editor-heading"
              className="type-label font-semibold"
            >
              {copy.draft}
            </h2>
            <p className="mt-1 type-caption">{copy.explanation}</p>
          </div>
        </div>
      </header>
      <div className="space-y-5 p-4">
        {draft.sections.map((section, sectionIndex) => (
          <section
            key={section.id}
            aria-labelledby={`${section.id}-heading`}
            className="rounded-control border border-outline-variant p-3"
          >
            <h3
              id={`${section.id}-heading`}
              className="type-label font-semibold"
            >
              {section.title || `${copy.section} ${sectionIndex + 1}`}
            </h3>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, blockIndex) =>
                "text" in block ? (
                  <label
                    key={block.id}
                    className="block type-caption font-semibold text-on-surface-variant"
                  >
                    {block.type.replaceAll("_", " ")}
                    <textarea
                      value={block.text}
                      onChange={(event) =>
                        updateText(sectionIndex, blockIndex, event.target.value)
                      }
                      rows={block.type === "heading" ? 2 : 5}
                      className="mt-1 w-full rounded-control border border-outline-variant bg-background px-3 py-2 type-body-sm font-normal text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                ) : (
                  <div
                    key={block.id}
                    className="rounded-lg bg-surface-container-low px-3 py-2 type-caption text-on-surface-variant"
                  >
                    {block.type.replaceAll("_", " ")}
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant p-3">
        <span
          aria-live="polite"
          className={`mr-auto type-caption ${status === "invalid" ? "text-error" : "text-on-surface-variant"}`}
        >
          {status === "invalid" ? (
            copy.invalid
          ) : status === "saved" ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {locale === "vi" ? "Đã lưu" : "Saved"}
            </span>
          ) : (
            ""
          )}
        </span>
        <Button
          variant="outline"
          disabled={!onSaveDraft || status === "saving"}
          onClick={() => void run("save")}
        >
          <Save aria-hidden="true" />
          {copy.save}
        </Button>
        <Button
          disabled={!onApprove || status === "saving" || !valid}
          onClick={() => void run("approve")}
        >
          <CheckCircle2 aria-hidden="true" />
          {copy.approve}
        </Button>
      </footer>
    </section>
  );
}
