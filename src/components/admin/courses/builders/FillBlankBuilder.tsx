"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { FillBlankContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function FillBlankBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.fillBlank");
  const c = content as FillBlankContent;
  const passages = c.passages ?? [];

  const update = (passages: FillBlankContent["passages"]) =>
    onChange({ passages } as ActivityContent);

  const addPassage = () =>
    update([...passages, { id: crypto.randomUUID(), text: "", blanks: [] }]);

  const updatePassage = (idx: number, text: string) => {
    const updated = [...passages];
    // Auto-detect __BLANK_N__ and create/update blanks
    const matches = text.match(/__BLANK_(\d+)__/g) ?? [];
    const blankNums = matches.map((m) => parseInt(m.replace(/__BLANK_|__/g, "")));
    const blanks = blankNums.map((num) => {
      const existing = updated[idx].blanks.find((b) => b.id === `blank-${num}`);
      return existing ?? { id: `blank-${num}`, answer: "", acceptedAnswers: [], caseSensitive: false };
    });
    updated[idx] = { ...updated[idx], text, blanks };
    update(updated);
  };

  const updateBlank = (pi: number, bi: number, changes: Partial<FillBlankContent["passages"][0]["blanks"][0]>) => {
    const updated = [...passages];
    const blanks = [...updated[pi].blanks];
    blanks[bi] = { ...blanks[bi], ...changes };
    updated[pi] = { ...updated[pi], blanks };
    update(updated);
  };

  const removePassage = (idx: number) => update(passages.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">{t("passages")} ({passages.length})</span>
        <button onClick={addPassage} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
          <Plus className="h-3.5 w-3.5" />{t("addPassage")}
        </button>
      </div>

      <p className="text-xs text-on-surface-variant">{t("instruction")}</p>

      {passages.map((passage, pi) => (
        <div key={passage.id} className="rounded-xl border border-outline-variant/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">Passage {pi + 1}</span>
            <button onClick={() => removePassage(pi)} className="p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <textarea
            value={passage.text}
            onChange={(e) => updatePassage(pi, e.target.value)}
            placeholder={t("passagePlaceholder")}
            rows={4}
            className="w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          {passage.blanks.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-on-surface-variant">{t("blanks")}</span>
              {passage.blanks.map((blank, bi) => (
                <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-on-surface-variant w-16 shrink-0">{blank.id.replace("blank-", "Blank ")}:</span>
                  <input
                    value={blank.answer}
                    onChange={(e) => updateBlank(pi, bi, { answer: e.target.value })}
                    placeholder={t("blankAnswer")}
                    className="flex-1 min-w-[120px] rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <label className="flex items-center gap-1 text-xs text-on-surface-variant shrink-0">
                    <input
                      type="checkbox"
                      checked={blank.caseSensitive}
                      onChange={(e) => updateBlank(pi, bi, { caseSensitive: e.target.checked })}
                      className="accent-primary"
                    />
                    {t("caseSensitive")}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
