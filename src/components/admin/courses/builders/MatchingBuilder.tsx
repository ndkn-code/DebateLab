"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { MatchingContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function MatchingBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.matching");
  const c = content as MatchingContent;
  const pairs = c.pairs ?? [];

  const update = (pairs: MatchingContent["pairs"]) =>
    onChange({ pairs } as ActivityContent);

  const addPair = () =>
    update([...pairs, { id: crypto.randomUUID(), left: "", right: "" }]);

  const updatePair = (idx: number, changes: Partial<MatchingContent["pairs"][0]>) => {
    const updated = [...pairs];
    updated[idx] = { ...updated[idx], ...changes };
    update(updated);
  };

  const removePair = (idx: number) => update(pairs.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">{t("pairs")} ({pairs.length})</span>
        <button onClick={addPair} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
          <Plus className="h-3.5 w-3.5" />{t("addPair")}
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 text-xs font-medium text-on-surface-variant px-1">
          <span className="w-6">#</span>
          <span>{t("term")}</span>
          <span>{t("definition")}</span>
          <span className="w-8"></span>
        </div>
        {pairs.map((pair, i) => (
          <div key={pair.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
            <span className="w-6 text-xs text-center text-on-surface-variant font-medium">{i + 1}</span>
            <input
              value={pair.left}
              onChange={(e) => updatePair(i, { left: e.target.value })}
              placeholder={t("term")}
              className="rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={pair.right}
              onChange={(e) => updatePair(i, { right: e.target.value })}
              placeholder={t("definition")}
              className="rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => removePair(i)}
              disabled={pairs.length <= 2}
              className="w-8 p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-on-surface-variant italic">{t("shuffleHint")}</p>
    </div>
  );
}
