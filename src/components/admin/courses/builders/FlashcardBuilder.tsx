"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { FlashcardContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function FlashcardBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.flashcard");
  const c = content as FlashcardContent;
  const cards = c.cards ?? [];

  const update = (cards: FlashcardContent["cards"]) =>
    onChange({ cards } as ActivityContent);

  const addCard = () =>
    update([...cards, { id: crypto.randomUUID(), front: "", back: "" }]);

  const updateCard = (idx: number, changes: Partial<FlashcardContent["cards"][0]>) => {
    const updated = [...cards];
    updated[idx] = { ...updated[idx], ...changes };
    update(updated);
  };

  const removeCard = (idx: number) => update(cards.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">{t("cards")} ({cards.length})</span>
        <button onClick={addCard} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
          <Plus className="h-3.5 w-3.5" />{t("addCard")}
        </button>
      </div>

      {cards.map((card, i) => (
        <div key={card.id} className="rounded-xl border border-outline-variant/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">Card {i + 1}</span>
            <button
              onClick={() => removeCard(i)}
              disabled={cards.length <= 1}
              className="p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-on-surface-variant">{t("front")}</label>
              <input
                value={card.front}
                onChange={(e) => updateCard(i, { front: e.target.value })}
                placeholder={t("frontPlaceholder")}
                className="w-full rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant">{t("back")}</label>
              <textarea
                value={card.back}
                onChange={(e) => updateCard(i, { back: e.target.value })}
                placeholder={t("backPlaceholder")}
                rows={2}
                className="w-full rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
