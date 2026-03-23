"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { DragOrderContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function DragOrderBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.dragOrder");
  const c = content as DragOrderContent;
  const items = c.items ?? [];

  const update = (items: DragOrderContent["items"], instruction?: string) =>
    onChange({ items, instruction: instruction ?? c.instruction } as ActivityContent);

  const addItem = () =>
    update([...items, { id: crypto.randomUUID(), text: "", correctOrder: items.length + 1 }]);

  const updateItem = (idx: number, text: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], text };
    update(updated);
  };

  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, correctOrder: i + 1 }));
    update(updated);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    update(updated.map((item, i) => ({ ...item, correctOrder: i + 1 })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">{t("items")} ({items.length})</span>
        <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
          <Plus className="h-3.5 w-3.5" />{t("addItem")}
        </button>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant">{t("instruction")}</label>
        <input
          value={c.instruction ?? ""}
          onChange={(e) => update(items, e.target.value)}
          placeholder={t("instructionPlaceholder")}
          className="w-full rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <p className="text-xs text-on-surface-variant italic">{t("orderHint")}</p>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="w-6 text-xs text-center text-on-surface-variant font-bold">{i + 1}.</span>
            <input
              value={item.text}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={t("itemPlaceholder")}
              className="flex-1 rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex flex-col">
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-0.5 disabled:opacity-20 hover:text-primary">
                <ChevronUp className="h-3 w-3" />
              </button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-0.5 disabled:opacity-20 hover:text-primary">
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={() => removeItem(i)}
              disabled={items.length <= 2}
              className="p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
